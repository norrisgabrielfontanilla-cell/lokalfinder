import { useEffect, useRef, useState } from 'react';

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260715_090628_7052d8a6-a094-4341-a4a2-ad58493a67a9.mp4';

const CAPTURE_MAX_WIDTH = 960;
const PLAYBACK_FPS = 30;
const FRAME_INTERVAL_MS = 1000 / PLAYBACK_FPS;

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export default function BoomerangVideoBg() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<HTMLCanvasElement[]>([]);
  const lastCapturedTimeRef = useRef<number | null>(null);
  const captureHandleRef = useRef<number | null>(null);
  const usingFrameCallbackRef = useRef(false);
  const playbackTimerRef = useRef<number | null>(null);
  const frameIndexRef = useRef(0);
  const directionRef = useRef<1 | -1>(1);

  const [framesReady, setFramesReady] = useState(false);

  // Capture: play the source video once, grabbing every frame onto an
  // offscreen canvas so we can boomerang-loop it without re-fetching/re-decoding.
  useEffect(() => {
    const video = videoRef.current as VideoWithFrameCallback | null;
    if (!video) return;

    let cancelled = false;

    const captureFrame = () => {
      if (cancelled) return;
      const currentTime = video.currentTime;
      if (lastCapturedTimeRef.current === currentTime) return;
      lastCapturedTimeRef.current = currentTime;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      const width = Math.min(CAPTURE_MAX_WIDTH, vw);
      const height = Math.round((vh / vw) * width);

      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, width, height);
      framesRef.current.push(frameCanvas);
    };

    const scheduleNext = () => {
      if (cancelled) return;
      if (typeof video.requestVideoFrameCallback === 'function') {
        usingFrameCallbackRef.current = true;
        captureHandleRef.current = video.requestVideoFrameCallback(() => {
          captureFrame();
          scheduleNext();
        });
      } else {
        usingFrameCallbackRef.current = false;
        captureHandleRef.current = requestAnimationFrame(() => {
          captureFrame();
          scheduleNext();
        });
      }
    };

    const stopCapture = () => {
      if (captureHandleRef.current == null) return;
      if (usingFrameCallbackRef.current && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(captureHandleRef.current);
      } else {
        cancelAnimationFrame(captureHandleRef.current);
      }
      captureHandleRef.current = null;
    };

    const handlePlay = () => scheduleNext();

    const handleEnded = () => {
      cancelled = true;
      stopCapture();
      if (framesRef.current.length > 1) {
        setFramesReady(true);
      }
    };

    const handleLoadedMetadata = () => {
      video.play().catch(() => {});
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('ended', handleEnded);

    return () => {
      cancelled = true;
      stopCapture();
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Playback: once frames are captured, ping-pong through them on a display
  // canvas at a fixed 30fps — forward to the last frame, then reverse to the first.
  useEffect(() => {
    if (!framesReady) return;
    const canvas = canvasRef.current;
    const frames = framesRef.current;
    if (!canvas || frames.length === 0) return;

    canvas.width = frames[0].width;
    canvas.height = frames[0].height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (index: number) => ctx.drawImage(frames[index], 0, 0);
    draw(0);

    const tick = () => {
      let next = frameIndexRef.current + directionRef.current;
      if (next >= frames.length - 1) {
        next = frames.length - 1;
        directionRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        directionRef.current = 1;
      }
      frameIndexRef.current = next;
      draw(next);
    };

    playbackTimerRef.current = window.setInterval(tick, FRAME_INTERVAL_MS);

    return () => {
      if (playbackTimerRef.current != null) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [framesReady]);

  return (
    <div aria-hidden="true" className="absolute inset-0 z-0 scale-[1.15] origin-top overflow-hidden">
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        className="w-full h-full object-cover object-top"
        style={{ display: framesReady ? 'none' : 'block' }}
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover object-top"
        style={{ display: framesReady ? 'block' : 'none' }}
      />
    </div>
  );
}
