import { URL } from 'url';

/**
 * SSRF Protection Utility for Outgoing Model Provider URLs
 * Enforces safe protocols and blocks AWS/cloud metadata and dangerous addresses.
 */
export function validateOutgoingUrl(urlStr: string): { isValid: boolean; error?: string; parsedUrl?: URL } {
  if (!urlStr || typeof urlStr !== 'string') {
    return { isValid: false, error: 'URL tidak boleh kosong.' };
  }

  // Handle virtual protocols like hermes://
  if (urlStr.startsWith('hermes://')) {
    return { isValid: true };
  }

  try {
    const parsed = new URL(urlStr);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, error: `Protokol tidak diizinkan: ${parsed.protocol}. Hanya http: dan https: yang didukung.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block Cloud Metadata endpoints (AWS / GCP / Azure metadata)
    if (
      hostname === '169.254.169.254' ||
      hostname === 'metadata.google.internal' ||
      hostname === 'instance-data'
    ) {
      return { isValid: false, error: 'Akses ke cloud metadata service (169.254.169.254) dilarang demi keamanan.' };
    }

    // Block 0.0.0.0, [::], broadcast
    if (hostname === '0.0.0.0' || hostname === '::' || hostname === '255.255.255.255') {
      return { isValid: false, error: 'Alamat bind lokal/broadcast tidak diizinkan sebagai provider endpoint.' };
    }

    return { isValid: true, parsedUrl: parsed };
  } catch (err: any) {
    return { isValid: false, error: `Format URL tidak valid: ${err.message}` };
  }
}
