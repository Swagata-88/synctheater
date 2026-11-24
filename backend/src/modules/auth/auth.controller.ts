import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';
import { authenticate, AuthenticatedRequest } from './auth.middleware';
import { authRateLimiter, passwordResetRateLimiter } from './rate.limiter';
import { db } from '../../database';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters.')
    .max(30, 'Username cannot exceed 30 characters.')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores and hyphens.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password cannot exceed 128 characters.'),
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Please enter your email or username.'),
  password: z.string().min(1, 'Please enter your password.'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password cannot exceed 128 characters.'),
});

// POST /api/auth/register
authRouter.post('/register', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const validated = registerSchema.parse(req.body);
    const result = await authService.register(validated);
    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to SYNCTHEATER.',
      ...result,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    return res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await authService.login(validated);
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      ...result,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    return res.status(401).json({ error: err.message || 'Authentication failed.' });
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await db.findUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const profile = await db.findProfileByUserId(user.id);
    const preferences = await db.findPreferencesByUserId(user.id);

    const { passwordHash: _, ...safeUser } = user;
    return res.json({
      user: safeUser,
      profile,
      preferences,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch user session.' });
  }
});

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const validated = forgotPasswordSchema.parse(req.body);
    await authService.requestPasswordReset(validated.email);
    // Generic response that never leaks account existence or exposes reset tokens
    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email address, password reset instructions have been sent.',
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    // Return generic success to prevent email enumeration or internal error leakage
    console.error('[Auth:ForgotPassword] Error:', err.message);
    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email address, password reset instructions have been sent.',
    });
  }
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const validated = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(validated.token, validated.newPassword);
    return res.status(200).json({
      success: true,
      message: 'Your password has been reset successfully. You can now log in.',
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    return res.status(400).json({ error: err.message || 'Failed to reset password.' });
  }
});
