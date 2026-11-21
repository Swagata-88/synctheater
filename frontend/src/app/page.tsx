'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '../components/Navbar';
import {
  Play,
  Tv,
  Users,
  ShieldAlert,
  Sparkles,
  Radio,
  ArrowRight,
  Layers,
  MessageSquare,
  Mic,
  Video,
  CheckCircle2,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-28 md:pt-28 md:pb-36 border-b border-white/5">
        {/* Ambient Glow Backdrops */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-gradient-to-tr from-indigo-600/25 via-purple-600/15 to-amber-500/10 blur-[130px] -z-10 rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-6 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Next-Gen Synchronized Cinema Platform
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Watch Together.{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-amber-300 bg-clip-text text-transparent">
              Anywhere.
            </span>{' '}
            In Sync.
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-300 font-normal leading-relaxed mb-10">
            Stream YouTube, Google Drive, Direct MP4s, and HLS streams together in perfect millisecond synchronization.
            No screen-sharing lag, full 4K quality, real-time chat, and LiveKit WebRTC voice channels.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard?create=true"
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              <Play className="w-5 h-5 fill-current" />
              Create Watch Party
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-medium glass-panel hover:bg-white/10 text-gray-200 transition-all"
            >
              Explore Public Theaters
              <ArrowRight className="w-4 h-4 text-indigo-400" />
            </Link>
          </div>

          {/* Social Proof Badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Independent Direct Stream</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              <span>Emergency Pause Safety</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>WebRTC Voice & Video</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              <span>4 Customizable Ambience Themes</span>
            </div>
          </div>
        </div>

        {/* Video Player Mockup Preview */}
        <div className="max-w-5xl mx-auto px-4 mt-16">
          <div className="relative rounded-2xl p-1 bg-gradient-to-b from-white/15 via-white/5 to-transparent shadow-2xl">
            <div className="rounded-[14px] overflow-hidden bg-[#0d101a] aspect-video border border-white/10 relative flex flex-col justify-between p-6">
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-xs font-mono text-gray-400 bg-white/5 px-2.5 py-1 rounded">
                    room/classic-scifi-cinema
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  IN SYNC (0.02s drift)
                </div>
              </div>

              {/* Center Play Button Graphic */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-20 h-20 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-2xl shadow-indigo-600/50 pl-1">
                  <Play className="w-8 h-8 fill-current" />
                </div>
              </div>

              {/* Bottom Mock Controls */}
              <div className="z-10 flex items-center justify-between bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <Play className="w-4 h-4 text-white fill-current" />
                  <span className="text-xs text-gray-300 font-mono">14:32 / 48:10</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-red-600/30 text-red-300 border border-red-500/40 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-red-400" />
                    Emergency Pause Ready
                  </span>
                  <div className="flex -space-x-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 border-2 border-[#0d101a] flex items-center justify-center text-[10px] font-bold">
                      A
                    </div>
                    <div className="w-7 h-7 rounded-full bg-purple-600 border-2 border-[#0d101a] flex items-center justify-center text-[10px] font-bold">
                      B
                    </div>
                    <div className="w-7 h-7 rounded-full bg-amber-600 border-2 border-[#0d101a] flex items-center justify-center text-[10px] font-bold">
                      +4
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillar Grid */}
      <section className="py-24 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Engineered For True Cinema Co-Viewing
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-base">
            Every technical layer in SYNCTHEATER is built from the ground up to eliminate desync, compression artifacts, and communication barriers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="glass-panel p-8 rounded-2xl hover:border-indigo-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-6">
              <Tv className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">Independent High-Def Playback</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Every participant connects directly to the video source CDN. No fuzzy 720p screen-share streams or bandwidth bottlenecks. Full native 1080p and 4K playback.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel p-8 rounded-2xl hover:border-rose-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-6">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">Global Emergency Pause</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Need a refill or door bell rang? Any participant can slam the emergency pause button to halt playback immediately for all viewers with requester identity broadcast.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel p-8 rounded-2xl hover:border-purple-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-6">
              <Mic className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">LiveKit WebRTC Voice & Video</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Crystal-clear, low-latency group voice and webcam channels alongside synchronized video. Laugh, react, and discuss in real-time.
            </p>
          </div>

          {/* Card 4 */}
          <div className="glass-panel p-8 rounded-2xl hover:border-amber-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6">
              <Radio className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">Server-Authoritative Sync</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Socket.IO coordinates play, pause, seek, and rate changes. Monotonic sequence numbers and timestamp delta calculations eliminate desync loops.
            </p>
          </div>

          {/* Card 5 */}
          <div className="glass-panel p-8 rounded-2xl hover:border-emerald-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">4 Cinema Ambience Themes</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Tailor the room vibe to match the film: Classic Cinema with velvet glow, Cozy Room with amber tones, Gaming Cyber Lounge, or Minimal Pitch-Black.
            </p>
          </div>

          {/* Card 6 */}
          <div className="glass-panel p-8 rounded-2xl hover:border-cyan-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-6">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">Persistent Chat & Reactions</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              In-room messaging with message history, animated emoji reactions, user badges, host controls, and participant kick/role management.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action Footer */}
      <footer className="mt-auto border-t border-white/10 bg-[#05060a] py-12 text-sm text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div>
              <p className="font-bold text-white text-base">SYNCTHEATER</p>
              <p className="text-xs text-gray-500">"Watch Together. Anywhere. In Sync."</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Public Theaters
            </Link>
            <Link href="/dashboard?create=true" className="hover:text-white transition-colors">
              Host Watch Party
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              Account Login
            </Link>
          </div>

          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} SYNCTHEATER. Production-Quality Distributed Co-Viewing Engine.
          </p>
        </div>
      </footer>
    </div>
  );
}
