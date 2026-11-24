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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-md cinema-card rounded-2xl p-5 border border-[#353535] shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#202020] border border-[#353535] flex items-center justify-center">
              <Share2 className="w-4 h-4 text-[#D6B56D]" />
            </div>
            <h3 id="invite-modal-title" className="text-sm font-bold text-[#FFFFFF]">
              Room Invitation Link
            </h3>
          </div>
          <button
            data-testid="close-invite-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#777777] hover:text-[#FFFFFF] hover:bg-[#202020] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#B9B9B9] leading-relaxed">
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
            className="flex-1 px-3 py-2 text-xs font-mono bg-[#111111] border border-[#353535] rounded-xl text-[#FFFFFF] focus:outline-none focus:border-[#D6B56D] select-all"
          />
          <button
            data-testid="modal-copy-btn"
            onClick={handleModalCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 btn-gold-primary rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
          >
            {modalCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#090909]" />
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
            className="px-4 py-1.5 bg-[#202020] hover:bg-[#282828] border border-[#353535] text-[#FFFFFF] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
