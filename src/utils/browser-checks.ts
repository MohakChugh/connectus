/**
 * Browser capability detection for the secure video call app.
 */

export interface BrowserCapabilities {
  secureContext: boolean;
  cryptoSubtle: boolean;
  rtcPeerConnection: boolean;
  getUserMedia: boolean;
  insertableStreams: boolean;
  workers: boolean;
}

/**
 * Detect which browser capabilities are available.
 */
export function checkBrowserCapabilities(): BrowserCapabilities {
  const isSecure = typeof window !== 'undefined' && window.isSecureContext === true;

  return {
    secureContext: isSecure,
    cryptoSubtle: isSecure && typeof crypto !== 'undefined' && crypto.subtle != null,
    rtcPeerConnection: typeof window !== 'undefined' && 'RTCPeerConnection' in window,
    getUserMedia:
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices != null &&
      typeof navigator.mediaDevices.getUserMedia === 'function',
    insertableStreams: typeof window !== 'undefined' && 'RTCRtpScriptTransform' in window,
    workers: typeof window !== 'undefined' && typeof Worker !== 'undefined',
  };
}

/**
 * Returns true if any critical capability is missing.
 * Critical capabilities: secureContext, cryptoSubtle, rtcPeerConnection, getUserMedia.
 */
export function isCriticalCapabilityMissing(caps: BrowserCapabilities): boolean {
  return (
    !caps.secureContext ||
    !caps.cryptoSubtle ||
    !caps.rtcPeerConnection ||
    !caps.getUserMedia
  );
}

/**
 * Return human-readable messages describing each missing capability.
 */
export function getMissingCapabilityMessages(caps: BrowserCapabilities): string[] {
  const messages: string[] = [];

  if (!caps.secureContext) {
    messages.push(
      'A secure context (HTTPS) is required. Please access this page over HTTPS.',
    );
  }

  if (!caps.cryptoSubtle) {
    messages.push(
      'The Web Crypto API is not available. A secure context (HTTPS) is required for cryptographic operations.',
    );
  }

  if (!caps.rtcPeerConnection) {
    messages.push(
      'WebRTC is not supported by this browser. Please use a modern browser such as Chrome, Firefox, or Safari.',
    );
  }

  if (!caps.getUserMedia) {
    messages.push(
      'Camera and microphone access is not available. Please use a browser that supports getUserMedia.',
    );
  }

  if (!caps.insertableStreams) {
    messages.push(
      'Insertable Streams (RTCRtpScriptTransform) is not supported. End-to-end frame encryption will not be available. A Chromium-based browser is recommended.',
    );
  }

  if (!caps.workers) {
    messages.push(
      'Web Workers are not supported. Encryption processing requires Worker support.',
    );
  }

  return messages;
}
