/**
 * useCallState - State machine and React hook for the secure video call lifecycle.
 *
 * Orchestrates: media capture, encrypted signaling, WebRTC peer connection,
 * E2EE status, DTLS safety numbers, and UI-facing reactive state.
 *
 * Mutable long-lived objects (signaling, peer connection, room key) are stored
 * in refs to avoid stale-closure issues. Reactive data consumed by components
 * lives in state.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

import {
  generateRoomId,
  generateRoomKey,
  importRoomKey,
  buildShareUrl,
  computeSafetyNumber,
} from '../crypto';
import type { SignalingMessage } from '../crypto';

import {
  WebSocketRelayTransport,
  EncryptedSignaling,
} from '../signaling';
import type { SignalingEventType } from '../signaling';

import {
  PeerConnection,
  requestMedia,
  stopMedia,
  toggleAudio as mediaToggleAudio,
  toggleVideo as mediaToggleVideo,
} from '../webrtc';

import { checkBrowserCapabilities } from '../utils/browser-checks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CallState =
  | 'idle'
  | 'creating-room'
  | 'waiting-for-peer'
  | 'joining-room'
  | 'signaling-ready'
  | 'connecting-webrtc'
  | 'connected-unverified'
  | 'connected-verified'
  | 'security-warning'
  | 'connection-failed'
  | 'call-ended';

export type E2eeStatus = 'active' | 'fallback' | 'unavailable';

export interface CallStateData {
  state: CallState;
  roomId: string | null;
  shareUrl: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  e2eeStatus: E2eeStatus;
  safetyNumber: string | null;
  peerVerified: boolean;
  signalingConnected: boolean;
  connectionState: RTCPeerConnectionState | null;
  error: string | null;
  securityWarnings: string[];
}

export interface CallActions {
  createRoom: () => Promise<void>;
  joinRoom: (roomId: string, keyEncoded: string) => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  verifyPeer: () => void;
  endCall: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: CallStateData = {
  state: 'idle',
  roomId: null,
  shareUrl: null,
  localStream: null,
  remoteStream: null,
  audioEnabled: true,
  videoEnabled: true,
  e2eeStatus: 'unavailable',
  safetyNumber: null,
  peerVerified: false,
  signalingConnected: false,
  connectionState: null,
  error: null,
  securityWarnings: [],
};

// ---------------------------------------------------------------------------
// Helper: determine E2EE status
// ---------------------------------------------------------------------------

function determineE2eeStatus(connected: boolean): E2eeStatus {
  const supported = PeerConnection.supportsInsertableStreams();
  if (connected) {
    return supported ? 'active' : 'fallback';
  }
  // Before WebRTC connects, reflect browser capability so the UI can
  // show "E2EE supported" / "E2EE not available" in the waiting room.
  return supported ? 'active' : 'fallback';
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCallState(): [CallStateData, CallActions] {
  const [data, setData] = useState<CallStateData>(INITIAL_STATE);

  // Mutable refs for long-lived objects that must not trigger re-renders
  const signalingRef = useRef<EncryptedSignaling | null>(null);
  const peerConnectionRef = useRef<PeerConnection | null>(null);
  const roomKeyRef = useRef<CryptoKey | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isCreatorRef = useRef(false);
  const localFingerprintRef = useRef<string | null>(null);
  const remoteFingerprintRef = useRef<string | null>(null);

  // Convenience setter that merges partial updates
  const patch = useCallback((partial: Partial<CallStateData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  // -------------------------------------------------------------------
  // Cleanup helper
  // -------------------------------------------------------------------

  const cleanup = useCallback(() => {
    if (signalingRef.current) {
      try {
        signalingRef.current.disconnect();
      } catch {
        // best effort
      }
      signalingRef.current = null;
    }
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {
        // best effort
      }
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      stopMedia(localStreamRef.current);
      localStreamRef.current = null;
    }
    roomKeyRef.current = null;
    localFingerprintRef.current = null;
    remoteFingerprintRef.current = null;
    isCreatorRef.current = false;
  }, []);

  // -------------------------------------------------------------------
  // PeerConnection factory
  // -------------------------------------------------------------------

  const createPeerConnection = useCallback((roomKey: CryptoKey): PeerConnection => {
    const caps = checkBrowserCapabilities();
    const e2eeMode = caps.insertableStreams ? 'strict' : 'compatibility';

    const pc = new PeerConnection({
      roomKey,
      e2eeMode,
      onTrack: (stream: MediaStream) => {
        patch({ remoteStream: stream });
      },
      onIceCandidate: (candidate: RTCIceCandidate) => {
        // Send ICE candidate through signaling
        signalingRef.current?.send('ice-candidate' as SignalingEventType, {
          candidate: candidate.toJSON(),
        }).catch(() => {
          // Ignore send errors for ICE candidates -- non-fatal
        });
      },
      onConnectionStateChange: (state: RTCPeerConnectionState) => {
        patch({ connectionState: state });

        if (state === 'connected') {
          const e2eeStatus = determineE2eeStatus(true);
          patch({
            state: 'connected-unverified',
            e2eeStatus,
          });

          // Compute safety number if both fingerprints are available
          const local = localFingerprintRef.current;
          const remote = remoteFingerprintRef.current;
          if (local && remote) {
            computeSafetyNumber(local, remote)
              .then((safetyNumber) => {
                patch({ safetyNumber });
              })
              .catch(() => {
                patch({
                  securityWarnings: ['Failed to compute safety number'],
                });
              });
          }
        } else if (state === 'failed') {
          patch({
            state: 'connection-failed',
            error: 'WebRTC connection failed',
            e2eeStatus: 'unavailable',
          });
        } else if (state === 'disconnected') {
          // Peer may have temporarily lost connectivity -- not necessarily fatal
          // but worth noting
          patch({
            securityWarnings: ['Peer connection interrupted'],
          });
        } else if (state === 'closed') {
          patch({ e2eeStatus: 'unavailable' });
        }
      },
      onIceConnectionStateChange: (_state: RTCIceConnectionState) => {
        // Tracked via connectionStateChange for simplicity; available for
        // debugging if needed.
      },
      onDtlsFingerprint: (fingerprint: string) => {
        localFingerprintRef.current = fingerprint;
      },
    });

    return pc;
  }, [patch]);

  // -------------------------------------------------------------------
  // Signaling message handler
  // -------------------------------------------------------------------

  const handleSignalingMessage = useCallback(async (msg: SignalingMessage) => {
    const pc = peerConnectionRef.current;

    switch (msg.type) {
      case 'join': {
        // A peer has joined the room
        if (isCreatorRef.current && roomKeyRef.current) {
          // Creator initiates the offer
          patch({ state: 'connecting-webrtc' });

          if (!pc) {
            const newPc = createPeerConnection(roomKeyRef.current);
            peerConnectionRef.current = newPc;

            if (localStreamRef.current) {
              await newPc.setLocalStream(localStreamRef.current);
            }

            const offer = await newPc.createOffer();
            await signalingRef.current?.send('offer' as SignalingEventType, { sdp: offer });
          }
        } else {
          // Joiner: peer connection will be created when we receive the offer
          patch({ state: 'signaling-ready' });
        }
        break;
      }

      case 'offer': {
        // Received an offer -- we are the joiner (answerer)
        patch({ state: 'connecting-webrtc' });

        const sdp = (msg.payload as { sdp: RTCSessionDescriptionInit }).sdp;

        // Extract remote DTLS fingerprint from the offer SDP
        if (sdp.sdp) {
          const match = sdp.sdp.match(/a=fingerprint:\s*(\S+\s+\S+)/);
          if (match) {
            remoteFingerprintRef.current = match[1];
          }
        }

        if (!pc && roomKeyRef.current) {
          const newPc = createPeerConnection(roomKeyRef.current);
          peerConnectionRef.current = newPc;

          if (localStreamRef.current) {
            await newPc.setLocalStream(localStreamRef.current);
          }

          const answer = await newPc.setRemoteOffer(sdp);
          await signalingRef.current?.send('answer' as SignalingEventType, { sdp: answer });
        } else if (pc) {
          const answer = await pc.setRemoteOffer(sdp);
          await signalingRef.current?.send('answer' as SignalingEventType, { sdp: answer });
        }
        break;
      }

      case 'answer': {
        // Received an answer -- we are the creator (offerer)
        const sdp = (msg.payload as { sdp: RTCSessionDescriptionInit }).sdp;

        // Extract remote DTLS fingerprint from the answer SDP
        if (sdp.sdp) {
          const match = sdp.sdp.match(/a=fingerprint:\s*(\S+\s+\S+)/);
          if (match) {
            remoteFingerprintRef.current = match[1];
          }
        }

        if (pc) {
          await pc.setRemoteAnswer(sdp);
        }
        break;
      }

      case 'ice-candidate': {
        const { candidate } = msg.payload as { candidate: RTCIceCandidateInit };
        if (pc && candidate) {
          await pc.addIceCandidate(candidate);
        }
        break;
      }

      case 'leave': {
        // Remote peer left -- end the call
        cleanup();
        patch({
          ...INITIAL_STATE,
          state: 'call-ended',
        });

        // Auto-transition back to idle after a brief delay
        setTimeout(() => {
          patch({ state: 'idle' });
        }, 3000);
        break;
      }

      case 'room-full': {
        patch({
          state: 'connection-failed',
          error: 'Room is full. Only two participants are allowed.',
        });
        cleanup();
        break;
      }

      case 'verification-state': {
        // Peer reports their verification intent -- informational
        break;
      }

      default:
        break;
    }
  }, [patch, createPeerConnection, cleanup]);

  // -------------------------------------------------------------------
  // Signaling factory
  // -------------------------------------------------------------------

  const createSignaling = useCallback((
    roomId: string,
    roomKey: CryptoKey,
  ): EncryptedSignaling => {
    const transport = new WebSocketRelayTransport();

    const signaling = new EncryptedSignaling({
      transport,
      roomKey,
      roomId,
      onMessage: (msg: SignalingMessage) => {
        handleSignalingMessage(msg).catch((err) => {
          const message = err instanceof Error ? err.message : 'Signaling message handling failed';
          patch({ error: message });
        });
      },
      onError: (error: string) => {
        patch({
          error,
          securityWarnings: [error],
        });
      },
      onConnected: () => {
        patch({ signalingConnected: true });
      },
      onDisconnected: () => {
        patch({ signalingConnected: false });
      },
    });

    return signaling;
  }, [handleSignalingMessage, patch]);

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------

  const createRoom = useCallback(async () => {
    try {
      patch({ state: 'creating-room', error: null, securityWarnings: [] });

      // Generate room credentials
      const roomId = generateRoomId();
      const roomKey = await generateRoomKey();
      roomKeyRef.current = roomKey;
      isCreatorRef.current = true;

      // Build the share URL (key is in the hash fragment, never sent to server)
      const shareUrl = await buildShareUrl(roomId, roomKey);

      // Request media
      const stream = await requestMedia(true, true);
      localStreamRef.current = stream;

      // Build and connect signaling
      const signaling = createSignaling(roomId, roomKey);
      signalingRef.current = signaling;
      await signaling.connect();

      // Send join to announce presence
      await signaling.send('join' as SignalingEventType, {});

      // Determine initial E2EE status
      const e2eeStatus = determineE2eeStatus(false);

      patch({
        state: 'waiting-for-peer',
        roomId,
        shareUrl,
        localStream: stream,
        audioEnabled: true,
        videoEnabled: true,
        e2eeStatus,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      patch({
        state: 'connection-failed',
        error: message,
      });
      cleanup();
    }
  }, [patch, createSignaling, cleanup]);

  const joinRoom = useCallback(async (roomId: string, keyEncoded: string) => {
    try {
      patch({ state: 'joining-room', error: null, securityWarnings: [] });

      // Import the room key from the URL fragment
      const roomKey = await importRoomKey(keyEncoded);
      roomKeyRef.current = roomKey;
      isCreatorRef.current = false;

      // Request media
      const stream = await requestMedia(true, true);
      localStreamRef.current = stream;

      // Build and connect signaling
      const signaling = createSignaling(roomId, roomKey);
      signalingRef.current = signaling;
      await signaling.connect();

      // Send join to announce presence
      await signaling.send('join' as SignalingEventType, {});

      // Determine initial E2EE status
      const e2eeStatus = determineE2eeStatus(false);

      patch({
        state: 'signaling-ready',
        roomId,
        shareUrl: null,
        localStream: stream,
        audioEnabled: true,
        videoEnabled: true,
        e2eeStatus,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      patch({
        state: 'connection-failed',
        error: message,
      });
      cleanup();
    }
  }, [patch, createSignaling, cleanup]);

  const handleToggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const enabled = mediaToggleAudio(localStreamRef.current);
      patch({ audioEnabled: enabled });
    }
  }, [patch]);

  const handleToggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const enabled = mediaToggleVideo(localStreamRef.current);
      patch({ videoEnabled: enabled });
    }
  }, [patch]);

  const verifyPeer = useCallback(() => {
    patch({
      state: 'connected-verified',
      peerVerified: true,
    });

    // Notify the peer about verification (best effort)
    signalingRef.current?.send('verification-state' as SignalingEventType, {
      verified: true,
    }).catch(() => {
      // non-fatal
    });
  }, [patch]);

  const endCall = useCallback(() => {
    // Send leave notification before tearing down (best effort)
    signalingRef.current?.send('leave' as SignalingEventType, {}).catch(() => {
      // ignore
    });

    cleanup();

    patch({
      ...INITIAL_STATE,
      state: 'call-ended',
    });

    // Auto-transition back to idle
    setTimeout(() => {
      patch({ state: 'idle' });
    }, 3000);
  }, [patch, cleanup]);

  // -------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // -------------------------------------------------------------------
  // Return value
  // -------------------------------------------------------------------

  const actions: CallActions = {
    createRoom,
    joinRoom,
    toggleAudio: handleToggleAudio,
    toggleVideo: handleToggleVideo,
    verifyPeer,
    endCall,
  };

  return [data, actions];
}
