import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../auth/auth.middleware';
import { db } from '../../database';

export const usersRouter = Router();

const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters.')
    .max(30, 'Username cannot exceed 30 characters.')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores and hyphens.')
    .optional(),
  avatarUrl: z.string().url('Please provide a valid avatar URL.').optional().or(z.literal('')),
  bio: z.string().max(250, 'Bio cannot exceed 250 characters.').optional(),
});

const updatePreferencesSchema = z.object({
  theme: z.enum(['dark', 'light']).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Accent color must be a valid hex code.').optional(),
  theaterSetting: z.enum(['classic', 'cozy', 'gaming', 'minimal']).optional(),
  audioVolume: z.number().min(0).max(1).optional(),
});

// PATCH /api/users/profile
usersRouter.patch('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = updateProfileSchema.parse(req.body);
    const userId = req.user!.userId;

    if (validated.username) {
      const existingUser = await db.findUserByUsername(validated.username);
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({ error: 'This username is already taken by another participant.' });
      }
      await db.updateUser(userId, { username: validated.username });
    }

    const updatedProfile = await db.updateProfile(userId, {
      ...(validated.avatarUrl !== undefined && { avatarUrl: validated.avatarUrl || null }),
      ...(validated.bio !== undefined && { bio: validated.bio }),
    });

    const user = await db.findUserById(userId);
    const { passwordHash: _, ...safeUser } = user!;

    return res.json({
      success: true,
      user: safeUser,
      profile: updatedProfile,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    return res.status(500).json({ error: err.message || 'Failed to update profile.' });
  }
});

// PATCH /api/users/preferences
usersRouter.patch('/preferences', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = updatePreferencesSchema.parse(req.body);
    const userId = req.user!.userId;

    const updatedPrefs = await db.updatePreferences(userId, validated);
    return res.json({
      success: true,
      preferences: updatedPrefs,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    return res.status(500).json({ error: err.message || 'Failed to update user preferences.' });
  }
});

// GET /api/users/:id
usersRouter.get('/:id', async (req, res) => {
  try {
    const user = await db.findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const profile = await db.findProfileByUserId(user.id);
    return res.json({
      id: user.id,
      username: user.username,
      avatarUrl: profile?.avatarUrl || null,
      bio: profile?.bio || null,
      createdAt: user.createdAt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
