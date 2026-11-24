'use client';

import React, { useState } from 'react';
import { Tv, CheckCircle2, AlertCircle, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/85 backdrop-blur-md">
      <div className="cinema-card w-full max-w-lg rounded-2xl border border-[#353535] p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D6B56D] to-transparent" />

        <div className="flex items-center justify-between pb-3 border-b border-[#353535] mb-4">
          <h3 className="text-base font-bold text-[#FFFFFF] flex items-center gap-2">
            <Tv className="w-4 h-4 text-[#D6B56D]" />
            Change Theater Video
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#777777] hover:text-[#FFFFFF] hover:bg-[#202020] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirmChangeVideo} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#B9B9B9] uppercase tracking-wider mb-1.5">
              New Video or Stream URL
            </label>
            <input
              type="text"
              required
              value={newVideoUrl}
              onChange={(e) => handleUrlInput(e.target.value)}
              placeholder="Paste YouTube, Google Drive, MP4, or HLS .m3u8 link"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#353535] text-[#FFFFFF] placeholder-[#777777] text-sm focus:border-[#D6B56D] outline-none transition-colors"
            />
          </div>

          {isResolving && (
            <p className="text-xs text-[#D6B56D] flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-[#D6B56D] border-t-transparent rounded-full animate-spin" />
              Analyzing provider...
            </p>
          )}

          {resolvedPreview && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2.5 ${
                resolvedPreview.isSupported
                  ? 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-200'
                  : 'bg-red-950/60 border border-red-700/50 text-red-200'
              }`}
            >
              {resolvedPreview.isSupported ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
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

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#353535]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#B9B9B9] hover:text-[#FFFFFF] hover:bg-[#202020] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!resolvedPreview?.isSupported}
              className="px-5 py-2 rounded-xl text-xs font-bold btn-gold-primary disabled:opacity-40 transition-all cursor-pointer"
            >
              Switch Video
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
