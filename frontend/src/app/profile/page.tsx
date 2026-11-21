'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';
import { apiRequest } from '../../lib/api';
import { User, CheckCircle2, AlertCircle, Save, Sparkles } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, refreshUser, isLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
    if (user) {
      setUsername(user.username);
    }
    if (profile) {
      setAvatarUrl(profile.avatarUrl || '');
      setBio(profile.bio || '');
    }
  }, [user, profile, isLoading]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await apiRequest('/api/users/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          username,
          avatarUrl,
          bio,
        }),
      });

      await refreshUser();
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const AVATAR_PRESETS = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Cinema1',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Synthwave',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Cosmic',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Director',
    'https://api.dicebear.com/7.x/bottts/svg?seed=PopcornFan',
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] text-white">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12">
        <div className="glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-3 pb-6 border-b border-white/10 mb-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Your Cinema Profile</h1>
              <p className="text-xs text-gray-400 mt-0.5">Manage your identity, avatar, and bio</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Avatar Preview & Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Avatar Image
              </label>
              <div className="flex items-center gap-4 mb-4">
                <img
                  src={avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.id}`}
                  alt="Avatar"
                  className="w-16 h-16 rounded-2xl bg-indigo-950 border-2 border-indigo-500/40 object-cover shadow-lg"
                />
                <div className="flex-1">
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.png"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder-gray-500 focus:border-indigo-500 outline-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Paste image URL or pick a preset below:</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {AVATAR_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatarUrl(preset)}
                    className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white/10 hover:border-indigo-500 hover:scale-105 transition-all"
                  >
                    <img src={preset} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Display Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Unique username"
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-indigo-500 outline-none"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Letters, numbers, underscores, and hyphens only (3-30 characters).
              </p>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                About You
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell other watch party members what you love to watch..."
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-indigo-500 outline-none resize-none"
              />
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
