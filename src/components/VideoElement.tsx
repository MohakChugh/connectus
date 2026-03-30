/**
 * VideoElement — attaches a MediaStream to a <video> element via ref.
 */
import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';

interface VideoElementProps {
  stream: MediaStream | null;
  muted?: boolean;
  style?: React.CSSProperties;
  mirror?: boolean;
}

export default function VideoElement({
  stream,
  muted = false,
  style,
  mirror = false,
}: VideoElementProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (stream) {
      el.srcObject = stream;
    } else {
      el.srcObject = null;
    }

    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: mirror ? 'scaleX(-1)' : undefined,
        }}
      />
    </Box>
  );
}
