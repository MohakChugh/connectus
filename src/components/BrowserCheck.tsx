/**
 * BrowserCheck — renders a compatibility checklist on app startup.
 */
import { useMemo } from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import {
  checkBrowserCapabilities,
  isCriticalCapabilityMissing,
  getMissingCapabilityMessages,
} from '../utils/browser-checks';

interface BrowserCheckProps {
  onContinue: () => void;
}

interface CapabilityRow {
  label: string;
  supported: boolean;
  critical: boolean;
}

export default function BrowserCheck({ onContinue }: BrowserCheckProps) {
  const caps = useMemo(() => checkBrowserCapabilities(), []);
  const criticalMissing = isCriticalCapabilityMissing(caps);
  const messages = getMissingCapabilityMessages(caps);

  const rows: CapabilityRow[] = [
    { label: 'Secure Context (HTTPS)', supported: caps.secureContext, critical: true },
    { label: 'Web Crypto API', supported: caps.cryptoSubtle, critical: true },
    { label: 'WebRTC', supported: caps.rtcPeerConnection, critical: true },
    { label: 'Camera & Microphone', supported: caps.getUserMedia, critical: true },
    { label: 'Insertable Streams (E2EE)', supported: caps.insertableStreams, critical: false },
    { label: 'Web Workers', supported: caps.workers, critical: false },
  ];

  return (
    <Container maxWidth="sm" sx={{ py: 6, height: '100%', display: 'flex', alignItems: 'center' }}>
      <Paper
        sx={{
          p: { xs: 3, sm: 4 },
          width: '100%',
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(18,24,32,0.95) 0%, rgba(10,14,20,0.98) 100%)'
              : undefined,
        }}
      >
        <Stack spacing={3}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <ShieldOutlinedIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h5" component="h1">
              Compatibility Check
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            ConnectUs requires certain browser features to provide secure, encrypted video calls.
          </Typography>

          <LinearProgress
            variant="determinate"
            value={(rows.filter((r) => r.supported).length / rows.length) * 100}
            color={criticalMissing ? 'error' : 'success'}
            sx={{ height: 6, borderRadius: 3 }}
          />

          <Stack spacing={1}>
            {rows.map((row) => (
              <Stack
                key={row.label}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: row.supported
                    ? 'rgba(102,187,106,0.06)'
                    : row.critical
                      ? 'rgba(239,83,80,0.06)'
                      : 'rgba(255,167,38,0.06)',
                }}
              >
                <Typography variant="body2" fontWeight={500}>
                  {row.label}
                </Typography>
                <Chip
                  label={row.supported ? 'Supported' : 'Missing'}
                  size="small"
                  icon={
                    row.supported ? (
                      <CheckCircleIcon fontSize="small" />
                    ) : (
                      <CancelIcon fontSize="small" />
                    )
                  }
                  color={row.supported ? 'success' : row.critical ? 'error' : 'warning'}
                  variant="outlined"
                />
              </Stack>
            ))}
          </Stack>

          {criticalMissing && (
            <Alert severity="error">
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Critical capabilities are missing
              </Typography>
              {messages
                .filter((_, i) => {
                  const r = rows[i];
                  return r && r.critical && !r.supported;
                })
                .map((msg, i) => (
                  <Typography key={i} variant="body2">
                    {msg}
                  </Typography>
                ))}
            </Alert>
          )}

          {!caps.insertableStreams && !criticalMissing && (
            <Alert severity="warning">
              Insertable Streams is not available. Calls will still use DTLS/SRTP transport
              encryption, but end-to-end frame-level encryption will not be active. For maximum
              security, use a Chromium-based browser.
            </Alert>
          )}

          <Button
            variant="contained"
            size="large"
            disabled={criticalMissing}
            onClick={onContinue}
            fullWidth
          >
            {criticalMissing ? 'Cannot Continue' : 'Continue'}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
