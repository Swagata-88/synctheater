'use client';

import React, { useState } from 'react';
import { Lock } from 'lucide-react';

interface RoomPasswordModalProps {
  isOpen: boolean;
  onSubmitPassword: (password: string) => Promise<void>;
  error?: string | null;
}

export function RoomPasswordModal({
  isOpen,
  onSubmitPassword,
  error,
}: RoomPasswordModalProps) {
  const [passwordInput, setPasswordInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) return;
    setIsSubmitting(true);
    try {
      await onSubmitPassword(passwordInput);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/85 backdrop-blur-md">
      <div className="cinema-card w-full max-w-sm rounded-2xl border border-[#353535] p-6 text-center shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D6B56D] to-transparent" />
        <div className="w-12 h-12 rounded-xl bg-[#202020] border border-[#353535] text-[#D6B56D] mx-auto flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-[#D6B56D]" />
        </div>
        <h3 className="text-lg font-bold text-[#FFFFFF] mb-1">Private Cinema</h3>
        <p className="text-xs text-[#B9B9B9] mb-4">
          This theater requires an access password to join.
        </p>

        {error && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            required
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Enter room password..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#353535] text-[#FFFFFF] text-sm focus:border-[#D6B56D] outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl text-xs font-bold btn-gold-primary disabled:opacity-50 transition-all cursor-pointer"
          >
            {isSubmitting ? 'Unlocking...' : 'Unlock & Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
