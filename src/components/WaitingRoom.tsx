/**
 * WaitingRoom — shown while waiting for peer to join.
 */
import { useState } from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SignalWifiStatusbar4BarIcon from '@mui/icons-material/SignalWifiStatusbar4Bar';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CancelIcon from '@mui/icons-material/Cancel';
import VideoElement from './VideoElement';
import type { E2eeStatus } from './types';

interface WaitingRoomProps {
  shareUrl: string;
  localStream: MediaStream | null;
  signalingConnected: boolean;
  e2eeStatus: E2eeStatus;
  onCancel: () => void;
}

function E2eeChip({ status }: { status: E2eeStatus }) {
  switch (status) {
    case 'active':
      return (
        <Chip
          icon={<LockIcon fontSize="small" />}
          label="E2EE Active"
          color="success"
          size="small"
          variant="outlined"
        />
      );
    case 'fallback':
      return (
        <Chip
          icon={<WarningAmberIcon fontSize="small" />}
          label="E2EE Fallback"
          color="warning"
          size="small"
          variant="outlined"
        />
      );
    case 'unavailable':
      return (
        <Chip
          icon={<LockOpenIcon fontSize="small" />}
          label="E2EE Unavailable"
          color="error"
          size="small"
          variant="outlined"
        />
      );
  }
}

export default function WaitingRoom({
  shareUrl,
  localStream,
  signalingConnected,
  e2eeStatus,
  onCancel,
}: WaitingRoomProps) {
  const [snackOpen, setSnackOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSnackOpen(true);
    } catch {
      // Fallback: select the text field
    }
  };

  return (
    <Container
      maxWidth="sm"
      sx={{
        py: 4,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
      }}
    >
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
          <Typography variant="h5" component="h1" fontWeight={700}>
            Room Created
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Share this link with the person you want to call. The encryption key is embedded in
            the URL fragment and is never sent to any server.
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              value={shareUrl}
              fullWidth
              slotProps={{
                input: {
                  readOnly: true,
                  sx: {
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontSize: '0.75rem',
                  },
                },
              }}
            />
            <Tooltip title="Copy link">
              <IconButton onClick={handleCopy} color="primary" size="large">
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <E2eeChip status={e2eeStatus} />
            <Chip
              icon={
                signalingConnected ? (
                  <SignalWifiStatusbar4BarIcon fontSize="small" />
                ) : (
                  <SignalWifiOffIcon fontSize="small" />
                )
              }
              label={signalingConnected ? 'Signaling Connected' : 'Signaling Disconnected'}
              color={signalingConnected ? 'success' : 'error'}
              size="small"
              variant="outlined"
            />
          </Stack>

          <Alert severity="info">
            Waiting for peer to join. Share the link above and keep this page open.
          </Alert>

          <LinearProgress sx={{ borderRadius: 2 }} />

          {localStream && (
            <Card sx={{ overflow: 'hidden' }}>
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <VideoElement
                  stream={localStream}
                  muted
                  mirror
                  style={{
                    width: '100%',
                    height: 240,
                    borderRadius: 12,
                  }}
                />
              </CardContent>
            </Card>
          )}

          <Button
            variant="outlined"
            color="error"
            startIcon={<CancelIcon />}
            onClick={onCancel}
            fullWidth
          >
            Cancel
          </Button>
        </Stack>
      </Paper>

      <Snackbar
        open={snackOpen}
        autoHideDuration={2500}
        onClose={() => setSnackOpen(false)}
        message="Link copied!"
      />
    </Container>
  );
}

export { E2eeChip };
