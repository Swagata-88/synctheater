'use client';

import React, { useState } from 'react';
import { Tv, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface ChangeVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitVideo: (videoUrl: string) => void;
}

export function ChangeVideoModal({
  isOpen,
  onClose,
  onSubmitVideo,
}: ChangeVideoModalProps) {
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [resolvedPreview, setResolvedPreview] = useState<any>(null);
  const [isResolving, setIsResolving] = useState(false);

  if (!isOpen) return null;

  const handleUrlInput = async (url: string) => {
    setNewVideoUrl(url);
    if (!url.trim()) {
      setResolvedPreview(null);
      return;
    }
    setIsResolving(true);
    try {
      const res = await apiRequest('/api/video/resolve', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      setResolvedPreview(res);
    } catch (e) {
      setResolvedPreview(null);
    } finally {
      setIsResolving(false);
    }
  };

  const handleConfirmChangeVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideoUrl.trim() || !resolvedPreview?.isSupported) return;
    onSubmitVideo(newVideoUrl);
    setNewVideoUrl('');
    setResolvedPreview(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-white/15 p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Tv className="w-4 h-4 text-indigo-400" />
            Change Theater Video
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleConfirmChangeVideo} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              New Video or Stream URL
            </label>
            <input
              type="text"
              required
              value={newVideoUrl}
              onChange={(e) => handleUrlInput(e.target.value)}
              placeholder="Paste YouTube, Google Drive, MP4, or HLS .m3u8 link"
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-indigo-500 outline-none"
            />
          </div>

          {isResolving && (
            <p className="text-xs text-indigo-400 flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              Analyzing provider...
            </p>
          )}

          {resolvedPreview && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2.5 ${
                resolvedPreview.isSupported
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
              }`}
            >
              {resolvedPreview.isSupported ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <div>
                <p className="font-bold">
                  {resolvedPreview.provider}: {resolvedPreview.title}
                </p>
                {resolvedPreview.notes && (
                  <p className="text-[11px] opacity-80 mt-0.5">{resolvedPreview.notes}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!resolvedPreview?.isSupported}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Switch Video
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
