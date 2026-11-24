'use client';

import React from 'react';
import { Play, AlertOctagon } from 'lucide-react';

interface EmergencyPauseBannerProps {
  isEmergencyPaused: boolean;
  emergencyPausedBy?: {
    userId: string;
    username: string;
  } | null;
  isOwnerOrMod: boolean;
  onResume: () => void;
}

export function EmergencyPauseBanner({
  isEmergencyPaused,
  emergencyPausedBy,
  isOwnerOrMod,
  onResume,
}: EmergencyPauseBannerProps) {
  if (!isEmergencyPaused) return null;

  return (
    <div className="w-full mb-4 p-4 rounded-2xl bg-[#1A0A0A] border-2 border-red-500 shadow-2xl shadow-red-950/60 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-600/40">
          <AlertOctagon className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
            <span>EMERGENCY PAUSE ACTIVATED</span>
            <span className="text-[10px] bg-red-500/30 text-red-200 border border-red-500/40 px-2 py-0.5 rounded-full font-mono">
              ALL CLIENTS HALTED
            </span>
          </h4>
          <p className="text-xs text-red-200 mt-0.5">
            Paused by{' '}
            <strong className="text-white font-semibold">
              @{emergencyPausedBy?.username || 'a participant'}
            </strong>
            . Playback is paused across all participants until the host resumes.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        {isOwnerOrMod ? (
          <button
            onClick={onResume}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#FFFFFF] text-[#090909] hover:bg-[#F0D89F] shadow-lg transition-all cursor-pointer hover:scale-105"
          >
            <Play className="w-4 h-4 fill-current text-red-600" />
            Clear & Resume Playback
          </button>
        ) : (
          <span className="text-xs text-red-300 italic">
            Waiting for host to resume...
          </span>
        )}
      </div>
    </div>
  );
}
