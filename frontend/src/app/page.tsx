'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '../components/Navbar';
import { IrisEmblem } from '../components/brand/Logo';
import {
  Play,
  Tv,
  Users,
  ShieldAlert,
  Radio,
  ArrowRight,
  MessageSquare,
  Mic,
  Video,
  Lock,
  Link as LinkIcon,
  CheckCircle2,
  Film,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#090909] text-[#FFFFFF]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32 border-b border-[#353535]">
        {/* Subtle Warm Metallic Ambient Backdrop */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[360px] bg-gradient-to-b from-[#D6B56D]/10 via-[#94743D]/5 to-transparent blur-[140px] -z-10 rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Official Emblem Hero Mark */}
          <div className="flex justify-center mb-6">
            <IrisEmblem size="xl" className="drop-shadow-[0_8px_30px_rgba(214,181,109,0.3)] animate-gold-shimmer" />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#171717] border border-[#353535] text-[#D6B56D] text-xs font-semibold uppercase tracking-wider mb-6">
            <span className="w-2 h-2 rounded-full bg-[#D6B56D] animate-ping" />
            Private Synchronized Cinema
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Cinema is better <span className="gold-gradient-text">together.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-[#B9B9B9] font-normal leading-relaxed mb-10">
            Create your own private cinema. Watch movies, enjoy live streams, and share unforgettable moments with friends — wherever you are.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard?create=true"
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-sm font-bold btn-gold-primary transition-all hover:scale-[1.02]"
            >
              <Play className="w-4 h-4 fill-current" />
              Create a Private Room
            </Link>
            <Link
              href="/dashboard#join"
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-sm font-semibold btn-gold-secondary transition-all"
            >
              Join a Room
              <ArrowRight className="w-4 h-4 text-[#D6B56D]" />
            </Link>
          </div>

          {/* Value Badges */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-xs text-[#B9B9B9]">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#D6B56D]" />
              <span>Millisecond Synchronization</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#D6B56D]" />
              <span>Private & Invite-Only</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#D6B56D]" />
              <span>Live Voice & Video</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#D6B56D]" />
              <span>Global Emergency Pause</span>
            </div>
          </div>
        </div>

        {/* Video Player Preview Mockup */}
        <div className="max-w-5xl mx-auto px-4 mt-16">
          <div className="relative rounded-2xl p-1 bg-gradient-to-b from-[#353535] via-[#242424] to-transparent shadow-2xl">
            <div className="rounded-[14px] overflow-hidden bg-[#000000] aspect-video border border-[#353535] relative flex flex-col justify-between p-6">
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-600/80" />
                    <div className="w-3 h-3 rounded-full bg-[#D6B56D]/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-xs font-mono text-[#B9B9B9] bg-[#171717] border border-[#353535] px-2.5 py-1 rounded">
                    room/private-cinema
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-[#171717] text-[#D6B56D] border border-[#D6B56D]/30 px-3 py-1 rounded-full text-xs font-semibold">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-[#D6B56D]" />
                  SYNCHRONIZED (0.01s drift)
                </div>
              </div>

              {/* Center Play Graphic */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-20 h-20 rounded-full bg-[#171717]/90 border border-[#D6B56D]/50 text-[#F0D89F] flex items-center justify-center shadow-2xl shadow-[#D6B56D]/20 pl-1">
                  <Play className="w-8 h-8 fill-current" />
                </div>
              </div>

              {/* Mock Controls Bar */}
              <div className="z-10 flex items-center justify-between bg-[#111111]/90 backdrop-blur-md p-3 rounded-xl border border-[#353535]">
                <div className="flex items-center gap-3">
                  <Play className="w-4 h-4 text-[#D6B56D] fill-current" />
                  <span className="text-xs text-[#B9B9B9] font-mono">14:32 / 48:10</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-red-950/60 text-red-300 border border-red-700/50 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-red-400" />
                    Emergency Pause Ready
                  </span>
                  <div className="flex -space-x-2">
                    <div className="w-7 h-7 rounded-full bg-[#D6B56D] text-[#090909] border-2 border-[#171717] flex items-center justify-center text-[10px] font-bold">
                      H
                    </div>
                    <div className="w-7 h-7 rounded-full bg-[#94743D] text-[#FFFFFF] border-2 border-[#171717] flex items-center justify-center text-[10px] font-bold">
                      P
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 w-full">
        <div className="text-center mb-14">
          <h2 className="text-xs font-bold text-[#D6B56D] uppercase tracking-[0.2em] mb-2">
            Simple 3-Step Process
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            How It Works
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="cinema-card p-6 flex flex-col items-center text-center relative">
            <div className="w-12 h-12 rounded-xl bg-[#202020] border border-[#353535] text-[#D6B56D] flex items-center justify-center font-extrabold text-lg mb-4">
              1
            </div>
            <h4 className="text-lg font-bold mb-2">Create a Private Room</h4>
            <p className="text-sm text-[#B9B9B9] leading-relaxed">
              Name your theater and paste a video source from YouTube, direct media, or cloud storage.
            </p>
          </div>

          {/* Step 2 */}
          <div className="cinema-card p-6 flex flex-col items-center text-center relative">
            <div className="w-12 h-12 rounded-xl bg-[#202020] border border-[#353535] text-[#D6B56D] flex items-center justify-center font-extrabold text-lg mb-4">
              2
            </div>
            <h4 className="text-lg font-bold mb-2">Invite Your Friends</h4>
            <p className="text-sm text-[#B9B9B9] leading-relaxed">
              Generate a secure, single-use or multi-use invitation link with optional room password protection.
            </p>
          </div>

          {/* Step 3 */}
          <div className="cinema-card p-6 flex flex-col items-center text-center relative">
            <div className="w-12 h-12 rounded-xl bg-[#202020] border border-[#353535] text-[#D6B56D] flex items-center justify-center font-extrabold text-lg mb-4">
              3
            </div>
            <h4 className="text-lg font-bold mb-2">Watch Together</h4>
            <p className="text-sm text-[#B9B9B9] leading-relaxed">
              Play, pause, and seek in perfect synchrony with integrated live chat, emoji reactions, and voice channels.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 border-t border-[#353535] bg-[#111111]/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold text-[#D6B56D] uppercase tracking-[0.2em] mb-2">
              Capabilities
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
              Engineered for Co-Viewing
            </h3>
            <p className="text-sm text-[#B9B9B9] max-w-xl mx-auto">
              Built from the ground up for high fidelity and low latency without screen-sharing compromises.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="cinema-card p-6 hover:border-[#D6B56D]/50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#202020] border border-[#353535] text-[#D6B56D] flex items-center justify-center mb-4">
                <Radio className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold mb-2">Synchronized Video Playback</h4>
              <p className="text-xs text-[#B9B9B9] leading-relaxed">
                Server-authoritative Socket.IO synchronization with millisecond drift compensation and monotonic sequence tracking.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="cinema-card p-6 hover:border-[#D6B56D]/50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#202020] border border-[#353535] text-[#D6B56D] flex items-center justify-center mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold mb-2">Private Invitation-Only Rooms</h4>
              <p className="text-xs text-[#B9B9B9] leading-relaxed">
                Zero public room indexing. Every theater requires a cryptographic invitation token or room password to enter.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="cinema-card p-6 hover:border-[#D6B56D]/50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#202020] border border-[#353535] text-[#D6B56D] flex items-center justify-center mb-4">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold mb-2">Emergency Pause</h4>
              <p className="text-xs text-[#B9B9B9] leading-relaxed">
                Any authenticated participant can instantly halt playback for the room in emergencies, while host exclusivity is preserved.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="cinema-card p-6 hover:border-[#D6B56D]/50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#202020] border border-[#353535] text-[#D6B56D] flex items-center justify-center mb-4">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold mb-2">Real-Time Text Chat</h4>
              <p className="text-xs text-[#B9B9B9] leading-relaxed">
                Persistent room messaging, animated emoji reaction overlays, user badges, and system announcements.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="cinema-card p-6 hover:border-[#D6B56D]/50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#202020] border border-[#353535] text-[#D6B56D] flex items-center justify-center mb-4">
                <Mic className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold mb-2">Voice & Camera Communication</h4>
              <p className="text-xs text-[#B9B9B9] leading-relaxed">
                Integrated LiveKit WebRTC group audio and webcam channels running alongside synchronized media playback.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="cinema-card p-6 hover:border-[#D6B56D]/50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#202020] border border-[#353535] text-[#D6B56D] flex items-center justify-center mb-4">
                <Tv className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold mb-2">Multiple Video Sources</h4>
              <p className="text-xs text-[#B9B9B9] leading-relaxed">
                Native streaming support for YouTube, direct MP4 media files, HLS live streams (.m3u8), and Google Drive links.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section className="py-20 border-t border-[#353535]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#171717] border border-[#353535] text-[#D6B56D] mx-auto flex items-center justify-center mb-6">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Your cinema. Your friends. Your private space.
          </h2>
          <p className="text-[#B9B9B9] text-base leading-relaxed max-w-2xl mx-auto mb-8">
            SYNCTHEATER operates without public room discovery. No strangers can browse, search, or stumble into your watch party. You decide exactly who enters with cryptographically secure, disposable invite tokens.
          </p>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#D6B56D] bg-[#171717] px-4 py-2 rounded-xl border border-[#353535]">
            <CheckCircle2 className="w-4 h-4" />
            Strict cryptographic invitation tokens and optional room passkeys
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#353535] bg-[#090909] py-12 text-sm text-[#777777]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <IrisEmblem size="sm" />
            <div>
              <p className="font-extrabold text-[#FFFFFF] tracking-wider text-sm">SYNCTHEATER</p>
              <p className="text-xs text-[#777777]">Watch Together. Anywhere.</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-[#B9B9B9]">
            <Link href="/dashboard" className="hover:text-[#D6B56D] transition-colors">
              Dashboard
            </Link>
            <Link href="/dashboard?create=true" className="hover:text-[#D6B56D] transition-colors">
              Create Room
            </Link>
            <Link href="/login" className="hover:text-[#D6B56D] transition-colors">
              Sign In
            </Link>
          </div>

          <p className="text-xs text-[#777777]">
            &copy; {new Date().getFullYear()} SYNCTHEATER. Private Synchronized Cinema Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
