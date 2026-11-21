'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';
import { Settings, Sparkles, Volume2, Moon, Sun, Check, Save } from 'lucide-react';

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
  }, [preferences, user, isLoading]);

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
      desc: 'Velvet deep navy with amber cinema glow and warm spotlight accents.',
      badge: '🏛️ Traditional',
    },
    {
      id: 'cozy',
      name: 'Cozy Room',
      desc: 'Warm walnut tones, dim amber lounge lamp, and soft cozy acoustics.',
      badge: '☕ Intimate',
    },
    {
      id: 'gaming',
      name: 'Gaming Lounge',
      desc: 'Deep purple cyber-neon atmosphere with high contrast styling.',
      badge: '🎮 Cyberpunk',
    },
    {
      id: 'minimal',
      name: 'Minimal Theater',
      desc: 'Pitch-black pure OLED background for maximum contrast and zero distractions.',
      badge: '✨ OLED Black',
    },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] text-white">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12">
        <div className="glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Theater & App Settings</h1>
                <p className="text-xs text-gray-400 mt-0.5">Customize your viewing environment and playback defaults</p>
              </div>
            </div>

            {savedToast && (
              <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full font-semibold animate-pulse">
                ✓ Preferences Saved
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-8">
            {/* Theater Environments */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Default Theater Ambience</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Choose the visual tone that wraps around your central video player.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {THEMES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTheaterSetting(item.id)}
                    className={`p-4 rounded-xl border text-left transition-all relative ${
                      theaterSetting === item.id
                        ? 'border-indigo-500 bg-indigo-600/15 ring-1 ring-indigo-500'
                        : 'border-white/10 hover:border-white/20 bg-black/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-white">{item.name}</span>
                      <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{item.desc}</p>
                    {theaterSetting === item.id && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-400 shadow-lg shadow-indigo-400/50" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Defaults */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Default Theater Audio Volume</h3>
                </div>
                <span className="text-xs font-mono text-indigo-400 font-semibold">
                  {Math.round(audioVolume * 100)}%
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Your initial local player volume when entering rooms.
              </p>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioVolume}
                onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
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
