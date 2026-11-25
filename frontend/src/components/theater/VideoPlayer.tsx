'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertCircle, Minimize2, RefreshCw } from 'lucide-react';

import { PlaybackMode, BroadcastStatus } from '../../types';
import { classifyYouTubeBroadcast } from '../../lib/broadcastClassifier';
import {
  enterElementFullscreen,
  exitElementFullscreen,
  FullscreenMode,
  getNativeFullscreenElement,
  tryLockLandscape,
  tryUnlockOrientation,
} from '../../lib/fullscreen';

const LIVE_STALL_THRESHOLD_MS = 10000;
const LIVE_RECOVERY_COOLDOWN_MS = 15000;
const MAX_LIVE_AUTO_RECOVERY_ATTEMPTS = 2;
const LIVE_RECONNECT_TIMEOUT_MS = 12000;
const LIVE_CLASSIFICATION_SAMPLE_INTERVAL_MS = 2000;

interface VideoPlayerProps {
  provider: 'YOUTUBE' | 'DIRECT' | 'HLS' | 'GOOGLE_DRIVE' | 'UNSUPPORTED';
  playbackMode?: PlaybackMode;
  broadcastStatus?: BroadcastStatus;
  videoId: string;
  videoUrl: string;
  status: 'PLAYING' | 'PAUSED' | 'BUFFERING';
  currentPosition: number;
  playbackRate: number;
  lastServerTimestamp: number;
  sequenceNumber?: number;
  isOwnerOrMod: boolean;
  isEmergencyPaused?: boolean;
  fullscreenControllerRef?: React.MutableRefObject<{ toggle: () => void } | null>;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onPlayerReady?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlayAction?: () => void;
  onPauseAction?: () => void;
  onSeekAction?: (time: number) => void;
  onBroadcastClassification?: (classification: {
    videoId: string;
    mode: PlaybackMode;
    broadcastStatus: BroadcastStatus;
    sequenceNumber?: number;
  }) => void;
  onAutoplayBlocked?: () => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function VideoPlayer({
  provider,
  playbackMode = 'VOD',
  broadcastStatus = 'UNKNOWN_UNVERIFIED',
  videoId,
  videoUrl,
  status,
  currentPosition,
  playbackRate,
  lastServerTimestamp,
  sequenceNumber,
  isOwnerOrMod,
  isEmergencyPaused,
  fullscreenControllerRef,
  onFullscreenChange,
  onPlayerReady,
  onTimeUpdate,
  onPlayAction,
  onPauseAction,
  onSeekAction,
  onBroadcastClassification,
  onAutoplayBlocked,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playbackModeRef = useRef<PlaybackMode>(playbackMode);
  const broadcastStatusRef = useRef<BroadcastStatus>(broadcastStatus);
  const statusRef = useRef(status);
  const isEmergencyPausedRef = useRef(Boolean(isEmergencyPaused));
  const isOwnerOrModRef = useRef(isOwnerOrMod);
  const sequenceNumberRef = useRef(sequenceNumber);
  const onBroadcastClassificationRef = useRef(onBroadcastClassification);
  const onAutoplayBlockedRef = useRef(onAutoplayBlocked);
  const onFullscreenChangeRef = useRef(onFullscreenChange);
  const durationSamplesRef = useRef<number[]>([]);
  const lastReportedStatusRef = useRef<BroadcastStatus | null>(null);

  // Bounded LIVE stall recovery & manual reconnect refs
  const recoveryAttemptsRef = useRef(0);
  const isRecoveringRef = useRef(false);
  const lastRecoveryAttemptAtRef = useRef(0);
  const stallStartedAtRef = useRef<number | null>(null);
  const lastLoadedFractionRef = useRef(-1);
  const isReconnectingRef = useRef(false);
  const playerGenerationRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectGenerationRef = useRef(0);
  const lastClassificationSampleAtRef = useRef(0);
  const evaluateClassificationRef = useRef<
    ((params: { playerState?: number; errorCode?: number; autoplayBlocked?: boolean }) => void) | null
  >(null);

  playbackModeRef.current = playbackMode;
  broadcastStatusRef.current = broadcastStatus;
  statusRef.current = status;
  isEmergencyPausedRef.current = Boolean(isEmergencyPaused);
  isOwnerOrModRef.current = isOwnerOrMod;
  sequenceNumberRef.current = sequenceNumber;
  onBroadcastClassificationRef.current = onBroadcastClassification;
  onAutoplayBlockedRef.current = onAutoplayBlocked;
  onFullscreenChangeRef.current = onFullscreenChange;

  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showManualReconnect, setShowManualReconnect] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode | null>(null);
  const isFullscreenRef = useRef(false);
  const fullscreenModeRef = useRef<FullscreenMode | null>(null);
  isFullscreenRef.current = isFullscreen;
  fullscreenModeRef.current = fullscreenMode;

  const updateFullscreenState = useCallback((active: boolean, mode: FullscreenMode | null) => {
    setIsFullscreen(active);
    setFullscreenMode(mode);
    onFullscreenChangeRef.current?.(active);
  }, []);

  const exitFullscreen = useCallback(async () => {
    const currentMode = fullscreenModeRef.current;
    tryUnlockOrientation();
    if (currentMode === 'native' || getNativeFullscreenElement()) {
      await exitElementFullscreen();
    }
    updateFullscreenState(false, null);
  }, [updateFullscreenState]);

  const enterFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    const mode = await enterElementFullscreen(container, videoElementRef.current);
    if (mode === 'native') {
      updateFullscreenState(true, 'native');
      await tryLockLandscape();
    } else if (mode === 'webkit-video') {
      updateFullscreenState(true, 'webkit-video');
    } else {
      updateFullscreenState(true, 'fallback');
      await tryLockLandscape();
    }
  }, [updateFullscreenState]);

  const handleToggleFullscreen = useCallback(() => {
    if (isFullscreenRef.current) {
      void exitFullscreen();
    } else {
      void enterFullscreen();
    }
  }, [enterFullscreen, exitFullscreen]);

  useEffect(() => {
    if (!fullscreenControllerRef) return;
    fullscreenControllerRef.current = { toggle: handleToggleFullscreen };
    return () => {
      if (fullscreenControllerRef.current) {
        fullscreenControllerRef.current = null;
      }
    };
  }, [fullscreenControllerRef, handleToggleFullscreen]);

  // Listen to native fullscreenchange / fullscreenerror and iOS webkit video events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const nativeEl = getNativeFullscreenElement();
      if (nativeEl && nativeEl === containerRef.current) {
        updateFullscreenState(true, 'native');
      } else if (!nativeEl && fullscreenModeRef.current === 'native') {
        tryUnlockOrientation();
        updateFullscreenState(false, null);
      }
    };

    const handleFullscreenError = () => {
      if (fullscreenModeRef.current === 'native') {
        updateFullscreenState(true, 'fallback');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('fullscreenerror', handleFullscreenError);
    document.addEventListener('webkitfullscreenerror', handleFullscreenError);

    const videoEl = videoElementRef.current;
    const handleWebkitBegin = () => updateFullscreenState(true, 'webkit-video');
    const handleWebkitEnd = () => {
      tryUnlockOrientation();
      updateFullscreenState(false, null);
    };
    videoEl?.addEventListener('webkitbeginfullscreen', handleWebkitBegin);
    videoEl?.addEventListener('webkitendfullscreen', handleWebkitEnd);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('fullscreenerror', handleFullscreenError);
      document.removeEventListener('webkitfullscreenerror', handleFullscreenError);
      videoEl?.removeEventListener('webkitbeginfullscreen', handleWebkitBegin);
      videoEl?.removeEventListener('webkitendfullscreen', handleWebkitEnd);
    };
  }, [provider, updateFullscreenState]);

  // Fallback CSS fullscreen: lock body scroll & support Escape key
  useEffect(() => {
    if (!isFullscreen || fullscreenMode !== 'fallback') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, fullscreenMode, exitFullscreen]);

  // Ensure orientation is unlocked if component unmounts while fullscreen
  useEffect(() => {
    return () => {
      if (isFullscreenRef.current) {
        tryUnlockOrientation();
      }
    };
  }, []);

  const clearReconnectTimer = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  // Reset per-video classification telemetry and recovery state on video change
  useEffect(() => {
    clearReconnectTimer();
    reconnectGenerationRef.current += 1;
    durationSamplesRef.current = [];
    lastReportedStatusRef.current = null;
    lastClassificationSampleAtRef.current = 0;
    recoveryAttemptsRef.current = 0;
    isRecoveringRef.current = false;
    lastRecoveryAttemptAtRef.current = 0;
    stallStartedAtRef.current = null;
    lastLoadedFractionRef.current = -1;
    isReconnectingRef.current = false;
    setIsReady(false);
    setShowManualReconnect(false);
    setIsReconnecting(false);
    setReconnectError(null);
  }, [provider, videoId]);

  // Calculate authoritative effective position
  const getAuthoritativePosition = () => {
    if (playbackMode === 'LIVE') return 0;
    if (status !== 'PLAYING') return currentPosition;
    const elapsed = (Date.now() - lastServerTimestamp) / 1000;
    return Math.max(0, currentPosition + elapsed * playbackRate);
  };

  // --- YOUTUBE IFRAME API INITIALIZATION ---
  useEffect(() => {
    if (provider !== 'YOUTUBE') return;

    let isSubscribed = true;
    let isTearingDown = false;
    const myGeneration = ++playerGenerationRef.current;

    const evaluateClassification = (params: {
      playerState?: number;
      errorCode?: number;
      autoplayBlocked?: boolean;
    }) => {
      if (!isSubscribed || myGeneration !== playerGenerationRef.current) return;

      const result = classifyYouTubeBroadcast({
        playerState: params.playerState,
        errorCode: params.errorCode,
        autoplayBlocked: params.autoplayBlocked,
        isApplicationStop: isTearingDown,
        urlPlaybackIntent: playbackModeRef.current,
        durationSamples: durationSamplesRef.current,
        currentStatus: lastReportedStatusRef.current || broadcastStatusRef.current,
      });

      if (
        result.isConfirmed &&
        isOwnerOrModRef.current &&
        result.broadcastStatus !== lastReportedStatusRef.current
      ) {
        lastReportedStatusRef.current = result.broadcastStatus;
        onBroadcastClassificationRef.current?.({
          videoId,
          mode: result.recommendedMode,
          broadcastStatus: result.broadcastStatus,
          sequenceNumber: sequenceNumberRef.current,
        });
      }
    };
    evaluateClassificationRef.current = evaluateClassification;

    const initYT = () => {
      if (!window.YT || !window.YT.Player || !isSubscribed || myGeneration !== playerGenerationRef.current) {
        return;
      }

      // Reset readiness and clear pending reconnect timers before replacing old player
      setIsReady(false);
      clearReconnectTimer();
      reconnectGenerationRef.current += 1;
      isReconnectingRef.current = false;
      setIsReconnecting(false);

      if (ytPlayerRef.current) {
        isTearingDown = true;
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {}
        ytPlayerRef.current = null;
        isTearingDown = false;
      }

      ytPlayerRef.current = new window.YT.Player('synctheater-yt-iframe', {
        videoId,
        playerVars: {
          autoplay: statusRef.current === 'PLAYING' ? 1 : 0,
          controls: isOwnerOrMod ? 1 : 0,
          disablekb: isOwnerOrMod ? 0 : 1,
          fs: 1,
          modestbranding: 1,
          rel: 0,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        },
        events: {
          onReady: (event: any) => {
            if (!isSubscribed || myGeneration !== playerGenerationRef.current) return;
            setIsReady(true);
            onPlayerReady?.();

            if (playbackModeRef.current === 'LIVE') {
              // LIVE initialization: never seekTo(0) or seekTo(getDuration())
              if (statusRef.current === 'PLAYING') {
                event.target.playVideo();
              } else {
                event.target.pauseVideo();
              }
              return;
            }

            // VOD initialization
            const targetPos = getAuthoritativePosition();
            event.target.seekTo(targetPos, true);
            if (statusRef.current === 'PLAYING') {
              event.target.playVideo();
            } else {
              event.target.pauseVideo();
            }
          },
          onStateChange: (event: any) => {
            if (!isSubscribed || isTearingDown || myGeneration !== playerGenerationRef.current) return;
            const playerState = event?.data;
            if (playerState === 1) {
              const d = event?.target?.getDuration?.();
              if (typeof d === 'number' && Number.isFinite(d)) {
                durationSamplesRef.current = [...durationSamplesRef.current.slice(-4), d];
                lastClassificationSampleAtRef.current = Date.now();
              }
              if (
                playbackModeRef.current === 'LIVE' &&
                statusRef.current === 'PLAYING' &&
                !isEmergencyPausedRef.current
              ) {
                clearReconnectTimer();
                reconnectGenerationRef.current += 1;
                recoveryAttemptsRef.current = 0;
                stallStartedAtRef.current = null;
                isRecoveringRef.current = false;
                isReconnectingRef.current = false;
                setIsReconnecting(false);
                setReconnectError(null);
                setShowManualReconnect(false);
              }
            }
            evaluateClassification({ playerState });
          },
          onError: (event: any) => {
            if (!isSubscribed || isTearingDown || myGeneration !== playerGenerationRef.current) return;
            evaluateClassification({ errorCode: event?.data });
          },
          onAutoplayBlocked: () => {
            if (!isSubscribed || isTearingDown || myGeneration !== playerGenerationRef.current) return;
            onAutoplayBlockedRef.current?.();
            evaluateClassification({ autoplayBlocked: true });
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initYT();
    } else {
      if (!document.getElementById('yt-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }
      window.onYouTubeIframeAPIReady = () => {
        if (isSubscribed && myGeneration === playerGenerationRef.current) initYT();
      };
    }

    return () => {
      isTearingDown = true;
      isSubscribed = false;
      playerGenerationRef.current += 1;
      evaluateClassificationRef.current = null;
      clearReconnectTimer();
      reconnectGenerationRef.current += 1;
      isReconnectingRef.current = false;
      setIsReady(false);
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {}
        ytPlayerRef.current = null;
      }
    };
  }, [provider, videoId]);

  // --- HLS / HTML5 VIDEO INITIALIZATION ---
  useEffect(() => {
    if (provider !== 'HLS' && provider !== 'DIRECT') return;
    const video = videoElementRef.current;
    if (!video) return;

    let isSubscribed = true;
    setIsReady(false);

    if (provider === 'HLS' && videoUrl.includes('.m3u8')) {
      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
        const hls = new Hls({ enableWorker: true });
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!isSubscribed) return;
          setIsReady(true);
          onPlayerReady?.();
          const target = getAuthoritativePosition();
          video.currentTime = target;
          if (status === 'PLAYING') video.play().catch(() => {});
        });
        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = videoUrl;
        setIsReady(true);
      }
    } else if (provider === 'DIRECT') {
      video.src = videoUrl;
      video.onloadedmetadata = () => {
        if (!isSubscribed) return;
        setIsReady(true);
        onPlayerReady?.();
        const target = getAuthoritativePosition();
        video.currentTime = target;
        if (status === 'PLAYING') video.play().catch(() => {});
      };
    }

    return () => {
      isSubscribed = false;
      setIsReady(false);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [provider, videoUrl]);

  // --- DRIFT COMPENSATION (VOD), BOUNDED STALL RECOVERY (LIVE) & PERIODIC CLASSIFICATION SAMPLING ---
  useEffect(() => {
    const sampleDurationIfUnverified = (ytState: number) => {
      const currentClassified = lastReportedStatusRef.current || broadcastStatusRef.current;
      if (
        ytState === 1 &&
        status === 'PLAYING' &&
        !isEmergencyPaused &&
        currentClassified === 'UNKNOWN_UNVERIFIED'
      ) {
        const now = Date.now();
        if (now - lastClassificationSampleAtRef.current >= LIVE_CLASSIFICATION_SAMPLE_INTERVAL_MS) {
          const d = ytPlayerRef.current?.getDuration?.();
          if (typeof d === 'number' && Number.isFinite(d)) {
            durationSamplesRef.current = [...durationSamplesRef.current.slice(-4), d];
            lastClassificationSampleAtRef.current = now;
            evaluateClassificationRef.current?.({ playerState: 1 });
          }
        }
      }
    };

    const syncInterval = setInterval(() => {
      if (playbackMode === 'LIVE') {
        // VOD drift-correction loop is completely bypassed in LIVE mode (no seekTo)
        if (
          provider === 'YOUTUBE' &&
          ytPlayerRef.current &&
          isReady &&
          status === 'PLAYING' &&
          !isEmergencyPaused
        ) {
          try {
            const ytState = ytPlayerRef.current.getPlayerState?.();
            if (ytState === 1) {
              stallStartedAtRef.current = null;
              sampleDurationIfUnverified(ytState);
              return;
            }

            if (!showManualReconnect && (ytState === 3 || ytState === 2)) {
              const now = Date.now();
              const loadedFrac = ytPlayerRef.current.getVideoLoadedFraction?.() ?? 0;

              if (stallStartedAtRef.current === null) {
                stallStartedAtRef.current = now;
                lastLoadedFractionRef.current = loadedFrac;
              } else if (loadedFrac > lastLoadedFractionRef.current) {
                // Buffer is actively advancing: ordinary buffering, not stalled
                stallStartedAtRef.current = now;
                lastLoadedFractionRef.current = loadedFrac;
              } else if (now - stallStartedAtRef.current >= LIVE_STALL_THRESHOLD_MS) {
                const cooldownElapsed =
                  lastRecoveryAttemptAtRef.current === 0 ||
                  now - lastRecoveryAttemptAtRef.current >= LIVE_RECOVERY_COOLDOWN_MS;

                if (!isRecoveringRef.current && cooldownElapsed) {
                  if (recoveryAttemptsRef.current < MAX_LIVE_AUTO_RECOVERY_ATTEMPTS) {
                    isRecoveringRef.current = true;
                    recoveryAttemptsRef.current += 1;
                    lastRecoveryAttemptAtRef.current = now;
                    stallStartedAtRef.current = null;
                    try {
                      ytPlayerRef.current.playVideo();
                    } finally {
                      isRecoveringRef.current = false;
                    }
                  } else {
                    setShowManualReconnect(true);
                  }
                }
              }
            }
          } catch (e) {
            isRecoveringRef.current = false;
          }
        }
        return;
      }

      const authPos = getAuthoritativePosition();

      // YouTube Sync
      if (provider === 'YOUTUBE' && ytPlayerRef.current && isReady) {
        try {
          const ytState = ytPlayerRef.current.getPlayerState?.();
          const localYtTime = ytPlayerRef.current.getCurrentTime?.() || 0;
          const delta = Math.abs(localYtTime - authPos);

          // Duration update
          const d = ytPlayerRef.current.getDuration?.() || 0;
          setDuration(d);
          setCurrentTime(localYtTime);
          onTimeUpdate?.(localYtTime, d);

          sampleDurationIfUnverified(ytState);

          // State synchronization
          if (status === 'PLAYING' && ytState !== 1) {
            ytPlayerRef.current.playVideo();
          } else if (status === 'PAUSED' && ytState === 1) {
            ytPlayerRef.current.pauseVideo();
          }

          // Hard seek if drift > 2.5s
          if (delta > 2.5) {
            ytPlayerRef.current.seekTo(authPos, true);
          }
        } catch (e) {}
      }

      // HTML5 / HLS Sync
      if ((provider === 'DIRECT' || provider === 'HLS') && videoElementRef.current && isReady) {
        const video = videoElementRef.current;
        const localTime = video.currentTime;
        const delta = Math.abs(localTime - authPos);

        setDuration(video.duration || 0);
        setCurrentTime(localTime);
        onTimeUpdate?.(localTime, video.duration || 0);

        if (status === 'PLAYING' && video.paused) {
          video.play().catch(() => {});
        } else if (status === 'PAUSED' && !video.paused) {
          video.pause();
        }

        // Hard seek if drift > 2.5s
        if (delta > 2.5) {
          video.currentTime = authPos;
        }

        // Adjust rate if needed
        if (video.playbackRate !== playbackRate) {
          video.playbackRate = playbackRate;
        }
      }
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [provider, playbackMode, status, isEmergencyPaused, showManualReconnect, currentPosition, playbackRate, lastServerTimestamp, isReady]);

  // Immediate Pause/Play Trigger on Emergency Pause or State Transition
  useEffect(() => {
    if (!isReady) return;
    if (status === 'PAUSED' || isEmergencyPaused) {
      stallStartedAtRef.current = null;
      isRecoveringRef.current = false;
      clearReconnectTimer();
      reconnectGenerationRef.current += 1;
      isReconnectingRef.current = false;
      setIsReconnecting(false);
      if (provider === 'YOUTUBE' && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (e) {}
      } else if ((provider === 'DIRECT' || provider === 'HLS') && videoElementRef.current) {
        videoElementRef.current.pause();
      }
    } else if (playbackMode === 'LIVE' && status === 'PLAYING' && provider === 'YOUTUBE' && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.playVideo();
      } catch (e) {}
    }
  }, [status, isEmergencyPaused, playbackMode, provider, isReady]);

  const handleManualReconnect = () => {
    if (
      playbackMode !== 'LIVE' ||
      provider !== 'YOUTUBE' ||
      status !== 'PLAYING' ||
      isEmergencyPaused ||
      isReconnectingRef.current ||
      !ytPlayerRef.current
    ) {
      return;
    }

    clearReconnectTimer();
    const myReconnectGen = ++reconnectGenerationRef.current;
    isReconnectingRef.current = true;
    setIsReconnecting(true);
    setReconnectError(null);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (myReconnectGen !== reconnectGenerationRef.current) return;
      reconnectTimeoutRef.current = null;
      isReconnectingRef.current = false;
      setIsReconnecting(false);
      setReconnectError('Reconnect timed out. Please try again.');
    }, LIVE_RECONNECT_TIMEOUT_MS);

    try {
      ytPlayerRef.current.loadVideoById({ videoId });
    } catch (e) {
      clearReconnectTimer();
      reconnectGenerationRef.current += 1;
      isReconnectingRef.current = false;
      setIsReconnecting(false);
      setReconnectError('Unable to reconnect. Please try again.');
    }
  };

  const containerClassName =
    isFullscreen && fullscreenMode === 'fallback'
      ? 'fixed inset-0 z-[100] w-screen h-[100dvh] bg-[#000000] overflow-hidden flex items-center justify-center'
      : isFullscreen
      ? 'relative w-full h-full bg-[#000000] overflow-hidden flex items-center justify-center'
      : 'relative w-full aspect-video bg-[#000000] rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center border border-[#353535]';

  return (
    <div
      ref={containerRef}
      data-testid="video-player-container"
      data-fullscreen={isFullscreen ? 'true' : 'false'}
      className={containerClassName}
    >
      {/* Floating Exit Fullscreen Control & Emergency Pause Status while in Fullscreen */}
      {isFullscreen && (
        <>
          {isEmergencyPaused && (
            <div
              data-testid="fullscreen-emergency-badge"
              className="absolute top-3 left-3 z-30 px-3 py-1.5 rounded-full bg-red-950/90 border border-red-500/70 text-red-100 text-xs font-bold uppercase tracking-wider shadow-lg pointer-events-none"
            >
              Emergency Paused
            </div>
          )}
          <button
            type="button"
            onClick={() => void exitFullscreen()}
            data-testid="exit-fullscreen-btn"
            aria-label="Exit fullscreen"
            title="Exit fullscreen"
            className="absolute top-3 right-3 z-30 p-2.5 rounded-xl bg-[#171717]/90 hover:bg-[#202020] text-[#F0D89F] border border-[#D6B56D]/50 shadow-xl backdrop-blur-md transition-colors cursor-pointer"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </>
      )}

      {/* 1. YOUTUBE PLAYER CONTAINER */}
      {provider === 'YOUTUBE' && (
        <div className="relative w-full h-full">
          <div id="synctheater-yt-iframe" className="w-full h-full pointer-events-auto" />
          {playbackMode === 'LIVE' && showManualReconnect && status === 'PLAYING' && !isEmergencyPaused && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#090909]/85 backdrop-blur-sm p-6 text-center">
              <p className="text-sm font-semibold text-[#FFFFFF] mb-2">
                Live stream playback appears stalled.
              </p>
              {reconnectError && (
                <p className="text-xs text-[#F0D89F] mb-3" data-testid="reconnect-error">
                  {reconnectError}
                </p>
              )}
              <button
                type="button"
                onClick={handleManualReconnect}
                disabled={isReconnecting}
                data-testid="manual-reconnect-btn"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold btn-gold-primary shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isReconnecting ? 'animate-spin' : ''}`} />
                <span>{isReconnecting ? 'Reconnecting...' : 'Reconnect to Live Stream'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. DIRECT HTML5 OR HLS PLAYER */}
      {(provider === 'DIRECT' || provider === 'HLS') && (
        <video
          ref={videoElementRef}
          className="w-full h-full object-contain bg-[#000000]"
          playsInline
          controls={isOwnerOrMod}
        />
      )}

      {/* 3. GOOGLE DRIVE PREVIEW EMBED */}
      {provider === 'GOOGLE_DRIVE' && (
        <div className="relative w-full h-full">
          <div
            className={`absolute top-3 left-3 ${
              isFullscreen ? 'right-16' : 'right-3'
            } z-20 flex items-center gap-2.5 bg-[#171717]/90 backdrop-blur-md border border-[#D6B56D]/40 text-[#F0D89F] text-xs px-3.5 py-2 rounded-xl shadow-xl pointer-events-auto`}
          >
            <AlertCircle className="w-4 h-4 text-[#D6B56D] shrink-0" />
            <p className="leading-tight">
              <strong>Google Drive Preview:</strong> Automatic playback synchronization and seek control cannot be guaranteed due to third-party iframe sandboxing policies.
            </p>
          </div>
          <iframe
            src={`https://drive.google.com/file/d/${videoId}/preview`}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}

      {/* 4. UNSUPPORTED SOURCE FALLBACK */}
      {provider === 'UNSUPPORTED' && (
        <div className="p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-[#202020] border border-[#D6B56D]/40 text-[#D6B56D] mx-auto flex items-center justify-center mb-4 text-2xl font-bold">
            !
          </div>
          <h3 className="text-lg font-bold text-[#FFFFFF] mb-2">Unsupported Video Source</h3>
          <p className="text-xs text-[#B9B9B9] mb-6 leading-relaxed">
            SYNCTHEATER supports YouTube videos & Shorts, Google Drive share links, direct MP4/WebM files, and HLS .m3u8 streams.
          </p>
        </div>
      )}
    </div>
  );
}
