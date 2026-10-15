/**
 * Rich Document Ingestion & Parser Service — AI Agent Command Center
 * Supports parsing CSV, JSON, PDF (text stream extractor), and Markdown/Plaintext
 * into optimized semantic representations for RAG pgvector embedding.
 */

import { UploadDocumentRequest } from '../../../shared/types.js';

export interface ParsedDocumentResult {
  parsedTitle: string;
  parsedContent: string;
  metadata: {
    originalFileName: string;
    fileType: string;
    fileSize: number;
    rowCount?: number;
    parsedFormat: string;
  };
}

export class DocumentParserService {
  /**
   * Ingests and parses base64-encoded files into structured text content
   */
  static parseUploadedDocument(req: UploadDocumentRequest): ParsedDocumentResult {
    const rawBase64 = req.fileContentBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(rawBase64, 'base64');
    const fileSize = buffer.length;
    const fileName = req.fileName || 'uploaded-document.txt';

    const ext = this.getFileExtension(fileName).toLowerCase();
    const cleanTitle = this.generateTitleFromFilename(fileName);

    let parsedContent = '';
    let parsedFormat = 'TEXT';
    let rowCount: number | undefined = undefined;

    if (ext === 'csv' || req.fileType.includes('csv')) {
      const rawText = buffer.toString('utf-8');
      const csvResult = this.parseCsv(rawText);
      parsedContent = csvResult.content;
      parsedFormat = 'CSV_TABLE';
      rowCount = csvResult.rowCount;
    } else if (ext === 'json' || req.fileType.includes('json')) {
      const rawText = buffer.toString('utf-8');
      parsedContent = this.parseJson(rawText);
      parsedFormat = 'JSON_STRUCTURED';
    } else if (ext === 'pdf' || req.fileType.includes('pdf')) {
      parsedContent = this.extractTextFromPdfBuffer(buffer, fileName);
      parsedFormat = 'PDF_EXTRACTED_TEXT';
    } else {
      // Default UTF-8 text (Markdown, TXT, YAML, etc.)
      parsedContent = buffer.toString('utf-8').trim();
      parsedFormat = ext.toUpperCase() || 'PLAINTEXT';
    }

    if (!parsedContent || parsedContent.trim().length === 0) {
      throw new Error(`Gagal mengekstrak teks bermakna dari file "${fileName}".`);
    }

    return {
      parsedTitle: cleanTitle,
      parsedContent,
      metadata: {
        originalFileName: fileName,
        fileType: req.fileType || ext,
        fileSize,
        rowCount,
        parsedFormat
      }
    };
  }

  /**
   * Parses CSV text into a structured Markdown table and semantic row summaries
   */
  private static parseCsv(rawCsv: string): { content: string; rowCount: number } {
    const lines = rawCsv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return { content: '*Berkas CSV kosong*', rowCount: 0 };
    }

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let insideQuote = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const dataRows = lines.slice(1).map(parseLine);
    const rowCount = dataRows.length;

    // 1. Build Markdown Table
    let tableMd = `### Tabel Data Terstruktur (Total: ${rowCount} Baris)\n\n`;
    tableMd += `| ${headers.join(' | ')} |\n`;
    tableMd += `| ${headers.map(() => ':---').join(' | ')} |\n`;

    // Limit initial table view in Markdown to first 50 rows to avoid blowing token context
    const previewRows = dataRows.slice(0, 50);
    previewRows.forEach((row) => {
      // Pad or trim to header length
      const cells = headers.map((_, idx) => (row[idx] !== undefined ? row[idx].replace(/\|/g, '\\|') : ''));
      tableMd += `| ${cells.join(' | ')} |\n`;
    });

    if (rowCount > 50) {
      tableMd += `\n*... Menampilkan 50 dari ${rowCount} total baris data.*\n`;
    }

    // 2. Build Semantic Record Chunks for RAG Vector Search
    tableMd += `\n### Rangkuman Entri Record Semantik\n`;
    dataRows.forEach((row, idx) => {
      const summaryItems: string[] = [];
      headers.forEach((h, colIdx) => {
        const val = row[colIdx];
        if (val !== undefined && val !== '') {
          summaryItems.push(`${h}: ${val}`);
        }
      });
      tableMd += `[Entri #${idx + 1}] ${summaryItems.join(' | ')}\n`;
    });

    return { content: tableMd.trim(), rowCount };
  }

  /**
   * Parses JSON into clean readable YAML/markdown format with schema summary
   */
  private static parseJson(rawJson: string): string {
    try {
      const parsed = JSON.parse(rawJson);
      let content = `### Struktur Dokumen JSON Terformat\n\n`;

      if (Array.isArray(parsed)) {
        content += `**Tipe Koleksi**: Array (${parsed.length} item)\n\n`;
        if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
          const keys = Object.keys(parsed[0]);
          content += `**Skema Kolom Utama**: \`${keys.join('`, `')}\`\n\n`;
        }
        content += '```json\n' + JSON.stringify(parsed.slice(0, 50), null, 2) + '\n```\n';
        if (parsed.length > 50) {
          content += `\n*(Menampilkan 50 dari ${parsed.length} total item)*\n`;
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        const keys = Object.keys(parsed);
        content += `**Tipe Objek**: Dokumen Konfigurasi/Data (${keys.length} field utama)\n\n`;
        content += '```json\n' + JSON.stringify(parsed, null, 2) + '\n```\n';
      } else {
        content += '```json\n' + JSON.stringify(parsed, null, 2) + '\n```\n';
      }

      return content.trim();
    } catch (err: any) {
      return `### Dokumen JSON (Mentah)\n\n\`\`\`json\n${rawJson}\n\`\`\``;
    }
  }

  /**
   * Pure stream text extractor for PDF documents without heavy C++ native bindings
   */
  private static extractTextFromPdfBuffer(buffer: Buffer, fileName: string): string {
    const raw = buffer.toString('latin1');
    const textPieces: string[] = [];

    // Extract text inside PDF stream blocks: BT ... ET (Begin Text ... End Text)
    const streamRegex = /BT[\s\S]*?ET/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(raw)) !== null) {
      const block = match[0];
      // Match text in parentheses: (Text string) Tj or TJ arrays
      const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
      let tjMatch: RegExpExecArray | null;
      let blockText = '';

      while ((tjMatch = tjRegex.exec(block)) !== null) {
        // Decode common PDF escape sequences
        const unescaped = tjMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        blockText += unescaped + ' ';
      }

      if (blockText.trim()) {
        textPieces.push(blockText.trim());
      }
    }

    if (textPieces.length > 0) {
      return `# Ekstraksi Teks PDF: ${fileName}\n\n` + textPieces.join('\n\n');
    }

    // Fallback: extract printable strings from raw buffer if stream parsing returned sparse text
    const printableMatches = raw.match(/[A-Za-z0-9 .,:;!?()\[\]\-_/@#$%^&*+=<>]{4,}/g);
    if (printableMatches && printableMatches.length > 10) {
      const cleanTokens = printableMatches
        .filter((t) => !t.includes('/Font') && !t.includes('/ProcSet') && !t.includes('/MediaBox') && !t.includes('xref'))
        .slice(0, 500);
      return `# Ekstraksi Teks Dokumen: ${fileName}\n\n` + cleanTokens.join('\n');
    }

    return `# Dokumen PDF: ${fileName}\n\n*Berkas PDF terlampir (${Math.round(buffer.length / 1024)} KB).*`;
  }

  private static getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()! : '';
  }

  private static generateTitleFromFilename(filename: string): string {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    return nameWithoutExt
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
