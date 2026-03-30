/**
 * EncryptedSignaling - High-level encrypted signaling layer.
 *
 * Wraps any SignalingTransport with authenticated encryption (AES-GCM)
 * so that the underlying relay never sees plaintext signaling data.
 *
 * Security properties:
 *  - All messages encrypted with the shared room key before transmission
 *  - Replay protection via monotonic messageId + seen-set
 *  - Two-party enforcement: room locks after two unique senderIds
 *  - Schema validation on every decrypted message
 *  - No sensitive data (keys, plaintext, SDP) is ever logged
 */

import type { SignalingTransport } from './transport';

// ---------------------------------------------------------------------------
// Crypto module imports (from ../crypto -- will be implemented separately)
// ---------------------------------------------------------------------------
// These functions/types are expected to be provided by the crypto module.
// If the crypto module is not yet built we declare local stand-in types so
// that this file compiles independently during early development.

import type { SignalingMessage } from '../crypto';
import {
  encryptSignaling,
  decryptSignaling,
  validateSignalingMessage,
  generateSenderId,
  generateMessageId,
  ReplayProtector,
} from '../crypto';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SignalingEventType =
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'join'
  | 'leave'
  | 'room-full'
  | 'verification-state';

export interface EncryptedSignalingOptions {
  /** The underlying (untrusted) transport. */
  transport: SignalingTransport;
  /** Shared room key used for AES-GCM encrypt/decrypt. */
  roomKey: CryptoKey;
  /** Human-readable room identifier. */
  roomId: string;
  /** Called when a valid decrypted message is received. */
  onMessage: (msg: SignalingMessage) => void;
  /** Called on decryption / validation / protocol errors. */
  onError: (error: string) => void;
  /** Called when the transport layer connects. */
  onConnected: () => void;
  /** Called when the transport layer disconnects. */
  onDisconnected: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of unique participants (including self). */
const MAX_PARTIES = 2;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class EncryptedSignaling {
  private readonly transport: SignalingTransport;
  private readonly roomKey: CryptoKey;
  private readonly roomId: string;
  private readonly onMessageCb: (msg: SignalingMessage) => void;
  private readonly onErrorCb: (error: string) => void;
  private readonly onConnectedCb: () => void;
  private readonly onDisconnectedCb: () => void;

  private readonly senderId: string;
  private readonly replayProtector: ReplayProtector;
  private readonly peerIds: Set<string> = new Set();
  private locked = false;
  private disposed = false;

  constructor(options: EncryptedSignalingOptions) {
    this.transport = options.transport;
    this.roomKey = options.roomKey;
    this.roomId = options.roomId;
    this.onMessageCb = options.onMessage;
    this.onErrorCb = options.onError;
    this.onConnectedCb = options.onConnected;
    this.onDisconnectedCb = options.onDisconnected;

    this.senderId = generateSenderId();
    this.replayProtector = new ReplayProtector();

    // Wire up transport callbacks.
    this.transport.onMessage(this.handleIncomingMessage);
    this.transport.onOpen(this.handleOpen);
    this.transport.onError(this.handleTransportError);
    this.transport.onClose(this.handleClose);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Open the underlying transport connection for this room.
   * Resolves once the transport is actually connected and ready to send.
   */
  async connect(): Promise<void> {
    if (this.disposed) {
      throw new Error('EncryptedSignaling: instance has been disposed');
    }

    // If already connected, resolve immediately
    if (this.transport.connected) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      let settled = false;

      const onOpen = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      const onError = (err: Event | Error) => {
        if (!settled) {
          settled = true;
          reject(
            err instanceof Error
              ? err
              : new Error('Transport failed to connect'),
          );
        }
      };

      // Register one-shot listeners for the connection attempt
      this.transport.onOpen(onOpen);
      this.transport.onError(onError);

      this.transport.connect(this.roomId);
    });
  }

  /**
   * Encrypt and send a signaling message.
   *
   * @param type  - The signaling event type (offer, answer, etc.)
   * @param payload - Arbitrary JSON-serialisable payload for this event.
   */
  async send(type: SignalingEventType, payload: unknown): Promise<void> {
    if (this.disposed) {
      throw new Error('EncryptedSignaling: instance has been disposed');
    }
    if (!this.transport.connected) {
      throw new Error('EncryptedSignaling: transport not connected');
    }

    const message: SignalingMessage = {
      version: 1,
      type,
      senderId: this.senderId,
      messageId: generateMessageId(),
      timestamp: Date.now(),
      roomId: this.roomId,
      payload,
    };

    const ciphertext = await encryptSignaling(message, this.roomKey);
    this.transport.send(ciphertext);
  }

  /** Tear down the transport and release resources. */
  disconnect(): void {
    this.disposed = true;
    this.transport.disconnect();
  }

  /** Return this client's unique sender identifier. */
  getSenderId(): string {
    return this.senderId;
  }

  /** Return the list of known remote peer sender identifiers. */
  getPeerIds(): string[] {
    return Array.from(this.peerIds);
  }

  /** Whether the room is locked (two parties already present). */
  isRoomLocked(): boolean {
    return this.locked;
  }

  // -----------------------------------------------------------------------
  // Transport callbacks
  // -----------------------------------------------------------------------

  private handleOpen = (): void => {
    this.onConnectedCb();
  };

  private handleClose = (): void => {
    this.onDisconnectedCb();
  };

  private handleTransportError = (error: Event | Error): void => {
    const message =
      error instanceof Error ? error.message : 'Transport error';
    this.onErrorCb(`Transport: ${message}`);
  };

  /**
   * Process an incoming ciphertext from the relay.
   *
   * Steps:
   *  1. Decrypt with the room key
   *  2. Validate schema
   *  3. Drop messages from self
   *  4. Check replay protection
   *  5. Enforce two-party room limit
   *  6. Deliver to application callback
   */
  private handleIncomingMessage = async (data: string): Promise<void> => {
    if (this.disposed) return;

    // 1. Decrypt ----------------------------------------------------------
    let message: SignalingMessage;
    try {
      message = await decryptSignaling(data, this.roomKey);
    } catch {
      this.onErrorCb('Failed to decrypt incoming signaling message');
      return;
    }

    // 2. Validate schema --------------------------------------------------
    if (!validateSignalingMessage(message)) {
      this.onErrorCb('Invalid signaling message schema');
      return;
    }

    // 3. Ignore own messages (relay may echo) ----------------------------
    if (message.senderId === this.senderId) {
      return;
    }

    // 4. Replay protection ------------------------------------------------
    const replayResult = this.replayProtector.check(
      message.messageId,
      message.timestamp,
      message.roomId,
      this.roomId,
    );
    if (!replayResult.valid) {
      this.onErrorCb(`Rejected signaling message: ${replayResult.reason}`);
      return;
    }

    // 5. Two-party enforcement --------------------------------------------
    if (!this.peerIds.has(message.senderId)) {
      if (this.locked) {
        // A third party is trying to join -- reject.
        try {
          await this.send('room-full', { rejectedPeer: message.senderId });
        } catch {
          // Best-effort notification; ignore send failures.
        }
        this.onErrorCb('Rejected message from third party: room is full');
        return;
      }

      this.peerIds.add(message.senderId);

      // Lock room once we have exactly one peer (self is not in peerIds).
      if (this.peerIds.size >= MAX_PARTIES - 1) {
        this.locked = true;
      }
    }

    // 6. Handle peer leave ------------------------------------------------
    if (message.type === 'leave') {
      this.peerIds.delete(message.senderId);
      this.locked = false;
    }

    // 7. Deliver to application -------------------------------------------
    this.onMessageCb(message);
  };
}
