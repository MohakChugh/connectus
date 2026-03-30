/**
 * Signaling module -- public API surface.
 *
 * Re-exports the transport interface, the WebSocket relay implementation,
 * and the high-level encrypted signaling coordinator.
 */

// Transport interface & callback types
export type {
  SignalingTransport,
  MessageHandler,
  ConnectionHandler,
  ErrorHandler,
} from './transport';

// WebSocket relay transport implementation
export { WebSocketRelayTransport } from './websocket-relay';

// Encrypted signaling coordinator
export {
  EncryptedSignaling,
  type EncryptedSignalingOptions,
  type SignalingEventType,
} from './encrypted-signaling';
