'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import { IrisEmblem } from '../../components/brand/Logo';
import { apiRequest } from '../../lib/api';
import { ArrowLeft, CheckCircle2, AlertCircle, Mail } from 'lucide-react';

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
      const res = await apiRequest<{ message: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      setSuccess(
        res.message ||
          'If an account exists with this email address, password reset instructions have been sent.'
      );
    } catch (err: any) {
      setError(err.message || 'Failed to process request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090909] text-[#FFFFFF]">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="cinema-card p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D6B56D] to-transparent" />

            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <IrisEmblem size="lg" className="drop-shadow-[0_4px_16px_rgba(214,181,109,0.25)]" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#FFFFFF]">Reset Password</h1>
              <p className="text-xs text-[#B9B9B9] mt-1.5">Enter your email to receive recovery instructions</p>
            </div>

            {error && (
              <div className="mb-6 p-3.5 rounded-xl bg-red-950/60 border border-red-700/50 text-red-200 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 rounded-xl bg-[#202020] border border-[#D6B56D]/40 text-xs flex flex-col gap-2.5">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#D6B56D] mt-0.5" />
                  <span className="font-medium text-[#FFFFFF] leading-relaxed">{success}</span>
                </div>
                <p className="text-[11px] text-[#B9B9B9] pl-6.5 leading-relaxed">
                  Please check your inbox (and spam folder) for a secure reset link. The link is single-use and valid for 1 hour.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#B9B9B9] uppercase tracking-wider mb-1.5">
                  Account Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-[#111111] border border-[#353535] focus:border-[#D6B56D] text-[#FFFFFF] placeholder-[#777777] text-sm outline-none transition-colors"
                  />
                  <Mail className="absolute right-3.5 top-3.5 w-4 h-4 text-[#777777]" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold btn-gold-primary disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-[#090909]/40 border-t-[#090909] rounded-full animate-spin" />
                ) : (
                  'Send Reset Instructions'
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-[#353535] flex flex-col gap-3 text-center">
              <Link
                href="/reset-password"
                className="text-xs text-[#D6B56D] hover:text-[#F0D89F] font-semibold transition-colors"
              >
                Already have a reset token? Enter it here →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 text-xs text-[#B9B9B9] hover:text-[#FFFFFF] transition-colors"
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
