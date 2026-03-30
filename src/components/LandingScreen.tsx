/**
 * LandingScreen — main landing page with hero and call-to-action buttons.
 */
import { useEffect, useMemo } from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import LockIcon from '@mui/icons-material/Lock';
import VideocamIcon from '@mui/icons-material/Videocam';
import LinkIcon from '@mui/icons-material/Link';
import ShieldIcon from '@mui/icons-material/Shield';
import { parseHashParams, scrubHash } from '../crypto/keys';

interface LandingScreenProps {
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string, key: string) => void;
}

export default function LandingScreen({ onCreateRoom, onJoinRoom }: LandingScreenProps) {
  const hashParams = useMemo(() => parseHashParams(), []);

  useEffect(() => {
    if (hashParams) {
      scrubHash();
      onJoinRoom(hashParams.roomId, hashParams.key);
    }
  }, [hashParams, onJoinRoom]);

  return (
    <Stack sx={{ height: '100%', width: '100%' }}>
      <AppBar position="static">
        <Toolbar>
          <LockIcon sx={{ mr: 1.5, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            ConnectUs
          </Typography>
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="sm"
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Paper
          sx={{
            p: { xs: 3, sm: 5 },
            width: '100%',
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'linear-gradient(180deg, rgba(18,24,32,0.95) 0%, rgba(10,14,20,0.98) 100%)'
                : undefined,
          }}
        >
          <Stack spacing={4} alignItems="center" textAlign="center">
            <Stack spacing={1} alignItems="center">
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="center"
                spacing={1}
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: 'rgba(79,195,247,0.1)',
                  border: '1px solid rgba(79,195,247,0.2)',
                  mb: 1,
                }}
              >
                <ShieldIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              </Stack>
              <Typography variant="h4" component="h1">
                Secure, encrypted video calls with no backend
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 440 }}>
                Peer-to-peer WebRTC with end-to-end encryption. The room key never leaves your
                browser — it lives only in the URL fragment.
              </Typography>
            </Stack>

            <Divider flexItem />

            <Stack spacing={2} sx={{ width: '100%' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<VideocamIcon />}
                onClick={onCreateRoom}
                fullWidth
              >
                Create Private Room
              </Button>

              {!hashParams && (
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<LinkIcon />}
                  fullWidth
                  disabled
                  sx={{ opacity: 0.7 }}
                >
                  Join via Shared Link
                </Button>
              )}
            </Stack>

            <Alert severity="info" sx={{ textAlign: 'left', width: '100%' }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Security Notice
              </Typography>
              <Typography variant="body2">
                This is an experimental project. While it uses strong encryption primitives
                (AES-GCM, DTLS/SRTP, Insertable Streams), it has not undergone a professional
                security audit. Do not rely on it for situations where a security failure could
                cause serious harm. The signaling server sees encrypted payloads but can observe
                connection metadata (IP addresses, timing).
              </Typography>
            </Alert>
          </Stack>
        </Paper>
      </Container>
    </Stack>
  );
}
