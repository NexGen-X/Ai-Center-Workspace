/**
 * Semantic Vector Embedding Service — AI Agent Command Center
 * Generates 768-dimensional normalized dense vectors for RAG and Long-Term Memory.
 * Uses active model provider embedding API when available with deterministic semantic projection fallback.
 */

import { pool } from '../db/index.js';
import { decryptSecret } from '../utils/crypto.js';
import { systemLogger } from './logger.js';

export const EMBEDDING_DIM = 768;

// Common stop words and interrogative words to de-emphasize in deterministic vector projection
const STOP_WORDS = new Set([
  'dan', 'di', 'ke', 'dari', 'yang', 'pada', 'untuk', 'dengan', 'adalah', 'ini', 'itu',
  'atau', 'juga', 'akan', 'bisa', 'ada', 'oleh', 'saat', 'para', 'harus', 'seperti',
  'bagaimana', 'apakah', 'apa', 'kapan', 'siapa', 'dimana', 'mengapa', 'kenapa',
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with', 'as',
  'how', 'what', 'when', 'where', 'why', 'who'
]);

/**
 * 32-bit FNV-1a hash algorithm
 */
function fnv1a(str: string, seed: number = 0x811c9dc5): number {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic Semantic Vector Projection (768-dim)
 * Maps lexical tokens, bigrams, and character n-grams into a 768-dimensional unit sphere.
 */
export function generateDeterministicEmbedding(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIM);
  if (!text || typeof text !== 'string') {
    vec[0] = 1.0;
    return Array.from(vec);
  }

  const clean = text.toLowerCase().replace(/[^\w\s-]/g, ' ');
  const words = clean.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) {
    vec[0] = 1.0;
    return Array.from(vec);
  }

  // Word frequencies
  const tf: Record<string, number> = {};
  for (const w of words) {
    tf[w] = (tf[w] || 0) + 1;
  }

  // Project words with TF weight
  for (const [w, count] of Object.entries(tf)) {
    const isStop = STOP_WORDS.has(w);
    const weight = (isStop ? 0.05 : 1.0) * Math.sqrt(count);

    // Primary hash
    const h1 = fnv1a(w, 0x811c9dc5);
    const idx1 = h1 % EMBEDDING_DIM;
    const sign1 = (h1 & 0x10000) ? 1.0 : -1.0;
    vec[idx1] += sign1 * weight;

    // Secondary hash for dispersion
    const h2 = fnv1a(w, 0x9e3779b9);
    const idx2 = h2 % EMBEDDING_DIM;
    const sign2 = (h2 & 0x20000) ? 0.7 : -0.7;
    vec[idx2] += sign2 * weight;

    // Subword n-grams for morphological similarity
    if (w.length >= 4) {
      for (let i = 0; i <= w.length - 3; i++) {
        const sub = w.substring(i, i + 3);
        const hs = fnv1a(sub, 0x5bd1e995);
        const idxS = hs % EMBEDDING_DIM;
        const signS = (hs & 0x40000) ? 0.35 : -0.35;
        vec[idxS] += signS * weight * 0.4;
      }
    }
  }

  // Project word bigrams for phrase semantics
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]}_${words[i + 1]}`;
    const hb = fnv1a(bigram, 0x27d4eb2f);
    const idxB = hb % EMBEDDING_DIM;
    const signB = (hb & 0x80000) ? 0.6 : -0.6;
    vec[idxB] += signB;
  }

  // L2-Normalize vector so norm = 1.0 (Cosine similarity = Dot product)
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    sumSq += vec[i] * vec[i];
  }

  const norm = Math.sqrt(sumSq) || 1e-9;
  const result: number[] = new Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    // Round to 6 decimals for storage optimization
    result[i] = Math.round((vec[i] / norm) * 1000000) / 1000000;
  }

  return result;
}

/**
 * Cosine similarity between two float vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom < 1e-9) return 0;
  return Math.max(-1, Math.min(1, dot / denom));
}

/**
 * Format a float array as a PostgreSQL vector literal: '[0.1, -0.2, 0.3]'
 */
export function vectorToSql(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

/**
 * Primary Embedding Generator with optional external provider fallback
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Attempt external provider if an active one has embeddings configured
    const providerRes = await pool.query(`
      SELECT id, provider_type, base_url, protocol, api_key_encrypted
      FROM model_providers
      WHERE enabled = true AND connection_status = 'CONNECTION_OK'
      LIMIT 1
    `);

    if (providerRes.rows.length > 0) {
      const p = providerRes.rows[0];
      const apiKey = p.api_key_encrypted ? decryptSecret(p.api_key_encrypted) : undefined;

      if (p.provider_type === 'custom_api' && apiKey && p.base_url.includes('openai')) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
          const res = await fetch(`${p.base_url}/embeddings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: text.slice(0, 4000),
              dimensions: EMBEDDING_DIM
            }),
            signal: controller.signal
          });
          clearTimeout(timeout);
          if (res.ok) {
            const data: any = await res.json();
            if (data?.data?.[0]?.embedding) {
              return data.data[0].embedding;
            }
          }
        } catch {
          // Fall back gracefully to deterministic projection
        }
      }
    }
  } catch (err: any) {
    systemLogger.warn('INFERENCE', `Embedding provider lookup error: ${err.message}. Using deterministic fallback.`);
  }

  // High-performance deterministic fallback
  return generateDeterministicEmbedding(text);
}

/**
 * Batch generate embeddings for multiple texts
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(t => generateEmbedding(t)));
}
