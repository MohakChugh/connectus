/**
 * Encrypt and decrypt signaling messages with AES-GCM.
 * Each message gets a fresh 96-bit IV to ensure nonce uniqueness.
 */

import { base64urlEncode, base64urlDecode } from './keys';

export interface SignalingMessage {
  version: number;
  roomId: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'room-full' | 'verification-state';
  senderId: string;
  timestamp: number;
  messageId: string;
  sequence?: number;
  payload: unknown;
}

const VALID_TYPES = new Set<SignalingMessage['type']>([
  'offer', 'answer', 'ice-candidate', 'join', 'leave', 'room-full', 'verification-state',
]);

const IV_LENGTH = 12; // 96 bits, recommended for AES-GCM

/**
 * Encrypt a signaling message.
 * Format: base64url( IV (12 bytes) || ciphertext || GCM tag )
 */
export async function encryptSignaling(
  message: SignalingMessage,
  key: CryptoKey,
): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(message));

  // Fresh IV per message -- critical for AES-GCM security
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  );

  // Prepend IV to ciphertext for transmission
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);

  return base64urlEncode(combined.buffer);
}

/**
 * Decrypt a signaling message and validate its schema.
 * Throws on decryption failure or invalid message structure.
 */
export async function decryptSignaling(
  encoded: string,
  key: CryptoKey,
): Promise<SignalingMessage> {
  const combined = new Uint8Array(base64urlDecode(encoded));

  if (combined.length < IV_LENGTH + 1) {
    throw new Error('Ciphertext too short');
  }

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));

  if (!validateSignalingMessage(parsed)) {
    throw new Error('Decrypted message failed schema validation');
  }

  return parsed;
}

/** Runtime type guard for SignalingMessage. */
export function validateSignalingMessage(msg: unknown): msg is SignalingMessage {
  if (msg === null || typeof msg !== 'object') return false;

  const m = msg as Record<string, unknown>;

  return (
    typeof m.version === 'number' &&
    typeof m.roomId === 'string' &&
    typeof m.type === 'string' &&
    VALID_TYPES.has(m.type as SignalingMessage['type']) &&
    typeof m.senderId === 'string' &&
    typeof m.timestamp === 'number' &&
    typeof m.messageId === 'string' &&
    (m.sequence === undefined || typeof m.sequence === 'number') &&
    'payload' in m
  );
}

export function generateSenderId(): string {
  return crypto.randomUUID();
}

export function generateMessageId(): string {
  return crypto.randomUUID();
}
