'use client';

import React, { useState } from 'react';
import {
  Play,
  Pause,
  AlertOctagon,
  Video,
  Share2,
  Sparkles,
  Check,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { copyToClipboard } from '../../lib/clipboard';
import { getAppUrl } from '../../lib/api';
import { ManualInviteModal } from './ManualInviteModal';
import { BroadcastStatus, PlaybackMode } from '../../types';

interface PlaybackControlsProps {
  status: 'PLAYING' | 'PAUSED' | 'BUFFERING';
  playbackMode?: PlaybackMode;
  broadcastStatus?: BroadcastStatus;
  currentTime: number;
  duration: number;
  playbackRate: number;
  isOwnerOrMod: boolean;
  theaterSetting: 'classic' | 'cozy' | 'gaming' | 'minimal';
  inviteUrl?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onEmergencyPause: () => void;
  onChangeVideoClick: () => void;
  onChangeRate: (rate: number) => void;
  onChangeTheme: (theme: 'classic' | 'cozy' | 'gaming' | 'minimal') => void;
}

export function PlaybackControls({
  status,
  playbackMode = 'VOD',
  broadcastStatus = 'UNKNOWN_UNVERIFIED',
  currentTime,
  duration,
  playbackRate,
  isOwnerOrMod,
  theaterSetting,
  inviteUrl,
  isFullscreen = false,
  onToggleFullscreen,
  onPlay,
  onPause,
  onSeek,
  onEmergencyPause,
  onChangeVideoClick,
  onChangeRate,
  onChangeTheme,
}: PlaybackControlsProps) {
  const [copiedToast, setCopiedToast] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showRateMenu, setShowRateMenu] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  const isLiveMode = playbackMode === 'LIVE';

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getResolvedInviteUrl = () => {
    if (inviteUrl) return inviteUrl;
    if (typeof window !== 'undefined' && window.location) {
      return window.location.href;
    }
    return getAppUrl();
  };

  const handleShareLink = async () => {
    const url = getResolvedInviteUrl();
    if (!url) return;

    try {
      const result = await copyToClipboard(url);
      if (result.success) {
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2500);
      } else {
        setShowManualModal(true);
      }
    } catch (err) {
      console.warn('Clipboard share error caught, opening manual fallback:', err);
      setShowManualModal(true);
    }
  };

  return (
    <>
      <div className="w-full cinema-card p-4 border border-[#353535] shadow-2xl space-y-3">
        {/* Top: Progress Scrubbing Bar (VOD) or LIVE Status Bar (LIVE) */}
        {isLiveMode ? (
          <div className="flex items-center justify-between gap-3 py-1" data-testid="live-status-bar">
            {broadcastStatus === 'ACTIVE_LIVE' ? (
              <div
                data-testid="live-badge"
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#202020] border border-[#D6B56D]/60 text-[#F0D89F] text-xs font-bold tracking-wider uppercase"
              >
                <span className="w-2 h-2 rounded-full bg-[#D6B56D] animate-pulse" />
                <span>LIVE</span>
              </div>
            ) : broadcastStatus === 'ENDED' ? (
              <div
                data-testid="live-neutral-status"
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#202020] border border-[#353535] text-[#B9B9B9] text-xs font-semibold"
              >
                <span>Broadcast Ended</span>
              </div>
            ) : broadcastStatus === 'RESTRICTED_OR_UNAVAILABLE' ? (
              <div
                data-testid="live-neutral-status"
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#202020] border border-[#353535] text-[#B9B9B9] text-xs font-semibold"
              >
                <span>Stream Unavailable</span>
              </div>
            ) : (
              <div
                data-testid="live-neutral-status"
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#202020] border border-[#353535] text-[#B9B9B9] text-xs font-semibold"
              >
                <span>Live Stream (Unverified)</span>
              </div>
            )}

            <span className="text-[11px] font-mono text-[#777777]">
              Synchronized Broadcast Mode
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#B9B9B9] w-12 text-right">
              {formatTime(currentTime)}
            </span>

            <div className="flex-1 relative flex items-center group">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.5}
                value={currentTime}
                disabled={!isOwnerOrMod}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="w-full h-1.5 bg-[#202020] rounded-lg appearance-none cursor-pointer accent-[#D6B56D] disabled:cursor-not-allowed transition-all"
              />
            </div>

            <span className="text-xs font-mono text-[#B9B9B9] w-12">
              {formatTime(duration)}
            </span>
          </div>
        )}

        {/* Bottom: Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Left Side: Play/Pause, Change Video */}
          <div className="flex items-center gap-2">
            {isOwnerOrMod ? (
              <button
                title={status === 'PLAYING' ? 'Pause Video' : 'Play Video'}
                onClick={status === 'PLAYING' ? onPause : onPlay}
                className="w-10 h-10 rounded-xl btn-gold-primary flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                {status === 'PLAYING' ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>
            ) : (
              <div className="text-xs text-[#B9B9B9] px-3 py-2 bg-[#202020] rounded-xl border border-[#353535]">
                Synced to Host
              </div>
            )}

            {isOwnerOrMod && (
              <button
                onClick={onChangeVideoClick}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#202020] hover:bg-[#282828] text-[#FFFFFF] border border-[#353535] hover:border-[#D6B56D] transition-colors cursor-pointer"
              >
                <Video className="w-4 h-4 text-[#D6B56D]" />
                Change Video
              </button>
            )}

            {/* Speed Rate Dropdown (VOD only) */}
            {!isLiveMode && (
              <div className="relative">
                <button
                  onClick={() => setShowRateMenu(!showRateMenu)}
                  className="px-2.5 py-2 rounded-xl text-xs font-mono font-semibold bg-[#202020] hover:bg-[#282828] text-[#FFFFFF] border border-[#353535] transition-colors cursor-pointer"
                >
                  {playbackRate}x
                </button>

                {showRateMenu && (
                  <div
                    className="absolute left-0 bottom-full mb-2 w-24 cinema-dropdown rounded-xl p-1 z-30 shadow-xl"
                    onClick={() => setShowRateMenu(false)}
                  >
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => onChangeRate(rate)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                          playbackRate === rate ? 'bg-[#D6B56D] text-[#090909] font-bold' : 'text-[#B9B9B9] hover:bg-[#202020] hover:text-[#FFFFFF]'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center: EMERGENCY PAUSE BUTTON (Accessible to ALL) */}
          <div>
            <button
              onClick={onEmergencyPause}
              data-testid="emergency-pause-btn"
              title="Emergency Pause halts playback for everyone immediately"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>Emergency Pause</span>
            </button>
          </div>

          {/* Right Side: Theme Switcher, Share Link */}
          <div className="flex items-center gap-2">
            {/* Ambience Theme Picker */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#202020] hover:bg-[#282828] text-[#FFFFFF] border border-[#353535] transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#D6B56D]" />
                <span className="capitalize">{theaterSetting}</span>
              </button>

              {showThemeMenu && (
                <div
                  className="absolute right-0 bottom-full mb-2 w-44 cinema-dropdown rounded-xl p-1.5 z-30 shadow-xl"
                  onClick={() => setShowThemeMenu(false)}
                >
                  <div className="px-2 py-1 text-[10px] text-[#777777] uppercase font-semibold">
                    Cinema Ambience
                  </div>
                  {(['classic', 'cozy', 'gaming', 'minimal'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onChangeTheme(mode)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                        theaterSetting === mode ? 'bg-[#D6B56D] text-[#090909] font-bold' : 'text-[#B9B9B9] hover:bg-[#202020] hover:text-[#FFFFFF]'
                      }`}
                    >
                      <span>{mode}</span>
                      {theaterSetting === mode && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Share Invitation */}
            <button
              onClick={handleShareLink}
              data-testid="invite-btn"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#202020] hover:bg-[#282828] text-[#FFFFFF] border border-[#353535] hover:border-[#D6B56D] transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-[#D6B56D]" />
              <span>{copiedToast ? 'Copied Link!' : 'Invite'}</span>
            </button>

            {/* Fullscreen Toggle (Independent for all participants) */}
            <button
              type="button"
              onClick={onToggleFullscreen}
              data-testid="fullscreen-btn"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="flex items-center justify-center p-2 rounded-xl bg-[#202020] hover:bg-[#282828] text-[#D6B56D] hover:text-[#F0D89F] border border-[#353535] hover:border-[#D6B56D] transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Manual Copy Fallback Modal */}
      <ManualInviteModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        inviteUrl={getResolvedInviteUrl()}
      />
    </>
  );
}
