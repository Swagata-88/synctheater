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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="glass-panel w-full max-w-sm rounded-2xl border border-white/15 p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">Private Cinema</h3>
        <p className="text-xs text-gray-400 mb-4">
          This theater requires an access password to join.
        </p>

        {error && (
          <p className="text-xs text-rose-400 mb-3">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            required
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Enter password..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-indigo-500 outline-none"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isSubmitting ? 'Unlocking...' : 'Unlock & Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
