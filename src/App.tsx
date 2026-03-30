/**
 * App — root component that orchestrates call state and renders the appropriate screen.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import { createAppTheme } from './theme';
import {
  BrowserCheck,
  LandingScreen,
  WaitingRoom,
  CallScreen,
  VerificationDialog,
  SecurityPanel,
} from './components';
import { useCallState } from './hooks/useCallState';
import { parseHashParams, scrubHash } from './crypto/keys';

export default function App() {
  const [callData, callActions] = useCallState();
  const [browserCheckDone, setBrowserCheckDone] = useState(false);
  const [securityDialogOpen, setSecurityDialogOpen] = useState(false);
  const [securityPanelOpen, setSecurityPanelOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [pendingJoin, setPendingJoin] = useState<{ roomId: string; key: string } | null>(null);

  const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);

  // Check for hash params on mount
  useEffect(() => {
    const params = parseHashParams();
    if (params) {
      scrubHash();
      setPendingJoin(params);
    }
  }, []);

  // Auto-join after browser check if we have pending params
  useEffect(() => {
    if (browserCheckDone && pendingJoin && callData.state === 'idle') {
      callActions.joinRoom(pendingJoin.roomId, pendingJoin.key);
      setPendingJoin(null);
    }
  }, [browserCheckDone, pendingJoin, callData.state, callActions]);

  const handleJoinRoom = useCallback(
    (roomId: string, key: string) => {
      if (browserCheckDone) {
        callActions.joinRoom(roomId, key);
      } else {
        setPendingJoin({ roomId, key });
      }
    },
    [browserCheckDone, callActions],
  );

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Determine what to render
  const renderContent = () => {
    if (!browserCheckDone) {
      return <BrowserCheck onContinue={() => setBrowserCheckDone(true)} />;
    }

    switch (callData.state) {
      case 'idle':
        return (
          <LandingScreen
            onCreateRoom={callActions.createRoom}
            onJoinRoom={handleJoinRoom}
          />
        );

      case 'creating-room':
      case 'waiting-for-peer':
        return (
          <WaitingRoom
            shareUrl={callData.shareUrl ?? ''}
            localStream={callData.localStream}
            signalingConnected={callData.signalingConnected}
            e2eeStatus={callData.e2eeStatus}
            onCancel={callActions.endCall}
          />
        );

      case 'joining-room':
      case 'signaling-ready':
      case 'connecting-webrtc':
        return (
          <Container
            maxWidth="sm"
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Paper sx={{ p: 5, width: '100%', textAlign: 'center' }}>
              <Stack spacing={3} alignItems="center">
                <CircularProgress size={48} />
                <Typography variant="h6" fontWeight={600}>
                  {callData.state === 'joining-room'
                    ? 'Joining Room...'
                    : callData.state === 'signaling-ready'
                      ? 'Signaling Ready'
                      : 'Establishing WebRTC Connection...'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Setting up encrypted connection with your peer.
                </Typography>
                <LinearProgress sx={{ width: '100%' }} />
                <Button variant="outlined" color="error" onClick={callActions.endCall}>
                  Cancel
                </Button>
              </Stack>
            </Paper>
          </Container>
        );

      case 'connected-unverified':
      case 'connected-verified':
        return (
          <CallScreen
            localStream={callData.localStream}
            remoteStream={callData.remoteStream}
            audioEnabled={callData.audioEnabled}
            videoEnabled={callData.videoEnabled}
            e2eeStatus={callData.e2eeStatus}
            peerVerified={callData.peerVerified}
            connectionState={callData.connectionState}
            safetyNumber={callData.safetyNumber}
            onToggleAudio={callActions.toggleAudio}
            onToggleVideo={callActions.toggleVideo}
            onEndCall={callActions.endCall}
            onOpenSecurity={() => setSecurityDialogOpen(true)}
          />
        );

      case 'security-warning':
        return (
          <Container
            maxWidth="sm"
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Paper sx={{ p: 4, width: '100%' }}>
              <Stack spacing={3}>
                <Typography variant="h5" fontWeight={700} color="warning.main">
                  Security Warning
                </Typography>
                {callData.securityWarnings.map((warning, i) => (
                  <Alert key={i} severity="warning">
                    {warning}
                  </Alert>
                ))}
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={callActions.endCall}
                    fullWidth
                  >
                    End Call
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Container>
        );

      case 'connection-failed':
        return (
          <Container
            maxWidth="sm"
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Paper sx={{ p: 4, width: '100%' }}>
              <Stack spacing={3} alignItems="center" textAlign="center">
                <Typography variant="h5" fontWeight={700} color="error.main">
                  Connection Failed
                </Typography>
                <Alert severity="error" sx={{ width: '100%' }}>
                  {callData.error ?? 'Failed to establish a peer-to-peer connection.'}
                </Alert>
                <Typography variant="body2" color="text.secondary">
                  This can happen if one or both peers are behind strict firewalls or symmetric
                  NATs. No TURN relay server is configured.
                </Typography>
                <Button variant="contained" onClick={callActions.endCall} fullWidth>
                  Return Home
                </Button>
              </Stack>
            </Paper>
          </Container>
        );

      case 'call-ended':
        return (
          <Container
            maxWidth="sm"
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Paper sx={{ p: 4, width: '100%' }}>
              <Stack spacing={3} alignItems="center" textAlign="center">
                <Typography variant="h5" fontWeight={700}>
                  Call Ended
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The encrypted session has been terminated and all keys discarded.
                </Typography>
                <Button variant="contained" onClick={callActions.endCall} fullWidth>
                  Return Home
                </Button>
              </Stack>
            </Paper>
          </Container>
        );

      default:
        return null;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Theme toggle — small floating button, shown outside of call */}
        {callData.state !== 'connected-unverified' &&
          callData.state !== 'connected-verified' && (
            <Box
              sx={{
                position: 'fixed',
                top: 12,
                right: 16,
                zIndex: 1300,
              }}
            >
              <Button
                size="small"
                variant="text"
                onClick={toggleTheme}
                sx={{
                  minHeight: 36,
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  textTransform: 'none',
                }}
              >
                {themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </Button>
            </Box>
          )}

        {renderContent()}
      </Box>

      {/* Error snackbar */}
      <Snackbar
        open={!!callData.error && callData.state !== 'connection-failed'}
        autoHideDuration={6000}
      >
        <Alert severity="error" variant="filled" sx={{ width: '100%' }}>
          {callData.error}
        </Alert>
      </Snackbar>

      {/* Verification dialog */}
      <VerificationDialog
        open={securityDialogOpen}
        safetyNumber={callData.safetyNumber}
        peerVerified={callData.peerVerified}
        onVerify={() => {
          callActions.verifyPeer();
          setSecurityDialogOpen(false);
        }}
        onClose={() => setSecurityDialogOpen(false)}
      />

      {/* Security panel drawer */}
      <Drawer
        anchor="right"
        open={securityPanelOpen}
        onClose={() => setSecurityPanelOpen(false)}
      >
        <SecurityPanel
          e2eeStatus={callData.e2eeStatus}
          peerVerified={callData.peerVerified}
          safetyNumber={callData.safetyNumber}
        />
      </Drawer>
    </ThemeProvider>
  );
}
