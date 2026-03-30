/**
 * SignalingTransport - Abstract interface for signaling message relay.
 *
 * The transport is treated as UNTRUSTED. It carries opaque encrypted
 * strings; plaintext never touches the wire. Implementations may use
 * WebSockets, BroadcastChannel, manual copy-paste, or any other medium.
 */

/** Callback fired when a message arrives from the relay. */
export type MessageHandler = (data: string, peerId?: string) => void;

/** Callback fired when the transport connection opens or closes. */
export type ConnectionHandler = () => void;

/** Callback fired on transport-level errors. */
export type ErrorHandler = (error: Event | Error) => void;

export interface SignalingTransport {
  /** Open a connection to the given logical channel (room). */
  connect(channel: string): void;

  /** Send an opaque string message through the relay. */
  send(data: string): void;

  /** Register a handler for incoming messages. */
  onMessage(handler: MessageHandler): void;

  /** Register a handler for successful connection. */
  onOpen(handler: ConnectionHandler): void;

  /** Register a handler for transport errors. */
  onError(handler: ErrorHandler): void;

  /** Register a handler for connection close. */
  onClose(handler: ConnectionHandler): void;

  /** Tear down the connection and release resources. */
  disconnect(): void;

  /** Whether the transport is currently connected and ready to send. */
  readonly connected: boolean;
}
