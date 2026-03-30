/**
 * Key generation, import/export, and URL hash handling for room keys.
 * All cryptographic operations use Web Crypto API exclusively.
 */

// -- Base64url helpers (RFC 4648 section 5, no padding) --

export function base64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64urlDecode(str: string): ArrayBuffer {
  // Restore standard base64 characters and padding
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// -- Key operations --

export function generateRoomId(): string {
  return crypto.randomUUID();
}

export async function generateRoomKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can share via URL hash
    ['encrypt', 'decrypt'],
  );
}

export async function exportRoomKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return base64urlEncode(raw);
}

export async function importRoomKey(encoded: string): Promise<CryptoKey> {
  const raw = base64urlDecode(encoded);
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

// -- URL hash fragment handling --
// The key never leaves the browser: hash fragments are not sent to servers.

export async function buildShareUrl(roomId: string, key: CryptoKey): Promise<string> {
  const base64urlKey = await exportRoomKey(key);
  return `${window.location.origin}${window.location.pathname}#roomId=${encodeURIComponent(roomId)}&key=${base64urlKey}`;
}

export function parseHashParams(): { roomId: string; key: string } | null {
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return null;

  const params = new URLSearchParams(hash.slice(1));
  const roomId = params.get('roomId');
  const key = params.get('key');

  if (!roomId || !key || roomId.length === 0 || key.length === 0) {
    return null;
  }

  return { roomId, key };
}

/** Remove the hash fragment from the URL bar without triggering navigation. */
export function scrubHash(): void {
  history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search,
  );
}
