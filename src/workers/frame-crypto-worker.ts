/**
 * Web Worker for frame-level encryption/decryption using Insertable Streams.
 *
 * Uses AES-GCM with a counter-based IV strategy:
 *   IV (12 bytes) = 4-byte random salt + 8-byte big-endian counter
 *
 * Encrypted frame layout: [IV (12 bytes)][ciphertext]
 */

let encryptKey: CryptoKey | null = null;
let decryptKey: CryptoKey | null = null;
let encryptCounter = 0;

// Fixed 4-byte salt generated once per worker session
const salt = new Uint8Array(4);
crypto.getRandomValues(salt);

/**
 * Build a 12-byte IV from the session salt and a monotonic counter.
 */
function buildIv(counter: number): Uint8Array {
  const iv = new Uint8Array(12);
  iv.set(salt, 0);

  // Write counter as big-endian 8 bytes starting at offset 4
  const view = new DataView(iv.buffer);
  // Split the counter into high and low 32-bit parts to support counts > 2^32
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(4, high, false);
  view.setUint32(8, low, false);

  return iv;
}

/**
 * Encrypt a single encoded frame.
 */
async function encryptFrame(
  frame: RTCEncodedVideoFrame | RTCEncodedAudioFrame,
  controller: TransformStreamDefaultController,
): Promise<void> {
  if (!encryptKey) {
    controller.enqueue(frame);
    return;
  }

  try {
    const iv = buildIv(encryptCounter++);
    const plaintext = frame.data;

    const ciphertext = await self.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      encryptKey,
      plaintext,
    );

    // Prepend IV to ciphertext
    const output = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    output.set(iv, 0);
    output.set(new Uint8Array(ciphertext), iv.byteLength);

    frame.data = output.buffer;
    controller.enqueue(frame);
  } catch {
    // On failure still forward the original frame so the stream doesn't stall
    controller.enqueue(frame);
    self.postMessage({ type: 'error', message: 'Encryption failed' });
  }
}

/**
 * Decrypt a single encoded frame.
 */
async function decryptFrame(
  frame: RTCEncodedVideoFrame | RTCEncodedAudioFrame,
  controller: TransformStreamDefaultController,
): Promise<void> {
  if (!decryptKey) {
    controller.enqueue(frame);
    return;
  }

  const data = new Uint8Array(frame.data);

  if (data.byteLength < 12) {
    // Frame too small to contain IV - forward empty/silent frame
    frame.data = new ArrayBuffer(0);
    controller.enqueue(frame);
    self.postMessage({ type: 'error', message: 'Frame too small to decrypt' });
    return;
  }

  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);

  try {
    const plaintext = await self.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      decryptKey,
      ciphertext,
    );

    frame.data = plaintext;
    controller.enqueue(frame);
  } catch {
    // On decryption failure enqueue an empty/silent frame
    frame.data = new ArrayBuffer(0);
    controller.enqueue(frame);
    self.postMessage({ type: 'error', message: 'Decryption failed' });
  }
}

// Handle messages from the main thread
self.onmessage = (event: MessageEvent) => {
  const { type, key, mode } = event.data;
  if (type === 'setup') {
    if (mode === 'encrypt') {
      encryptKey = key;
    } else if (mode === 'decrypt') {
      decryptKey = key;
    }
  }
};

// RTCRtpScriptTransform handler
// @ts-ignore - onrtctransform is not yet in TypeScript lib definitions
self.onrtctransform = (event: { transformer: { readable: ReadableStream; writable: WritableStream; options?: { mode?: string } } }) => {
  const { readable, writable, options } = event.transformer;
  const mode = options?.mode;

  const transform = new TransformStream({
    async transform(frame: RTCEncodedVideoFrame | RTCEncodedAudioFrame, controller: TransformStreamDefaultController) {
      if (mode === 'encrypt') {
        await encryptFrame(frame, controller);
      } else if (mode === 'decrypt') {
        await decryptFrame(frame, controller);
      } else {
        // Unknown mode - pass through
        controller.enqueue(frame);
      }
    },
  });

  readable.pipeThrough(transform).pipeTo(writable);
};
