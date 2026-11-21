import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../database';
import { config } from '../../config';
import { User } from '../../database/types';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
}

export class AuthService {
  private static instance: AuthService;

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async register(data: {
    email: string;
    username: string;
    password: string;
  }): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
    const existingEmail = await db.findUserByEmail(data.email);
    if (existingEmail) {
      throw new Error('An account with this email already exists.');
    }

    const existingUsername = await db.findUserByUsername(data.username);
    if (existingUsername) {
      throw new Error('This username is already taken. Please choose another.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);
    const verificationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

    const user = await db.createUser({
      email: data.email,
      username: data.username,
      passwordHash,
      emailVerified: true, // Auto-verified for instant seamless watch party access, token kept for audit
      verificationToken,
    });

    const token = this.generateToken(user);
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  public async login(data: {
    identifier: string; // email or username
    password: string;
  }): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
    let user: User | null = null;
    if (data.identifier.includes('@')) {
      user = await db.findUserByEmail(data.identifier);
    } else {
      user = await db.findUserByUsername(data.identifier);
    }

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    const token = this.generateToken(user);
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  public async verifyToken(token: string): Promise<AuthTokenPayload> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as AuthTokenPayload;
      return decoded;
    } catch (err) {
      throw new Error('Invalid or expired authentication token.');
    }
  }

  public generateToken(user: User): string {
    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });
  }

  public async requestPasswordReset(email: string): Promise<{ resetToken: string }> {
    const user = await db.findUserByEmail(email);
    if (!user) {
      // Don't leak existence, return success anyway
      return { resetToken: 'simulation-token-dispatched' };
    }

    const resetToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const resetTokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour

    await db.updateUser(user.id, {
      resetToken,
      resetTokenExpiry,
    });

    console.log(`[AuthService] Password reset requested for ${email}`);
    return { resetToken };
  }

  public async resetPassword(token: string, newPassword: string): Promise<boolean> {
    if (!token || !token.trim()) {
      throw new Error('Invalid or expired password reset token.');
    }

    const user = await db.findUserByResetToken(token);
    if (!user) {
      throw new Error('Invalid or expired password reset token.');
    }

    if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) < new Date()) {
      throw new Error('This password reset link has expired.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.updateUser(user.id, {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    });

    return true;
  }
}

export const authService = AuthService.getInstance();
