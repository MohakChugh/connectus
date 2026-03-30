/**
 * VerificationDialog — displays and verifies the safety number.
 */
import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { monoFontFamily } from '../theme';

interface VerificationDialogProps {
  open: boolean;
  safetyNumber: string | null;
  peerVerified: boolean;
  onVerify: () => void;
  onClose: () => void;
}

function formatSafetyNumber(sn: string): string {
  // Group into blocks of 5, rows of 4 blocks
  const clean = sn.replace(/\s/g, '');
  const blocks: string[] = [];
  for (let i = 0; i < clean.length; i += 5) {
    blocks.push(clean.slice(i, i + 5));
  }
  const rows: string[] = [];
  for (let i = 0; i < blocks.length; i += 4) {
    rows.push(blocks.slice(i, i + 4).join('  '));
  }
  return rows.join('\n');
}

export default function VerificationDialog({
  open,
  safetyNumber,
  peerVerified,
  onVerify,
  onClose,
}: VerificationDialogProps) {
  const [copySnack, setCopySnack] = useState(false);

  const handleCopy = async () => {
    if (!safetyNumber) return;
    try {
      await navigator.clipboard.writeText(safetyNumber);
      setCopySnack(true);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <VerifiedUserIcon
            sx={{ color: peerVerified ? 'success.main' : 'warning.main' }}
          />
          Verify Security
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3}>
            {peerVerified ? (
              <Alert severity="success">
                Peer identity has been marked as verified. The safety number matched.
              </Alert>
            ) : (
              <Alert severity="warning">
                This connection has not been verified yet. Compare the safety number below with
                the other person to confirm you are communicating securely.
              </Alert>
            )}

            {safetyNumber ? (
              <Paper
                sx={{
                  p: 3,
                  textAlign: 'center',
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(79,195,247,0.04)'
                      : 'rgba(79,195,247,0.06)',
                  border: '1px solid rgba(79,195,247,0.15)',
                }}
              >
                <Typography
                  component="pre"
                  sx={{
                    fontFamily: monoFontFamily,
                    fontSize: { xs: '0.85rem', sm: '1.05rem' },
                    lineHeight: 2,
                    letterSpacing: '0.08em',
                    whiteSpace: 'pre-wrap',
                    color: 'text.primary',
                    m: 0,
                  }}
                >
                  {formatSafetyNumber(safetyNumber)}
                </Typography>
              </Paper>
            ) : (
              <Alert severity="info">
                Safety number is not yet available. It will appear once the peer connection is
                established and DTLS fingerprints are exchanged.
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary">
              Compare this safety number with the other person over a separate trusted channel
              (e.g., in person, phone call, or trusted messaging app).
            </Typography>

            <Alert severity="warning" variant="standard">
              This verification is only meaningful if you compare over a channel you trust. If
              either participant&apos;s browser is compromised, the safety number can be forged.
            </Alert>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopy}
            disabled={!safetyNumber}
          >
            Copy Safety Number
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={onVerify}
            disabled={peerVerified || !safetyNumber}
            sx={{
              bgcolor: 'success.main',
              '&:hover': { bgcolor: 'success.dark' },
            }}
          >
            {peerVerified ? 'Verified' : 'Mark as Verified'}
          </Button>
          <Button variant="text" onClick={onClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={copySnack}
        autoHideDuration={2000}
        onClose={() => setCopySnack(false)}
        message="Safety number copied"
      />
    </>
  );
}
