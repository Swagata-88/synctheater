'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import { apiRequest } from '../../lib/api';
import { KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const res = await apiRequest<{ message: string; resetToken?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      setSuccess(
        res.resetToken
          ? `Password reset simulation token: ${res.resetToken}. You can use this token to reset your password.`
          : 'Password reset instructions have been sent to your email.'
      );
    } catch (err: any) {
      setError(err.message || 'Failed to process request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] text-white">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 mx-auto flex items-center justify-center text-amber-400 mb-4">
                <KeyRound className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Reset Password</h1>
              <p className="text-sm text-gray-400 mt-1">Enter your email to receive recovery instructions</p>
            </div>

            {error && (
              <div className="mb-6 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Account Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-gray-500 text-sm outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-3 text-center">
              <Link
                href="/reset-password"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Already have a reset token? Enter it here →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
