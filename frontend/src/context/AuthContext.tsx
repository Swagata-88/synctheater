'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest, getStoredToken, setStoredToken, clearStoredToken } from '../lib/api';

export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
}

export interface UserProfile {
  avatarUrl: string | null;
  bio: string | null;
}

export interface UserPreference {
  theme: 'dark' | 'light';
  accentColor: string;
  theaterSetting: 'classic' | 'cozy' | 'gaming' | 'minimal';
  audioVolume: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  preferences: UserPreference | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updatePreferences: (newPrefs: Partial<UserPreference>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreference | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setProfile(null);
      setPreferences(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiRequest<{
        user: User;
        profile: UserProfile;
        preferences: UserPreference;
      }>('/api/auth/me');
      setUser(data.user);
      setProfile(data.profile);
      setPreferences(data.preferences);
    } catch (err) {
      clearStoredToken();
      setUser(null);
      setProfile(null);
      setPreferences(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{
        token: string;
        user: User;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });

      setStoredToken(res.token);
      await refreshUser();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, username: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{
        token: string;
        user: User;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password }),
      });

      setStoredToken(res.token);
      await refreshUser();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
    setProfile(null);
    setPreferences(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const updatePreferences = async (newPrefs: Partial<UserPreference>) => {
    if (!user) return;
    try {
      const res = await apiRequest<{ preferences: UserPreference }>('/api/users/preferences', {
        method: 'PATCH',
        body: JSON.stringify(newPrefs),
      });
      setPreferences(res.preferences);
    } catch (e) {
      console.error('Failed to update preferences', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        preferences,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        updatePreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
