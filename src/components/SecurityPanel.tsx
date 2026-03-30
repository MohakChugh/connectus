/**
 * SecurityPanel — Accordion-based breakdown of security properties.
 */
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LockIcon from '@mui/icons-material/Lock';
import ShieldIcon from '@mui/icons-material/Shield';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { E2eeStatus } from './types';
import { monoFontFamily } from '../theme';

interface SecurityPanelProps {
  e2eeStatus: E2eeStatus;
  peerVerified: boolean;
  safetyNumber: string | null;
}

function statusColor(status: E2eeStatus): 'success' | 'warning' | 'error' {
  switch (status) {
    case 'active':
      return 'success';
    case 'fallback':
      return 'warning';
    case 'unavailable':
      return 'error';
  }
}

function statusLabel(status: E2eeStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'fallback':
      return 'Fallback (DTLS/SRTP only)';
    case 'unavailable':
      return 'Unavailable';
  }
}

export default function SecurityPanel({
  e2eeStatus,
  peerVerified,
  safetyNumber,
}: SecurityPanelProps) {
  return (
    <Stack spacing={1} sx={{ p: 2, width: { xs: 320, sm: 400 } }}>
      <Typography variant="h6" fontWeight={700} sx={{ px: 1, pb: 1 }}>
        Security Details
      </Typography>

      <Divider />

      {/* 1. Signaling Encryption */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <LockIcon fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography fontWeight={600}>Signaling Encryption</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary">
            All signaling messages (SDP offers, answers, ICE candidates) are encrypted with
            AES-256-GCM using the shared room key before being sent through the signaling
            server. The signaling server only sees encrypted ciphertext and connection metadata.
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* 2. Transport Security */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ShieldIcon fontSize="small" sx={{ color: 'success.main' }} />
            <Typography fontWeight={600}>Transport Security</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary">
            WebRTC mandates DTLS for key exchange and SRTP for media encryption on all peer
            connections. This provides transport-layer encryption between browsers, independent
            of any application-layer encryption. Even without Insertable Streams, your media is
            encrypted in transit.
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* 3. End-to-End Frame Encryption */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <LockIcon fontSize="small" sx={{ color: `${statusColor(e2eeStatus)}.main` }} />
            <Typography fontWeight={600}>End-to-End Frame Encryption</Typography>
            <Chip
              label={statusLabel(e2eeStatus)}
              color={statusColor(e2eeStatus)}
              size="small"
              variant="outlined"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              When supported (Chromium-based browsers), Insertable Streams encrypts each media
              frame with AES-256-GCM using the shared room key before SRTP encryption. This
              means even if DTLS were compromised, the media content would remain encrypted.
            </Typography>
            {e2eeStatus === 'active' && (
              <Alert severity="success">
                Frame-level E2EE is active. Each audio and video frame is individually encrypted.
              </Alert>
            )}
            {e2eeStatus === 'fallback' && (
              <Alert severity="warning">
                Insertable Streams is not supported in this browser. Falling back to DTLS/SRTP
                transport encryption only. For frame-level E2EE, use Chrome or Edge.
              </Alert>
            )}
            {e2eeStatus === 'unavailable' && (
              <Alert severity="error">
                End-to-end frame encryption is unavailable. Only DTLS/SRTP transport encryption
                is active.
              </Alert>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* 4. Safety Number */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <VerifiedUserIcon
              fontSize="small"
              sx={{ color: peerVerified ? 'success.main' : 'warning.main' }}
            />
            <Typography fontWeight={600}>Safety Number</Typography>
            <Chip
              label={peerVerified ? 'Verified' : 'Unverified'}
              color={peerVerified ? 'success' : 'warning'}
              size="small"
              variant="outlined"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              The safety number is derived from the DTLS fingerprints of both peers. If both
              participants see the same safety number, it confirms that no man-in-the-middle has
              intercepted the DTLS handshake.
            </Typography>
            {safetyNumber && (
              <Paper
                sx={{
                  p: 2,
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(79,195,247,0.04)'
                      : 'rgba(79,195,247,0.06)',
                  border: '1px solid rgba(79,195,247,0.15)',
                  textAlign: 'center',
                }}
              >
                <Typography
                  component="pre"
                  sx={{
                    fontFamily: monoFontFamily,
                    fontSize: '0.8rem',
                    letterSpacing: '0.06em',
                    whiteSpace: 'pre-wrap',
                    m: 0,
                  }}
                >
                  {safetyNumber}
                </Typography>
              </Paper>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* 5. Architecture */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ArchitectureIcon fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography fontWeight={600}>Architecture</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              ConnectUs uses a peer-to-peer architecture with no custom backend for media relay.
              The encryption key is shared via the URL hash fragment, which is never sent to any
              server (per the HTTP specification). A lightweight signaling server relays only
              encrypted connection setup messages.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              STUN servers (Google) are used for NAT traversal. No TURN (relay) servers are
              configured, so calls may fail on very restrictive networks.
            </Typography>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* 6. Limitations */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <WarningAmberIcon fontSize="small" sx={{ color: 'warning.main' }} />
            <Typography fontWeight={600}>Limitations</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary" component="div">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>
                  This project has not undergone a professional security audit.
                </li>
                <li>
                  The signaling server can observe connection metadata (IP addresses, timing,
                  room IDs) even though message content is encrypted.
                </li>
                <li>
                  If the URL (including hash fragment) is intercepted, the encryption key is
                  compromised. Share the link over a trusted channel.
                </li>
                <li>
                  Browser extensions or compromised browsers could read the key from memory.
                </li>
                <li>
                  No forward secrecy: the same key is used for the duration of the session.
                </li>
                <li>
                  Without TURN servers, calls may fail behind strict firewalls or symmetric NATs.
                </li>
                <li>
                  Safety number verification depends on comparing over a separate trusted
                  channel; it cannot protect against a compromised browser.
                </li>
              </ul>
            </Typography>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ mt: 1 }} />

      {/* Security disclaimer */}
      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mt: 1 }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Security Disclaimer
        </Typography>
        <Typography variant="body2">
          ConnectUs is an experimental project demonstrating WebRTC encryption techniques. While
          it uses strong cryptographic primitives, it has not been audited and should not be
          relied upon in situations where a security failure could cause serious harm.
        </Typography>
      </Alert>
    </Stack>
  );
}
