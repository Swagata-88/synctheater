'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';
import { Settings, Sparkles, Volume2, Save } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { user, preferences, updatePreferences, isLoading } = useAuth();

  const [theaterSetting, setTheaterSetting] = useState<'classic' | 'cozy' | 'gaming' | 'minimal'>('classic');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [audioVolume, setAudioVolume] = useState(0.8);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
    if (preferences) {
      setTheaterSetting(preferences.theaterSetting);
      setTheme(preferences.theme);
      setAudioVolume(preferences.audioVolume);
    }
  }, [preferences, user, isLoading, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updatePreferences({
      theaterSetting,
      theme,
      audioVolume,
    });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const THEMES = [
    {
      id: 'classic',
      name: 'Classic Cinema',
      desc: 'Velvet midnight black with deep warm champagne gold ambient reflection.',
      badge: '🏛️ Traditional',
    },
    {
      id: 'cozy',
      name: 'Cozy Room',
      desc: 'Warm walnut tones, dim antique gold lounge lamp, and soft cozy acoustics.',
      badge: '☕ Intimate',
    },
    {
      id: 'gaming',
      name: 'Obsidian Lounge',
      desc: 'High contrast obsidian with champagne gold sharp lines and focus.',
      badge: '✨ High Contrast',
    },
    {
      id: 'minimal',
      name: 'Minimal Cinema',
      desc: 'Pitch-black pure OLED background for maximum contrast and zero distractions.',
      badge: '🎬 OLED Black',
    },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col bg-[#090909] text-[#FFFFFF]">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12">
        <div className="cinema-card p-8 border border-[#353535] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D6B56D] to-transparent" />

          <div className="flex items-center justify-between pb-6 border-b border-[#353535] mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#202020] border border-[#353535] text-[#D6B56D] flex items-center justify-center">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#FFFFFF]">Theater & App Settings</h1>
                <p className="text-xs text-[#B9B9B9] mt-0.5">Customize your viewing environment and playback defaults</p>
              </div>
            </div>

            {savedToast && (
              <span className="text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 px-3 py-1 rounded-full font-semibold animate-pulse">
                ✓ Preferences Saved
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-8">
            {/* Theater Environments */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-[#D6B56D]" />
                <h3 className="text-sm font-bold text-[#FFFFFF]">Default Theater Ambience</h3>
              </div>
              <p className="text-xs text-[#B9B9B9] mb-4">
                Choose the visual tone that wraps around your central video player.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {THEMES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTheaterSetting(item.id)}
                    className={`p-4 rounded-xl border text-left transition-all relative cursor-pointer ${
                      theaterSetting === item.id
                        ? 'border-[#D6B56D] bg-[#202020] ring-1 ring-[#D6B56D]'
                        : 'border-[#353535] hover:border-[#D6B56D]/50 bg-[#111111]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-[#FFFFFF]">{item.name}</span>
                      <span className="text-[10px] text-[#B9B9B9] bg-[#171717] border border-[#353535] px-2 py-0.5 rounded">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#B9B9B9] leading-relaxed">{item.desc}</p>
                    {theaterSetting === item.id && (
                      <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#D6B56D] shadow-lg shadow-[#D6B56D]/60" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Defaults */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-[#D6B56D]" />
                  <h3 className="text-sm font-bold text-[#FFFFFF]">Default Theater Audio Volume</h3>
                </div>
                <span className="text-xs font-mono text-[#D6B56D] font-bold">
                  {Math.round(audioVolume * 100)}%
                </span>
              </div>
              <p className="text-xs text-[#B9B9B9] mb-3">
                Your initial local player volume when entering rooms.
              </p>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioVolume}
                onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                className="w-full accent-[#D6B56D] cursor-pointer"
              />
            </div>

            <div className="pt-4 border-t border-[#353535] flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold btn-gold-primary transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Save Preferences
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
