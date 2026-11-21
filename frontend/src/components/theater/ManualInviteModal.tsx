'use client';

import React, { useState } from 'react';
import { Share2, X, Check, Copy } from 'lucide-react';
import { copyToClipboard } from '../../lib/clipboard';

interface ManualInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteUrl: string;
}

export function ManualInviteModal({ isOpen, onClose, inviteUrl }: ManualInviteModalProps) {
  const [modalCopied, setModalCopied] = useState(false);

  if (!isOpen) return null;

  const handleModalCopy = async () => {
    const result = await copyToClipboard(inviteUrl);
    if (result.success) {
      setModalCopied(true);
      setTimeout(() => setModalCopied(false), 2500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-md glass-panel rounded-2xl p-5 border border-white/20 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-indigo-400" />
            </div>
            <h3 id="invite-modal-title" className="text-sm font-semibold text-white">
              Room Invitation Link
            </h3>
          </div>
          <button
            data-testid="close-invite-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-300">
          Direct clipboard access was restricted by your browser. You can select and copy the room invitation link below:
        </p>

        <div className="flex items-center gap-2">
          <input
            data-testid="manual-invite-input"
            type="text"
            readOnly
            value={inviteUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            onFocus={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 px-3 py-2 text-xs font-mono bg-black/40 border border-white/15 rounded-xl text-gray-200 focus:outline-none focus:border-indigo-500 select-all"
          />
          <button
            data-testid="modal-copy-btn"
            onClick={handleModalCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors shrink-0"
          >
            {modalCopied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <div className="flex justify-end pt-1">
          <button
            data-testid="modal-done-btn"
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-gray-200 rounded-xl text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
