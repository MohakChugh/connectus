# ConnectUs - Secure Serverless WebRTC Video Calls

A frontend-only, zero-custom-backend, end-to-end encrypted video call application built with React and Material UI. Deployed as a static site on GitHub Pages.

> **Security disclaimer:** This app is designed for strong browser-based end-to-end confidentiality and integrity with no custom backend, but no client-side application can guarantee absolute security under all threat models.

## Features

- **End-to-end encrypted signaling** over an untrusted WebSocket relay (AES-GCM-256)
- **WebRTC Insertable Streams** for application-layer frame encryption
- **Safety number verification** (Signal-style) for peer identity confirmation
- **Two-party enforcement** - rooms are locked to exactly two participants
- **Replay protection** on all signaling messages
- **No backend, no database, no analytics, no trackers**
- **Room key stays in URL hash fragment** - never sent to any server
- Built with React + Material UI with a security-focused dark theme

## Security Model

### Threat Model

The signaling layer (WebSocket relay) is treated as **fully untrusted**. We assume:
- The relay may observe, replay, reorder, drop, or tamper with messages
- The relay may be malicious

The app maintains confidentiality and integrity despite a hostile signaling path.

### How Encrypted Signaling Works

1. When a room is created, a 256-bit AES-GCM key is generated using `crypto.subtle.generateKey`
2. The key is placed in the URL hash fragment (`#roomId=...&key=...`), which browsers never send to servers
3. After parsing, the hash is immediately scrubbed from the URL bar via `history.replaceState`
4. All signaling messages (SDP offers/answers, ICE candidates) are encrypted with AES-GCM before transmission
5. Each message gets a fresh 96-bit IV to prevent nonce reuse
6. Messages include timestamps and unique IDs for replay protection
7. Decryption failures abort connection setup and display a security warning

### Why URL Hash?

URL hash fragments (`#...`) are defined in RFC 3986 as client-only. Browsers do not include the fragment in HTTP requests, so the room key never leaves the browser even when the URL is shared via the address bar.

### WebRTC Transport Security

- **DTLS** secures the WebRTC handshake
- **SRTP** encrypts media in transit
- **ICE with STUN** for NAT traversal (using Google's public STUN servers)
- **No TURN server** is included (no backend to operate one)

### Insertable Streams (Frame-Level E2EE)

When the browser supports `RTCRtpScriptTransform` (Chromium-based browsers), the app applies application-layer AES-GCM encryption to every encoded media frame:

- A Web Worker encrypts outgoing frames and decrypts incoming frames
- Each frame gets a unique IV (4-byte salt + 8-byte counter)
- This provides end-to-end encryption independent of SRTP

If Insertable Streams is unsupported:
- **Strict mode** (default): refuses the call entirely
- **Compatibility mode**: allows DTLS/SRTP-only, marked as lower assurance

### Safety Numbers

A Signal-style safety number is computed from both peers' DTLS fingerprints:
1. Fingerprints are sorted lexicographically (so both sides get the same result)
2. Concatenated and hashed with SHA-256
3. Formatted as 12 groups of 5 digits (60 digits total)

Users should compare safety numbers over a separate trusted channel (phone call, in-person, trusted messaging) to confirm they are connected to the expected peer and not a MitM.

### Two-Party Enforcement

Rooms support exactly two participants. After two sender IDs are observed, the room locks and rejects messages from any third sender. Note: without a backend authority, this is enforced cooperatively at the clients.

## Limitations

Be honest about what this app **cannot** protect against:

- **Compromised endpoints**: malware on either device can capture media directly
- **Malicious browser extensions**: extensions with appropriate permissions can read page content
- **Screen recording**: OS-level screen capture cannot be prevented
- **Compromised GitHub account**: if the hosting account is compromised, malicious code could be served
- **Supply-chain attacks**: compromised npm packages could introduce vulnerabilities
- **XSS from future code changes**: any modification must maintain the security invariants
- **No TURN relay**: calls may fail behind restrictive firewalls/NATs
- **Clock skew**: replay protection depends on approximate clock synchronization
- **Side-channel attacks**: timing analysis of encrypted traffic patterns is possible

## Browser Compatibility

| Feature | Chrome/Edge | Firefox | Safari |
|---------|------------|---------|--------|
| WebRTC | Yes | Yes | Yes |
| Web Crypto | Yes | Yes | Yes |
| Insertable Streams | Yes | No | No |
| Full E2EE | Yes | Fallback only | Fallback only |

A Chromium-based browser is recommended for full application-layer E2EE.

## Tech Stack

- **React** - UI framework
- **Material UI (MUI)** - Component library
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Web Crypto API** - All cryptographic operations
- **WebRTC** - Peer-to-peer media
- **PieSocket** - Default signaling relay (untrusted, encrypted-only transport)

### Dependencies

| Package | Purpose |
|---------|---------|
| react, react-dom | UI framework |
| @mui/material | Component library |
| @mui/icons-material | Icon set |
| @emotion/react, @emotion/styled | MUI styling engine |

No other runtime dependencies. No analytics. No trackers.

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment to GitHub Pages

The app includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys on push to `main`.

### Manual setup

1. Create a GitHub repository
2. Push code to `main`
3. Go to Settings > Pages > Source: "GitHub Actions"
4. The workflow will build and deploy automatically

### Vite base path

The `vite.config.ts` sets `base: '/connectus/'` to match the repository name. If you rename the repo, update this value.

## Architecture

```
src/
  App.tsx              # Main app component + state machine router
  theme.ts             # Custom MUI dark/light theme
  main.tsx             # Entry point
  crypto/              # Web Crypto operations
    keys.ts            # Key generation, import/export, URL hash handling
    signaling-crypto.ts # AES-GCM encrypt/decrypt for signaling
    replay-protection.ts # Replay detection
    safety-number.ts   # Safety number computation
  signaling/           # Encrypted signaling layer
    transport.ts       # Transport interface
    websocket-relay.ts # WebSocket relay implementation
    encrypted-signaling.ts # High-level encrypted signaling
  webrtc/              # WebRTC peer connection management
    peer-connection.ts # RTCPeerConnection lifecycle
    media.ts           # Media device utilities
  workers/             # Web Workers
    frame-crypto-worker.ts # Insertable Streams frame encryption
  hooks/               # React hooks
    useCallState.ts    # Call state machine + lifecycle management
  components/          # MUI UI components
    BrowserCheck.tsx
    LandingScreen.tsx
    WaitingRoom.tsx
    CallScreen.tsx
    VideoElement.tsx
    VerificationDialog.tsx
    SecurityPanel.tsx
  utils/
    browser-checks.ts  # Browser capability detection
```

## License

MIT
