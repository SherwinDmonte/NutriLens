import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const VIDEO_SOURCE = '/media/nutrilens-fresh-salad.mp4';
const VIDEO_POSTER = '/media/nutrilens-fresh-salad-poster.jpg';

function initialReducedMotion() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function prefersDataSaving() {
  return typeof navigator !== 'undefined' && Boolean(navigator.connection?.saveData);
}

export function LandingNutritionVideo() {
  const frameRef = useRef(null);
  const videoRef = useRef(null);
  const isVisibleRef = useRef(false);
  const userPausedRef = useRef(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const saveData = prefersDataSaving();
  const staticMode = reducedMotion || saveData;
  const supportsIntersectionObserver =
    typeof window !== 'undefined' && 'IntersectionObserver' in window;
  const shouldUseVideo = !staticMode && (shouldLoad || !supportsIntersectionObserver);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mediaQuery) return undefined;

    const handlePreferenceChange = (event) => {
      setReducedMotion(event.matches);
      if (event.matches) videoRef.current?.pause();
    };

    mediaQuery.addEventListener('change', handlePreferenceChange);
    return () => mediaQuery.removeEventListener('change', handlePreferenceChange);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || staticMode || !supportsIntersectionObserver) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          setShouldLoad(true);
          if (!userPausedRef.current) void videoRef.current?.play().catch(() => {});
        } else {
          videoRef.current?.pause();
        }
      },
      { rootMargin: '180px 0px', threshold: 0.2 },
    );

    observer.observe(frame);
    return () => observer.disconnect();
  }, [staticMode, supportsIntersectionObserver]);

  function handleReady() {
    setIsReady(true);
    if (
      (isVisibleRef.current || !supportsIntersectionObserver) &&
      !userPausedRef.current &&
      !staticMode
    ) {
      void videoRef.current?.play().catch(() => {});
    }
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (isPaused) {
      userPausedRef.current = false;
      setIsPaused(false);
      void video.play().catch(() => {});
    } else {
      userPausedRef.current = true;
      setIsPaused(true);
      video.pause();
    }
  }

  return (
    <figure className="motion-media-figure" ref={frameRef}>
      <div className="motion-media-card" data-ready={isReady || undefined}>
        <video
          ref={videoRef}
          src={shouldUseVideo ? VIDEO_SOURCE : undefined}
          poster={VIDEO_POSTER}
          muted
          loop
          playsInline
          autoPlay={shouldUseVideo && !isPaused}
          preload="none"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          onLoadedData={handleReady}
        />
        <div className="motion-media-shade" aria-hidden="true" />
        <span className="motion-media-kicker">Real food · useful context</span>
        <div className="motion-media-insight">
          <small>FROM LOG TO INSIGHT</small>
          <strong>Start with the meal you know.</strong>
          <span>Portion → nutrition → a clearer next choice</span>
        </div>
        {staticMode ? (
          <span className="motion-media-static">Static preview</span>
        ) : (
          <button
            className="motion-media-control"
            type="button"
            onClick={togglePlayback}
            aria-label={isPaused ? 'Play food video' : 'Pause food video'}
            aria-pressed={isPaused}
          >
            {isPaused ? (
              <Play size={15} aria-hidden="true" />
            ) : (
              <Pause size={15} aria-hidden="true" />
            )}
            {isPaused ? 'Play' : 'Pause'}
          </button>
        )}
      </div>
      <figcaption>
        <span>Fresh ingredients, presented without visual noise.</span>
        <a
          href="https://www.pexels.com/video/eating-healthy-4519060/"
          target="_blank"
          rel="noreferrer"
        >
          Footage by Polina Tankilevitch · Pexels
        </a>
      </figcaption>
    </figure>
  );
}
