'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';
import { IrisEmblem } from '../../components/brand/Logo';
import { LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { sanitizeReturnUrl } from '../../lib/api';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const safeReturnUrl = sanitizeReturnUrl(returnUrl);
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(identifier, password);
      if (safeReturnUrl) {
        router.push(safeReturnUrl);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const registerHref = safeReturnUrl
    ? `/register?returnUrl=${encodeURIComponent(safeReturnUrl)}`
    : '/register';

  return (
    <div className="w-full max-w-md">
      <div className="cinema-card p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle top gold accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D6B56D] to-transparent" />

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <IrisEmblem size="lg" className="drop-shadow-[0_4px_16px_rgba(214,181,109,0.25)]" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#FFFFFF]">Welcome Back</h1>
          <p className="text-xs text-[#B9B9B9] mt-1.5">
            {returnUrl ? 'Sign in to access this private theater' : 'Sign in to your SYNCTHEATER account'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-950/60 border border-red-700/50 text-red-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#B9B9B9] uppercase tracking-wider mb-1.5">
              Email or Username
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@domain.com or username"
              className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-[#353535] focus:border-[#D6B56D] text-[#FFFFFF] placeholder-[#777777] text-sm outline-none transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#B9B9B9] uppercase tracking-wider">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[#D6B56D] hover:text-[#F0D89F] transition-colors"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 pr-11 rounded-xl bg-[#111111] border border-[#353535] focus:border-[#D6B56D] text-[#FFFFFF] placeholder-[#777777] text-sm outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-[#777777] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
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
              <>
                <LogIn className="w-4 h-4" />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#353535] text-center text-xs text-[#B9B9B9]">
          Don't have an account yet?{' '}
          <Link href={registerHref} className="text-[#D6B56D] hover:text-[#F0D89F] font-semibold transition-colors">
            Create one now
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#090909] text-[#FFFFFF]">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <Suspense fallback={<div className="text-[#B9B9B9] text-sm">Loading sign-in...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
