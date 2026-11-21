'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';
import { Film, LogIn, AlertCircle } from 'lucide-react';
import { sanitizeReturnUrl } from '../../lib/api';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const safeReturnUrl = sanitizeReturnUrl(returnUrl);
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
      {/* Card */}
      <div className="glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400" />

        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/40 mx-auto flex items-center justify-center text-indigo-400 mb-4">
            <Film className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-sm text-gray-400 mt-1">
            {returnUrl ? 'Sign in to join this private watch room' : 'Sign in to your SYNCTHEATER account'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Email or Username
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@domain.com or username"
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-gray-500 text-sm outline-none transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Forgot?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
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
              <>
                <LogIn className="w-4 h-4" />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 text-center text-sm text-gray-400">
          Don't have an account yet?{' '}
          <Link href={registerHref} className="text-indigo-400 hover:text-indigo-300 font-medium">
            Create one now
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] text-white">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <Suspense fallback={<div className="text-gray-400 text-sm">Loading sign-in form...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
