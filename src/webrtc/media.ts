/**
 * Media device management utilities.
 */

/**
 * Request access to camera and/or microphone.
 * Throws if the user denies permission or no devices are available.
 */
export async function requestMedia(video: boolean, audio: boolean): Promise<MediaStream> {
  if (!video && !audio) {
    throw new Error('At least one of video or audio must be requested');
  }

  return navigator.mediaDevices.getUserMedia({ video, audio });
}

/**
 * Stop all tracks in a media stream, releasing device access.
 */
export function stopMedia(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * Toggle the enabled state of all audio tracks in the stream.
 * Returns the new enabled state (true = unmuted, false = muted).
 */
export function toggleAudio(stream: MediaStream): boolean {
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) return false;

  const newState = !audioTracks[0].enabled;
  for (const track of audioTracks) {
    track.enabled = newState;
  }
  return newState;
}

/**
 * Toggle the enabled state of all video tracks in the stream.
 * Returns the new enabled state (true = camera on, false = camera off).
 */
export function toggleVideo(stream: MediaStream): boolean {
  const videoTracks = stream.getVideoTracks();
  if (videoTracks.length === 0) return false;

  const newState = !videoTracks[0].enabled;
  for (const track of videoTracks) {
    track.enabled = newState;
  }
  return newState;
}

/**
 * Get the current enabled state of audio and video tracks.
 */
export function getMediaState(stream: MediaStream): { audio: boolean; video: boolean } {
  const audioTracks = stream.getAudioTracks();
  const videoTracks = stream.getVideoTracks();

  return {
    audio: audioTracks.length > 0 && audioTracks[0].enabled,
    video: videoTracks.length > 0 && videoTracks[0].enabled,
  };
}
