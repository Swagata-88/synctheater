'use client';

import React, { useState } from 'react';
import { AlertOctagon, X } from 'lucide-react';

interface EndRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  onConfirmEndRoom: () => Promise<void | any>;
}

export function EndRoomModal({
  isOpen,
  onClose,
  roomName,
  onConfirmEndRoom,
}: EndRoomModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEndRoom = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await onConfirmEndRoom();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to end the room.');
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-room-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md cinema-card border border-red-900/60 p-6 shadow-2xl rounded-2xl bg-[#111111] text-[#FFFFFF]">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#777777] hover:text-[#FFFFFF] hover:bg-[#202020] transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon & Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-500/40 flex items-center justify-center text-red-400">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <h3 id="end-room-title" className="text-base font-bold text-[#FFFFFF]">
              End Watch Room For Everyone?
            </h3>
            <p className="text-xs text-[#B9B9B9] truncate max-w-[280px]">
              {roomName || 'Current Theater'}
            </p>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs">
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Informative Explanation */}
        <div className="space-y-3 mb-6 text-xs text-[#B9B9B9] leading-relaxed">
          <p className="p-3 rounded-xl bg-red-950/40 border border-red-900/40 text-red-200">
            ⚠️ <strong>Ending the room is permanent.</strong> All connected viewers will be immediately disconnected and returned to their dashboards. Active invitation links will be revoked.
          </p>
          <p>
            The watch session and all viewer attendance intervals will be preserved permanently in personal <strong>Watch History</strong>.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#353535]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#202020] hover:bg-[#282828] text-[#B9B9B9] hover:text-[#FFFFFF] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleEndRoom}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-red-950/50"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Closing Room...</span>
              </>
            ) : (
              <span>End Room For Everyone</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
