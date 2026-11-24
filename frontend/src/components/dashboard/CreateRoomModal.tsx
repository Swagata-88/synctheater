'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, AlertCircle, CheckCircle2, Film, X } from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export function CreateRoomModal({ isOpen, onClose, user }: CreateRoomModalProps) {
  const router = useRouter();

  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [maxCapacity, setMaxCapacity] = useState(25);
  const [videoUrl, setVideoUrl] = useState('');
  const [isResolvingVideo, setIsResolvingVideo] = useState(false);
  const [resolvedVideo, setResolvedVideo] = useState<any>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleResolveVideo = async (url: string) => {
    setVideoUrl(url);
    if (!url.trim()) {
      setResolvedVideo(null);
      return;
    }
    setIsResolvingVideo(true);
    try {
      const res = await apiRequest('/api/video/resolve', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      setResolvedVideo(res);
    } catch (e) {
      setResolvedVideo(null);
    } finally {
      setIsResolvingVideo(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }

    setCreateError(null);
    setIsSubmitting(true);

    try {
      const res = await apiRequest<{
        room: { slug: string };
        initialInviteToken?: string;
        initialInviteUrl?: string;
      }>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: roomName,
          description: roomDesc,
          privacy: 'PRIVATE',
          password: roomPassword,
          maxCapacity: Number(maxCapacity),
          initialVideoUrl: videoUrl,
        }),
      });

      onClose();
      const inviteQuery = res.initialInviteToken ? `?invite=${encodeURIComponent(res.initialInviteToken)}` : '';
      router.push(`/room/${res.room.slug}${inviteQuery}`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create private watch room.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/85 backdrop-blur-md">
      <div className="cinema-card w-full max-w-lg border border-[#353535] p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D6B56D] to-transparent" />

        <div className="flex items-center justify-between pb-4 border-b border-[#353535] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#202020] border border-[#353535] text-[#D6B56D] flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-[#FFFFFF]">Create Private Watch Room</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#777777] hover:text-[#FFFFFF] hover:bg-[#202020] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Privacy Notice Banner */}
        <div className="mb-4 p-3 rounded-xl bg-[#202020] border border-[#D6B56D]/30 text-[#D6B56D] text-xs flex items-center gap-2.5">
          <Lock className="w-4 h-4 shrink-0 text-[#D6B56D]" />
          <span>
            Every theater is strictly <strong>private</strong>. Only invited members with a valid invitation link can join.
          </span>
        </div>

        {createError && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-700/50 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{createError}</span>
          </div>
        )}

        <form onSubmit={handleCreateRoom} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#B9B9B9] uppercase tracking-wider mb-1">
              Room Name
            </label>
            <input
              type="text"
              required
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Cinema Night with Friends"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#353535] text-[#FFFFFF] placeholder-[#777777] text-sm focus:border-[#D6B56D] outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#B9B9B9] uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={roomDesc}
              onChange={(e) => setRoomDesc(e.target.value)}
              placeholder="What movie or stream are we watching?"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#353535] text-[#FFFFFF] placeholder-[#777777] text-sm focus:border-[#D6B56D] outline-none resize-none transition-colors"
            />
          </div>

          {/* Initial Video URL Input with Auto-Resolution */}
          <div>
            <label className="block text-xs font-semibold text-[#B9B9B9] uppercase tracking-wider mb-1">
              Initial Video URL (Optional)
            </label>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => handleResolveVideo(e.target.value)}
              placeholder="Paste YouTube, Direct MP4, HLS (.m3u8), or Drive URL"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#353535] text-[#FFFFFF] placeholder-[#777777] text-sm focus:border-[#D6B56D] outline-none transition-colors"
            />

            {isResolvingVideo && (
              <p className="text-xs text-[#D6B56D] mt-1.5 flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-[#D6B56D] border-t-transparent rounded-full animate-spin" />
                Detecting video source...
              </p>
            )}

            {resolvedVideo && (
              <div
                className={`mt-2 p-2.5 rounded-xl text-xs flex items-center justify-between ${
                  resolvedVideo.isSupported
                    ? 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-200'
                    : 'bg-red-950/60 border border-red-700/50 text-red-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {resolvedVideo.isSupported ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span>
                    <strong>{resolvedVideo.provider}</strong>: {resolvedVideo.title}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Optional Room Password */}
          <div>
            <label className="block text-xs font-semibold text-[#B9B9B9] uppercase tracking-wider mb-1">
              Additional Room Password (Optional)
            </label>
            <input
              type="password"
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              placeholder="Leave empty for standard invite-link protection"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#353535] text-[#FFFFFF] placeholder-[#777777] text-sm focus:border-[#D6B56D] outline-none transition-colors"
            />
          </div>

          {/* Max Capacity */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-[#B9B9B9] uppercase tracking-wider">
                Maximum Room Capacity
              </label>
              <span className="text-xs font-mono text-[#D6B56D] font-bold">{maxCapacity} viewers</span>
            </div>
            <input
              type="range"
              min="2"
              max="100"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(Number(e.target.value))}
              className="w-full accent-[#D6B56D] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#353535]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#B9B9B9] hover:text-[#FFFFFF] hover:bg-[#202020] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl text-xs font-bold btn-gold-primary disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Launch Private Theater'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
