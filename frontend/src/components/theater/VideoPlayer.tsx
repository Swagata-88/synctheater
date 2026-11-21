'use client';

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertCircle } from 'lucide-react';

interface VideoPlayerProps {
  provider: 'YOUTUBE' | 'DIRECT' | 'HLS' | 'GOOGLE_DRIVE' | 'UNSUPPORTED';
  videoId: string;
  videoUrl: string;
  status: 'PLAYING' | 'PAUSED' | 'BUFFERING';
  currentPosition: number;
  playbackRate: number;
  lastServerTimestamp: number;
  isOwnerOrMod: boolean;
  onPlayerReady?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlayAction?: () => void;
  onPauseAction?: () => void;
  onSeekAction?: (time: number) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function VideoPlayer({
  provider,
  videoId,
  videoUrl,
  status,
  currentPosition,
  playbackRate,
  lastServerTimestamp,
  isOwnerOrMod,
  onPlayerReady,
  onTimeUpdate,
  onPlayAction,
  onPauseAction,
  onSeekAction,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Calculate authoritative effective position
  const getAuthoritativePosition = () => {
    if (status !== 'PLAYING') return currentPosition;
    const elapsed = (Date.now() - lastServerTimestamp) / 1000;
    return Math.max(0, currentPosition + elapsed * playbackRate);
  };

  // --- YOUTUBE IFRAME API INITIALIZATION ---
  useEffect(() => {
    if (provider !== 'YOUTUBE') return;

    let isSubscribed = true;

    const initYT = () => {
      if (!window.YT || !window.YT.Player) return;

      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {}
      }

      ytPlayerRef.current = new window.YT.Player('synctheater-yt-iframe', {
        videoId,
        playerVars: {
          autoplay: status === 'PLAYING' ? 1 : 0,
          controls: isOwnerOrMod ? 1 : 0,
          disablekb: isOwnerOrMod ? 0 : 1,
          fs: 1,
          modestbranding: 1,
          rel: 0,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        },
        events: {
          onReady: (event: any) => {
            if (!isSubscribed) return;
            setIsReady(true);
            onPlayerReady?.();
            const targetPos = getAuthoritativePosition();
            event.target.seekTo(targetPos, true);
            if (status === 'PLAYING') {
              event.target.playVideo();
            } else {
              event.target.pauseVideo();
            }
          },
          onStateChange: (event: any) => {
            // Can monitor local buffering or user actions
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
        if (isSubscribed) initYT();
      };
    }

    return () => {
      isSubscribed = false;
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

    if (provider === 'HLS' && videoUrl.includes('.m3u8')) {
      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
        const hls = new Hls({ enableWorker: true });
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
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
        setIsReady(true);
        onPlayerReady?.();
        const target = getAuthoritativePosition();
        video.currentTime = target;
        if (status === 'PLAYING') video.play().catch(() => {});
      };
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [provider, videoUrl]);

  // --- DRIFT COMPENSATION & SYNCHRONIZATION LOOP ---
  useEffect(() => {
    const syncInterval = setInterval(() => {
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
  }, [provider, status, currentPosition, playbackRate, lastServerTimestamp, isReady]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center border border-white/10"
    >
      {/* 1. YOUTUBE PLAYER CONTAINER */}
      {provider === 'YOUTUBE' && (
        <div className="w-full h-full">
          <div id="synctheater-yt-iframe" className="w-full h-full pointer-events-auto" />
        </div>
      )}

      {/* 2. DIRECT HTML5 OR HLS PLAYER */}
      {(provider === 'DIRECT' || provider === 'HLS') && (
        <video
          ref={videoElementRef}
          className="w-full h-full object-contain"
          playsInline
          controls={isOwnerOrMod}
        />
      )}

      {/* 3. GOOGLE DRIVE PREVIEW EMBED */}
      {provider === 'GOOGLE_DRIVE' && (
        <div className="relative w-full h-full">
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-2.5 bg-black/85 backdrop-blur-md border border-amber-500/40 text-amber-200 text-xs px-3.5 py-2 rounded-xl shadow-xl pointer-events-auto">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
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
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center mb-4">
            ⚠️
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Unsupported Video Source</h3>
          <p className="text-xs text-gray-400 mb-6">
            SYNCTHEATER supports YouTube videos & Shorts, Google Drive share links, direct MP4/WebM files, and HLS .m3u8 streams.
          </p>
        </div>
      )}
    </div>
  );
}
