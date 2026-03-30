/**
 * RTCPeerConnection lifecycle manager with optional Insertable Streams E2EE.
 */

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface PeerConnectionConfig {
  onTrack: (stream: MediaStream) => void;
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange: (state: RTCIceConnectionState) => void;
  onDtlsFingerprint: (fingerprint: string) => void;
  roomKey?: CryptoKey;
  e2eeMode: 'strict' | 'compatibility';
}

export class PeerConnection {
  private pc: RTCPeerConnection;
  private encryptWorker: Worker | null = null;
  private decryptWorker: Worker | null = null;
  private localStream: MediaStream | null = null;
  private config: PeerConnectionConfig;

  constructor(config: PeerConnectionConfig) {
    this.config = config;

    const rtcConfig: RTCConfiguration = {
      iceServers: ICE_SERVERS,
      // @ts-ignore - encodedInsertableStreams is a non-standard Chrome property
      encodedInsertableStreams: this.shouldUseInsertableStreams(),
    };

    this.pc = new RTCPeerConnection(rtcConfig);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        config.onIceCandidate(event.candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      config.onConnectionStateChange(this.pc.connectionState);
    };

    this.pc.oniceconnectionstatechange = () => {
      config.onIceConnectionStateChange(this.pc.iceConnectionState);
    };

    this.pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        if (this.shouldUseInsertableStreams() && this.config.roomKey) {
          this.applyDecryptTransform(event.receiver);
        }
        config.onTrack(stream);
      }
    };
  }

  /**
   * Check if the current browser supports RTCRtpScriptTransform (Insertable Streams).
   */
  static supportsInsertableStreams(): boolean {
    return typeof window !== 'undefined' && 'RTCRtpScriptTransform' in window;
  }

  /**
   * Add the local media stream. Tracks are added to the peer connection,
   * with encryption transforms applied if Insertable Streams is enabled.
   */
  async setLocalStream(stream: MediaStream): Promise<void> {
    this.localStream = stream;

    for (const track of stream.getTracks()) {
      const sender = this.pc.addTrack(track, stream);

      if (this.shouldUseInsertableStreams() && this.config.roomKey) {
        this.applyEncryptTransform(sender);
      }
    }
  }

  /**
   * Create an SDP offer.
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this.emitDtlsFingerprint(offer.sdp);

    return offer;
  }

  /**
   * Set a remote SDP offer and generate an answer.
   */
  async setRemoteOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.emitDtlsFingerprint(answer.sdp);

    return answer;
  }

  /**
   * Set a remote SDP answer.
   */
  async setRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  /**
   * Add a remote ICE candidate.
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  /**
   * Extract the DTLS fingerprint from the local SDP, if available.
   */
  getDtlsFingerprint(): string | null {
    const sdp = this.pc.localDescription?.sdp;
    if (!sdp) return null;
    return this.parseDtlsFingerprint(sdp);
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  getIceConnectionState(): RTCIceConnectionState {
    return this.pc.iceConnectionState;
  }

  /**
   * Close the peer connection and release all resources.
   */
  close(): void {
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    this.pc.close();

    if (this.encryptWorker) {
      this.encryptWorker.terminate();
      this.encryptWorker = null;
    }

    if (this.decryptWorker) {
      this.decryptWorker.terminate();
      this.decryptWorker = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private shouldUseInsertableStreams(): boolean {
    if (this.config.e2eeMode === 'strict') {
      return PeerConnection.supportsInsertableStreams();
    }
    // compatibility mode: use if available, otherwise skip
    return PeerConnection.supportsInsertableStreams();
  }

  private createCryptoWorker(mode: 'encrypt' | 'decrypt'): Worker {
    const worker = new Worker(
      new URL('../workers/frame-crypto-worker.ts', import.meta.url),
      { type: 'module' },
    );

    if (this.config.roomKey) {
      worker.postMessage({ type: 'setup', key: this.config.roomKey, mode });
    }

    worker.onerror = () => {
      // Silently handle worker errors - do not leak information
    };

    return worker;
  }

  private applyEncryptTransform(sender: RTCRtpSender): void {
    if (!this.encryptWorker) {
      this.encryptWorker = this.createCryptoWorker('encrypt');
    }

    try {
      // @ts-ignore - RTCRtpScriptTransform may not be in TypeScript lib
      sender.transform = new RTCRtpScriptTransform(this.encryptWorker, { mode: 'encrypt' });
    } catch {
      if (this.config.e2eeMode === 'strict') {
        throw new Error('Insertable Streams E2EE is required but not supported');
      }
    }
  }

  private applyDecryptTransform(receiver: RTCRtpReceiver): void {
    if (!this.decryptWorker) {
      this.decryptWorker = this.createCryptoWorker('decrypt');
    }

    try {
      // @ts-ignore - RTCRtpScriptTransform may not be in TypeScript lib
      receiver.transform = new RTCRtpScriptTransform(this.decryptWorker, { mode: 'decrypt' });
    } catch {
      if (this.config.e2eeMode === 'strict') {
        throw new Error('Insertable Streams E2EE is required but not supported');
      }
    }
  }

  private parseDtlsFingerprint(sdp: string): string | null {
    const match = sdp.match(/a=fingerprint:\s*(\S+\s+\S+)/);
    return match ? match[1] : null;
  }

  private emitDtlsFingerprint(sdp: string | undefined): void {
    if (!sdp) return;
    const fingerprint = this.parseDtlsFingerprint(sdp);
    if (fingerprint) {
      this.config.onDtlsFingerprint(fingerprint);
    }
  }
}
