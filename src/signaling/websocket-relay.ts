/**
 * WebSocketRelayTransport - Signaling transport over a WebSocket relay.
 *
 * Connects to a public (or self-hosted) WebSocket relay service.
 * The relay is UNTRUSTED -- all payloads are opaque encrypted strings.
 *
 * Default relay: PieSocket free-tier demo endpoint.
 * Users can supply their own relay URL(s) via the constructor.
 *
 * Relay URL template:  Use `{channel}` as a placeholder that will be
 * replaced with the room/channel identifier at connect time.
 *
 * Features:
 *  - Multiple relay URLs tried in order (first successful wins)
 *  - Automatic reconnection with exponential back-off (max 3 attempts)
 *  - Heart-beat ping to detect stale connections
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

const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_RECONNECT_DELAY_MS = 1_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

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
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private intentionalDisconnect = false;

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

    this.channel = channel;
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;
    this.currentRelayIndex = 0;

    this.tryConnect();
  }

  send(data: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('SignalingTransport: not connected');
    }
    this.ws.send(data);
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
    this.cleanup();
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private tryConnect(): void {
    if (this.currentRelayIndex >= this.relayUrls.length) {
      // All relays exhausted for this attempt round.
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
    const url = urlTemplate.replace('{channel}', encodeURIComponent(this.channel!));

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      // Synchronous failure (e.g. bad URL).
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
    this.startHeartbeat();
    this.openHandlers.forEach((h) => h());
  };

  private handleMessage = (event: MessageEvent): void => {
    // Only relay string payloads; ignore binary / control frames.
    if (typeof event.data !== 'string') return;

    // PieSocket may send system messages as JSON with a "type" field.
    // Ignore known system events so only opaque signaling payloads reach
    // the higher layer.
    try {
      const parsed = JSON.parse(event.data);
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.type === 'string' &&
        ['system', 'ping', 'pong'].includes(parsed.type)
      ) {
        return;
      }
    } catch {
      // Not JSON -- that's fine, treat as opaque payload.
    }

    this.messageHandlers.forEach((h) => h(event.data));
  };

  private handleError = (event: Event): void => {
    this.errorHandlers.forEach((h) => h(event));
  };

  private handleClose = (): void => {
    const wasConnected = this._connected;
    this._connected = false;
    this.stopHeartbeat();

    if (this.intentionalDisconnect) {
      this.closeHandlers.forEach((h) => h());
      return;
    }

    if (wasConnected) {
      // Was previously connected -- attempt reconnect from the same relay.
      this.closeHandlers.forEach((h) => h());
      if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.scheduleReconnect();
      }
    } else {
      // Never connected -- try the next relay URL.
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

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send a lightweight ping frame the relay can ignore.
        try {
          this.ws.send('');
        } catch {
          // Ignore -- close handler will deal with broken connections.
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // Remove handlers to avoid firing callbacks during teardown.
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
