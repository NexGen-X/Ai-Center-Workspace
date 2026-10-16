import { URL } from 'url';
import net from 'net';

export interface SsrfOptions {
  allowLocalhost?: boolean; // Defaults to true (for model provider endpoints like Ollama/Hermes)
  allowPrivateIps?: boolean; // Defaults to false
}

/**
 * Checks whether an IPv4 numeric representation falls into private/link-local ranges
 */
function isPrivateOrLocalIp(ip: string): { isPrivate: boolean; isLoopback: boolean; isMetadata: boolean } {
  // Check loopback
  if (ip.startsWith('127.')) {
    return { isPrivate: true, isLoopback: true, isMetadata: false };
  }
  // Check metadata
  if (ip.startsWith('169.254.')) {
    return { isPrivate: true, isLoopback: false, isMetadata: true };
  }
  // Check RFC 1918
  if (ip.startsWith('10.')) {
    return { isPrivate: true, isLoopback: false, isMetadata: false };
  }
  if (ip.startsWith('192.168.')) {
    return { isPrivate: true, isLoopback: false, isMetadata: false };
  }
  const match172 = ip.match(/^172\.(\d+)\./);
  if (match172) {
    const secondOctet = parseInt(match172[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return { isPrivate: true, isLoopback: false, isMetadata: false };
    }
  }
  // Carrier-grade NAT 100.64.0.0/10
  const match100 = ip.match(/^100\.(\d+)\./);
  if (match100) {
    const secondOctet = parseInt(match100[1], 10);
    if (secondOctet >= 64 && secondOctet <= 127) {
      return { isPrivate: true, isLoopback: false, isMetadata: false };
    }
  }

  return { isPrivate: false, isLoopback: false, isMetadata: false };
}

/**
 * SSRF Protection Utility for Outgoing URLs (Model Providers, Web Research, Sandboxed Fetch, Webhooks)
 * Enforces safe protocols, prevents IP-encoding obfuscations, and blocks cloud metadata endpoints.
 */
export function validateOutgoingUrl(
  urlStr: string,
  options: SsrfOptions = {}
): { isValid: boolean; error?: string; parsedUrl?: URL } {
  const { allowLocalhost = true, allowPrivateIps = false } = options;

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

    let hostname = parsed.hostname.toLowerCase();
    // Strip trailing dot if present
    if (hostname.endsWith('.')) {
      hostname = hostname.slice(0, -1);
    }

    // Block Cloud Metadata endpoints (AWS / GCP / Azure / DigitalOcean metadata)
    if (
      hostname === '169.254.169.254' ||
      hostname.startsWith('169.254.') ||
      hostname.includes('169.254.169.254') ||
      hostname === 'metadata.google.internal' ||
      hostname === 'metadata.goog' ||
      hostname === 'instance-data' ||
      hostname === '2852039166' || // Decimal integer representation of 169.254.169.254
      hostname === '0xa9fea9fe' // Hexadecimal representation of 169.254.169.254
    ) {
      return { isValid: false, error: 'Akses ke cloud metadata service (169.254.169.254) dilarang demi keamanan.' };
    }

    // Block 0.0.0.0, [::], broadcast
    if (hostname === '0.0.0.0' || hostname === '::' || hostname === '[::]' || hostname === '255.255.255.255') {
      return { isValid: false, error: 'Alamat bind lokal/broadcast tidak diizinkan sebagai provider endpoint.' };
    }

    // Check if hostname is an IP
    const cleanHost = hostname.replace(/^\[|\]$/g, '');
    const ipType = net.isIP(cleanHost);

    if (ipType === 4) {
      const ipCheck = isPrivateOrLocalIp(cleanHost);
      if (ipCheck.isMetadata) {
        return { isValid: false, error: 'Akses ke link-local cloud metadata dilarang demi keamanan.' };
      }
      if (ipCheck.isLoopback && !allowLocalhost) {
        return { isValid: false, error: 'Akses ke alamat loopback lokal (127.0.0.1) dibatasi untuk endpoint ini.' };
      }
      if (ipCheck.isPrivate && !allowPrivateIps && !ipCheck.isLoopback) {
        return { isValid: false, error: `Akses ke rentang IP privat (${cleanHost}) dibatasi demi keamanan.` };
      }
    } else if (ipType === 6) {
      if (cleanHost === '::1' && !allowLocalhost) {
        return { isValid: false, error: 'Akses ke IPv6 loopback (::1) dibatasi untuk endpoint ini.' };
      }
      if ((cleanHost.startsWith('fc') || cleanHost.startsWith('fd') || cleanHost.startsWith('fe80')) && !allowPrivateIps) {
        return { isValid: false, error: 'Akses ke rentang IPv6 privat/link-local dibatasi demi keamanan.' };
      }
    } else {
      // Hostname string checks
      if ((hostname === 'localhost' || hostname.endsWith('.localhost')) && !allowLocalhost) {
        return { isValid: false, error: 'Akses ke localhost dibatasi untuk endpoint ini.' };
      }
    }

    return { isValid: true, parsedUrl: parsed };
  } catch (err: any) {
    return { isValid: false, error: `Format URL tidak valid: ${err.message}` };
  }
}
