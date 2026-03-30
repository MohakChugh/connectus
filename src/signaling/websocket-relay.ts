/**
 * NtfySignalingTransport - Signaling transport over ntfy.sh pub/sub.
 *
 * ntfy.sh is a free, open-source push notification service that supports
 * WebSocket subscriptions and HTTP POST publishing. It requires no API keys
 * or authentication.
 *
 * How it works:
 *  - Each room gets a unique topic: "connectus_{sanitised-room-id}"
 *  - Both clients subscribe to the topic via WebSocket
 *  - Messages are published via HTTP POST (fetch) to the same topic
 *  - ntfy.sh broadcasts each POST to all WebSocket subscribers on that topic
 *
 * The relay is UNTRUSTED -- all payloads are opaque encrypted strings.
 *
 * Features:
 *  - Automatic reconnection with exponential back-off (max 5 attempts)
 *  - Message queue: messages sent while disconnected are buffered and
 *    flushed automatically on reconnect
 *  - System messages from ntfy.sh (open, keepalive) are filtered out
 */

import type {
  SignalingTransport,
  MessageHandler,
  ConnectionHandler,
  ErrorHandler,
} from './transport';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NTFY_BASE = 'ntfy.sh';
const TOPIC_PREFIX = 'connectus_';

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1_000;

/**
 * Sanitise a room ID into a topic name safe for ntfy.sh.
 * Topics must be alphanumeric (plus underscores/hyphens).
 */
function buildTopic(roomId: string): string {
  return TOPIC_PREFIX + roomId.replace(/[^a-zA-Z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class WebSocketRelayTransport implements SignalingTransport {
  private ws: WebSocket | null = null;
  private topic: string | null = null;

  private messageHandlers: MessageHandler[] = [];
  private openHandlers: ConnectionHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private closeHandlers: ConnectionHandler[] = [];

  private _connected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  /** Messages queued while the transport was disconnected. */
  private sendQueue: string[] = [];

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  get connected(): boolean {
    return this._connected;
  }

  connect(channel: string): void {
    if (this._connected) {
      this.disconnect();
    }

    this.topic = buildTopic(channel);
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;
    this.sendQueue = [];

    this.tryConnect();
  }

  /**
   * Publish a message to the topic via HTTP POST.
   * If the transport is disconnected, the message is queued.
   */
  send(data: string): void {
    if (this._connected && this.topic) {
      this.publishMessage(data);
    } else {
      this.sendQueue.push(data);
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onOpen(handler: ConnectionHandler): void {
    this.openHandlers.push(handler);
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  onClose(handler: ConnectionHandler): void {
    this.closeHandlers.push(handler);
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.sendQueue = [];
    this.cleanup();
  }

  // -----------------------------------------------------------------------
  // Internal -- connection
  // -----------------------------------------------------------------------

  private tryConnect(): void {
    if (!this.topic) return;

    const url = `wss://${NTFY_BASE}/${this.topic}/ws`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = this.handleOpen;
    this.ws.onmessage = this.handleMessage;
    this.ws.onerror = this.handleError;
    this.ws.onclose = this.handleClose;
  }

  private handleOpen = (): void => {
    this._connected = true;
    this.reconnectAttempts = 0;
    this.openHandlers.forEach((h) => h());
    this.flushQueue();
  };

  private handleMessage = (event: MessageEvent): void => {
    if (typeof event.data !== 'string') return;

    const raw = event.data.trim();
    if (raw.length === 0) return;

    // ntfy.sh sends JSON-wrapped events. Extract the message payload
    // from "message" events and drop system events (open, keepalive).
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        // Only relay actual message events
        if (parsed.event === 'message' && typeof parsed.message === 'string') {
          const payload = parsed.message.trim();
          if (payload.length > 0) {
            this.messageHandlers.forEach((h) => h(payload));
          }
        }
        // All other events (open, keepalive, etc.) are silently dropped
        return;
      }
    } catch {
      // Not JSON -- pass through as raw (shouldn't happen with ntfy.sh)
    }

    // Fallback: forward non-JSON messages directly
    this.messageHandlers.forEach((h) => h(raw));
  };

  private handleError = (event: Event): void => {
    this.errorHandlers.forEach((h) => h(event));
  };

  private handleClose = (): void => {
    const wasConnected = this._connected;
    this._connected = false;

    if (this.intentionalDisconnect) {
      this.closeHandlers.forEach((h) => h());
      return;
    }

    if (wasConnected) {
      // Transient disconnect -- attempt silent reconnect without
      // notifying close handlers to prevent UI flapping.
      if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.scheduleReconnect();
      } else {
        this.closeHandlers.forEach((h) => h());
      }
    } else {
      // Never connected -- retry
      this.scheduleReconnect();
    }
  };

  // -----------------------------------------------------------------------
  // Internal -- publishing
  // -----------------------------------------------------------------------

  private async publishMessage(data: string): Promise<void> {
    if (!this.topic) return;

    try {
      await fetch(`https://${NTFY_BASE}/${this.topic}`, {
        method: 'POST',
        body: data,
        headers: {
          // Disable ntfy.sh caching/Firebase delivery -- we only need WebSocket
          'Cache': 'no',
          'X-Priority': '5',
        },
      });
    } catch {
      // If publish fails, queue for retry
      this.sendQueue.push(data);
    }
  }

  // -----------------------------------------------------------------------
  // Internal -- queue & reconnect
  // -----------------------------------------------------------------------

  private flushQueue(): void {
    const pending = this.sendQueue.splice(0);
    for (const msg of pending) {
      this.publishMessage(msg);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      const err = new Error('SignalingTransport: relay exhausted after max retries');
      this.errorHandlers.forEach((h) => h(err));
      return;
    }

    this.reconnectAttempts++;

    const delay =
      BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionalDisconnect) {
        this.tryConnect();
      }
    }, delay);
  }

  private cleanup(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;

      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }

    this._connected = false;
  }
}
