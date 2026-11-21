'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-white/15 p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold">Create Private Watch Room</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Privacy Notice Banner */}
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5">
          <Lock className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            All watch party rooms are strictly <strong>private</strong>. Only invited members with a valid invitation link can join.
          </span>
        </div>

        {createError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{createError}</span>
          </div>
        )}

        <form onSubmit={handleCreateRoom} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
              Room Name
            </label>
            <input
              type="text"
              required
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Weekend Anime Marathon"
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={roomDesc}
              onChange={(e) => setRoomDesc(e.target.value)}
              placeholder="What are we watching?"
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-indigo-500 outline-none resize-none"
            />
          </div>

          {/* Initial Video URL Input with Auto-Resolution */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
              Initial Video URL (Optional)
            </label>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => handleResolveVideo(e.target.value)}
              placeholder="Paste YouTube, Google Drive, MP4, or HLS URL"
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-indigo-500 outline-none"
            />

            {isResolvingVideo && (
              <p className="text-xs text-indigo-400 mt-1 flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Detecting video source...
              </p>
            )}

            {resolvedVideo && (
              <div
                className={`mt-2 p-2.5 rounded-xl text-xs flex items-center justify-between ${
                  resolvedVideo.isSupported
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {resolvedVideo.isSupported ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
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
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
              Additional Room Password (Optional)
            </label>
            <input
              type="password"
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              placeholder="Leave empty for standard invite-link protection"
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Max Capacity */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Maximum Room Capacity
              </label>
              <span className="text-xs font-mono text-indigo-400">{maxCapacity} viewers</span>
            </div>
            <input
              type="range"
              min="2"
              max="100"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Launch Private Theater'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
