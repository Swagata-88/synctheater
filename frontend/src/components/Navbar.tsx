'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { Logo } from './brand/Logo';
import {
  PlusCircle,
  LayoutDashboard,
  LogIn,
  UserPlus,
  LogOut,
  User,
  Settings,
  Menu,
  X,
  HelpCircle,
} from 'lucide-react';

export function Navbar() {
  const { user, profile, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#353535] bg-[#090909]/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo with Official Iris Emblem */}
        <Logo href="/" size="sm" showTagline={false} />

        {/* Center Nav Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1.5">
          <Link
            href="/"
            className="px-3.5 py-2 text-sm font-medium text-[#B9B9B9] hover:text-[#FFFFFF] rounded-lg hover:bg-[#171717] transition-colors"
          >
            Home
          </Link>
          <Link
            href="/#how-it-works"
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-[#B9B9B9] hover:text-[#FFFFFF] rounded-lg hover:bg-[#171717] transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-[#D6B56D]" />
            How It Works
          </Link>
          {user && (
            <>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-[#B9B9B9] hover:text-[#FFFFFF] rounded-lg hover:bg-[#171717] transition-colors"
              >
                <LayoutDashboard className="w-4 h-4 text-[#D6B56D]" />
                Dashboard
              </Link>
              <Link
                href="/dashboard?create=true"
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-[#D6B56D] hover:text-[#F0D89F] rounded-lg hover:bg-[#171717] transition-colors"
              >
                <PlusCircle className="w-4 h-4 text-[#D6B56D]" />
                Create Room
              </Link>
            </>
          )}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full hover:bg-[#171717] border border-[#353535] transition-colors cursor-pointer"
              >
                <img
                  src={profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`}
                  alt={user.username}
                  className="w-8 h-8 rounded-full bg-[#171717] border border-[#D6B56D]/40 object-cover"
                />
                <span className="text-sm font-medium text-[#FFFFFF] hidden sm:inline-block max-w-[120px] truncate">
                  {user.username}
                </span>
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 cinema-dropdown rounded-xl p-1.5 z-50 text-sm animate-in fade-in zoom-in-95"
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-[#353535] mb-1">
                    <p className="text-xs text-[#777777]">Signed in as</p>
                    <p className="font-semibold text-[#FFFFFF] truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#B9B9B9] hover:text-[#FFFFFF] hover:bg-[#202020] transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#D6B56D]" />
                    Dashboard
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#B9B9B9] hover:text-[#FFFFFF] hover:bg-[#202020] transition-colors"
                  >
                    <User className="w-4 h-4 text-[#D6B56D]" />
                    Profile & Avatar
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#B9B9B9] hover:text-[#FFFFFF] hover:bg-[#202020] transition-colors"
                  >
                    <Settings className="w-4 h-4 text-[#B9B9B9]" />
                    Settings & Ambience
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors mt-1 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-3">
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#B9B9B9] hover:text-[#FFFFFF] rounded-lg hover:bg-[#171717] transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg btn-gold-primary transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Get Started
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="md:hidden p-2 rounded-lg text-[#B9B9B9] hover:text-[#FFFFFF] hover:bg-[#171717] border border-[#353535] transition-colors"
            aria-label="Toggle navigation"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="md:hidden border-t border-[#353535] bg-[#090909] px-4 py-4 space-y-2">
          <Link
            href="/"
            onClick={() => setMobileNavOpen(false)}
            className="block px-3 py-2 text-sm font-medium text-[#B9B9B9] hover:text-[#FFFFFF] rounded-lg hover:bg-[#171717]"
          >
            Home
          </Link>
          <Link
            href="/#how-it-works"
            onClick={() => setMobileNavOpen(false)}
            className="block px-3 py-2 text-sm font-medium text-[#B9B9B9] hover:text-[#FFFFFF] rounded-lg hover:bg-[#171717]"
          >
            How It Works
          </Link>
          {user ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileNavOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-[#D6B56D] hover:text-[#F0D89F] rounded-lg hover:bg-[#171717]"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard?create=true"
                onClick={() => setMobileNavOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-[#D6B56D] hover:text-[#F0D89F] rounded-lg hover:bg-[#171717]"
              >
                Create Room
              </Link>
              <Link
                href="/profile"
                onClick={() => setMobileNavOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-[#B9B9B9] hover:text-[#FFFFFF] rounded-lg hover:bg-[#171717]"
              >
                Profile & Avatar
              </Link>
              <Link
                href="/settings"
                onClick={() => setMobileNavOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-[#B9B9B9] hover:text-[#FFFFFF] rounded-lg hover:bg-[#171717]"
              >
                Settings
              </Link>
            </>
          ) : (
            <div className="pt-2 border-t border-[#353535] flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 text-sm font-medium text-[#FFFFFF] bg-[#171717] border border-[#353535] rounded-lg"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 text-sm btn-gold-primary rounded-lg"
              >
                <UserPlus className="w-4 h-4" />
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
