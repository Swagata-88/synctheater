'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { Film, PlusCircle, Compass, LogIn, UserPlus, LogOut, User, Settings } from 'lucide-react';

export function Navbar() {
  const { user, profile, logout } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#090b10]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-400 p-[1.5px] shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#0d101a] rounded-[10px] flex items-center justify-center">
              <Film className="w-5 h-5 text-indigo-400 group-hover:text-amber-400 transition-colors" />
            </div>
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-100 to-indigo-300 bg-clip-text text-transparent">
              SYNCTHEATER
            </span>
            <span className="hidden sm:block text-[10px] text-gray-400 font-medium tracking-wide uppercase">
              In Sync. Anywhere.
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <Compass className="w-4 h-4 text-indigo-400" />
            Dashboard
          </Link>
          <Link
            href="/dashboard?create=true"
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            Create Room
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full hover:bg-white/5 border border-white/10 transition-colors"
              >
                <img
                  src={profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`}
                  alt={user.username}
                  className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-500/40 object-cover"
                />
                <span className="text-sm font-medium text-gray-200 hidden sm:inline-block max-w-[120px] truncate">
                  {user.username}
                </span>
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 glass-dropdown rounded-xl shadow-2xl p-1.5 z-50 text-sm animate-in fade-in zoom-in-95"
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <p className="text-xs text-gray-400">Signed in as</p>
                    <p className="font-semibold text-white truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <User className="w-4 h-4 text-indigo-400" />
                    Profile & Avatar
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                    Settings & Themes
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 rounded-lg shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
              >
                <UserPlus className="w-4 h-4" />
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
