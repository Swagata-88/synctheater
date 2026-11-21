'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';
import { Film, UserPlus, AlertCircle } from 'lucide-react';
import { sanitizeReturnUrl } from '../../lib/api';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const safeReturnUrl = sanitizeReturnUrl(returnUrl);
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, username, password);
      if (safeReturnUrl) {
        router.push(safeReturnUrl);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loginHref = safeReturnUrl
    ? `/login?returnUrl=${encodeURIComponent(safeReturnUrl)}`
    : '/login';

  return (
    <div className="w-full max-w-md">
      <div className="glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-amber-400" />

        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/40 mx-auto flex items-center justify-center text-emerald-400 mb-4">
            <Film className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create Account</h1>
          <p className="text-sm text-gray-400 mt-1">
            {returnUrl ? 'Create an account to join this private watch room' : 'Join the synchronized cinema community'}
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
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@domain.com"
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-gray-500 text-sm outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Choose Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="CinemaFan42"
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-gray-500 text-sm outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-gray-500 text-sm outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-gray-500 text-sm outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Complete Registration
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link href={loginHref} className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] text-white">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <Suspense fallback={<div className="text-gray-400 text-sm">Loading registration form...</div>}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
