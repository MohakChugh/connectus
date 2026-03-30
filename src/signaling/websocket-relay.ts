/**
 * WebSocketRelayTransport - Signaling transport over a WebSocket relay.
 *
 * Connects to a public (or self-hosted) WebSocket relay service.
 * The relay is UNTRUSTED -- all payloads are opaque encrypted strings.
 *
 * Default relay: PieSocket free-tier demo endpoint.
 *
 * Features:
 *  - Multiple relay URLs tried in order (first successful wins)
 *  - Automatic reconnection with exponential back-off (max 5 attempts)
 *  - Message queue: messages sent while disconnected are buffered and
 *    flushed automatically on reconnect
 *  - Graceful handling of relay system messages
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

const DEFAULT_RELAY_URLS: readonly string[] = [
  'wss://free.blr2.piesocket.com/v3/{channel}?api_key=VCXCEuvhGcBDP7XhiJJUDvR1e1D3eiVjgZ9VRiaV&notify_self=0',
];

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1_000;

/**
 * Sanitise a room ID into a channel name safe for WebSocket relays.
 * Strips everything except alphanumerics so UUIDs become pure hex-like strings.
 */
function sanitiseChannel(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class WebSocketRelayTransport implements SignalingTransport {
  private ws: WebSocket | null = null;
  private channel: string | null = null;
  private relayUrls: readonly string[];
  private currentRelayIndex = 0;

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

  constructor(relayUrls?: string[]) {
    this.relayUrls =
      relayUrls && relayUrls.length > 0 ? relayUrls : DEFAULT_RELAY_URLS;
  }

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

    this.channel = sanitiseChannel(channel);
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;
    this.currentRelayIndex = 0;
    this.sendQueue = [];

    this.tryConnect();
  }

  send(data: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      // Buffer the message so it can be sent once the connection is (re)established
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
  // Internal
  // -----------------------------------------------------------------------

  private tryConnect(): void {
    if (this.currentRelayIndex >= this.relayUrls.length) {
      if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.scheduleReconnect();
      } else {
        const err = new Error(
          'SignalingTransport: all relay URLs exhausted after max retries',
        );
        this.errorHandlers.forEach((h) => h(err));
      }
      return;
    }

    const urlTemplate = this.relayUrls[this.currentRelayIndex];
    const url = urlTemplate.replace('{channel}', this.channel!);

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.currentRelayIndex++;
      this.tryConnect();
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

  /**
   * Flush any messages that were queued while disconnected.
   */
  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const pending = this.sendQueue.splice(0);
    for (const msg of pending) {
      try {
        this.ws.send(msg);
      } catch {
        // Re-queue on failure -- next reconnect will retry
        this.sendQueue.push(msg);
        break;
      }
    }
  }

  private handleMessage = (event: MessageEvent): void => {
    if (typeof event.data !== 'string') return;

    const raw = event.data.trim();
    if (raw.length === 0) return;

    // ---- Filter out relay system / control messages ----
    // Our encrypted signaling payloads are base64url which only contains
    // [A-Za-z0-9_-]. They NEVER start with '{' or '['.
    // Any JSON object/array is therefore a relay system message.
    if (raw.startsWith('{') || raw.startsWith('[')) {
      return;
    }

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
      // Was previously connected -- attempt silent reconnect.
      // Do NOT notify close handlers during transient reconnects so the UI
      // doesn't flap between connected/disconnected.
      if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.scheduleReconnect();
      } else {
        // Exhausted retries -- now notify
        this.closeHandlers.forEach((h) => h());
      }
    } else {
      // Never connected with this relay -- try next URL.
      this.currentRelayIndex++;
      this.tryConnect();
    }
  };

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    this.currentRelayIndex = 0;

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
