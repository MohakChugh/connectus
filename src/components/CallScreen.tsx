/**
 * CallScreen — the main in-call view with video, controls, and status.
 */
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Badge from '@mui/material/Badge';
import Divider from '@mui/material/Divider';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import ShieldIcon from '@mui/icons-material/Shield';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import LockIcon from '@mui/icons-material/Lock';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import VideoElement from './VideoElement';
import type { E2eeStatus } from './types';

interface CallScreenProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  e2eeStatus: E2eeStatus;
  peerVerified: boolean;
  connectionState: RTCPeerConnectionState | null;
  safetyNumber: string | null;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  onOpenSecurity: () => void;
}

function connectionLabel(state: RTCPeerConnectionState | null): {
  label: string;
  color: 'success' | 'warning' | 'error' | 'default';
} {
  switch (state) {
    case 'connected':
      return { label: 'Connected', color: 'success' };
    case 'connecting':
      return { label: 'Connecting', color: 'warning' };
    case 'disconnected':
      return { label: 'Disconnected', color: 'error' };
    case 'failed':
      return { label: 'Failed', color: 'error' };
    case 'closed':
      return { label: 'Closed', color: 'error' };
    case 'new':
      return { label: 'Initializing', color: 'default' };
    default:
      return { label: 'Unknown', color: 'default' };
  }
}

function e2eeLabel(status: E2eeStatus): {
  label: string;
  color: 'success' | 'warning' | 'error';
} {
  switch (status) {
    case 'active':
      return { label: 'E2EE Active', color: 'success' };
    case 'fallback':
      return { label: 'E2EE Fallback', color: 'warning' };
    case 'unavailable':
      return { label: 'No E2EE', color: 'error' };
  }
}

export default function CallScreen({
  localStream,
  remoteStream,
  audioEnabled,
  videoEnabled,
  e2eeStatus,
  peerVerified,
  connectionState,
  safetyNumber,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
  onOpenSecurity,
}: CallScreenProps) {
  const conn = connectionLabel(connectionState);
  const e2ee = e2eeLabel(e2eeStatus);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        bgcolor: '#0a0e14',
        overflow: 'hidden',
      }}
    >
      {/* Remote video — full screen */}
      <Box sx={{ position: 'absolute', inset: 0 }}>
        {remoteStream ? (
          <VideoElement stream={remoteStream} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ width: '100%', height: '100%' }}
          >
            <Typography variant="h6" color="text.secondary">
              Waiting for remote video...
            </Typography>
          </Stack>
        )}
      </Box>

      {/* Local video — bottom-right overlay */}
      <Box
        sx={{
          position: 'absolute',
          bottom: { xs: 100, sm: 110 },
          right: { xs: 12, sm: 24 },
          width: { xs: 120, sm: 180 },
          height: { xs: 90, sm: 135 },
          borderRadius: 2,
          overflow: 'hidden',
          border: '2px solid rgba(255,255,255,0.15)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          zIndex: 10,
        }}
      >
        <VideoElement stream={localStream} muted mirror style={{ width: '100%', height: '100%' }} />
      </Box>

      {/* Top status bar */}
      <Paper
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          bgcolor: 'rgba(10,14,20,0.7)',
          backdropFilter: 'blur(8px)',
          border: 'none',
          borderBottom: '1px solid rgba(139,153,173,0.08)',
          borderRadius: 0,
          px: 2,
          py: 1,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            label={conn.label}
            color={conn.color}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<LockIcon fontSize="small" />}
            label={e2ee.label}
            color={e2ee.color}
            size="small"
            variant="outlined"
          />
          {peerVerified ? (
            <Chip
              icon={<VerifiedUserIcon fontSize="small" />}
              label="Verified"
              color="success"
              size="small"
              variant="outlined"
            />
          ) : (
            safetyNumber && (
              <Chip
                icon={<ShieldOutlinedIcon fontSize="small" />}
                label="Unverified"
                color="warning"
                size="small"
                variant="outlined"
              />
            )
          )}
        </Stack>
      </Paper>

      {/* Bottom control bar */}
      <Paper
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          bgcolor: 'rgba(10,14,20,0.75)',
          backdropFilter: 'blur(12px)',
          border: 'none',
          borderTop: '1px solid rgba(139,153,173,0.08)',
          borderRadius: 0,
          py: { xs: 1.5, sm: 2 },
          px: 2,
        }}
      >
        <Stack
          direction="row"
          justifyContent="center"
          alignItems="center"
          spacing={{ xs: 1.5, sm: 3 }}
        >
          <Tooltip title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}>
            <IconButton
              onClick={onToggleAudio}
              sx={{
                bgcolor: audioEnabled ? 'rgba(255,255,255,0.08)' : 'error.main',
                color: audioEnabled ? 'text.primary' : '#fff',
                '&:hover': {
                  bgcolor: audioEnabled ? 'rgba(255,255,255,0.14)' : 'error.dark',
                },
                width: 56,
                height: 56,
              }}
            >
              {audioEnabled ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}>
            <IconButton
              onClick={onToggleVideo}
              sx={{
                bgcolor: videoEnabled ? 'rgba(255,255,255,0.08)' : 'error.main',
                color: videoEnabled ? 'text.primary' : '#fff',
                '&:hover': {
                  bgcolor: videoEnabled ? 'rgba(255,255,255,0.14)' : 'error.dark',
                },
                width: 56,
                height: 56,
              }}
            >
              {videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Tooltip title="End call">
            <IconButton
              onClick={onEndCall}
              sx={{
                bgcolor: 'error.main',
                color: '#fff',
                '&:hover': { bgcolor: 'error.dark' },
                width: 56,
                height: 56,
              }}
            >
              <CallEndIcon />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Tooltip title="Security info">
            <IconButton
              onClick={onOpenSecurity}
              sx={{
                bgcolor: 'rgba(255,255,255,0.08)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
                width: 56,
                height: 56,
              }}
            >
              <Badge
                color={peerVerified ? 'success' : 'warning'}
                variant="dot"
                invisible={!safetyNumber}
              >
                {peerVerified ? (
                  <ShieldIcon sx={{ color: 'success.main' }} />
                ) : (
                  <ShieldOutlinedIcon sx={{ color: 'warning.main' }} />
                )}
              </Badge>
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>
    </Box>
  );
}
