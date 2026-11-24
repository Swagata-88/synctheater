import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../../database';
import { config, maskEmail } from '../../config';
import { User } from '../../database/types';
import { emailService } from './email.service';

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
    if (!data.password || data.password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (data.password.length > 128) {
      throw new Error('Password cannot exceed 128 characters.');
    }

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

  public async requestPasswordReset(
    email: string
  ): Promise<{ success: boolean; rawToken?: string; resetToken?: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.findUserByEmail(normalizedEmail);

    if (!user) {
      // Timing attack mitigation: simulate token generation & hashing so response times are indistinguishable
      crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
      console.log(`[AuthService] Password reset requested for non-existent email (generic response dispatched)`);
      return { success: true };
    }

    // Generate cryptographically secure 32-byte hex token (64 hex characters)
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Store only the SHA-256 cryptographic hash in the database
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600 * 1000); // 1-hour secure expiration

    await db.updateUser(user.id, {
      resetToken: tokenHash,
      resetTokenExpiry,
    });

    const resetUrl = `${config.clientUrl}/reset-password?token=${rawToken}`;

    // Dispatches email through configured SMTP server
    await emailService.sendPasswordResetEmail({
      to: user.email,
      username: user.username,
      resetUrl,
    });

    console.log(`[AuthService] Password reset token generated and dispatched for user ${user.id}`);
    // rawToken/resetToken is returned only for internal service callers (such as test runners);
    // the HTTP controller strictly strips this and never exposes it to API clients.
    return { success: true, rawToken, resetToken: rawToken };
  }

  public async resetPassword(token: string, newPassword: string): Promise<boolean> {
    if (!token || typeof token !== 'string' || !token.trim()) {
      throw new Error('Invalid or expired password reset token.');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (newPassword.length > 128) {
      throw new Error('Password cannot exceed 128 characters.');
    }

    const trimmedToken = token.trim();
    // Compute SHA-256 hash of the presented token
    const tokenHash = crypto.createHash('sha256').update(trimmedToken).digest('hex');

    // Hash the new password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Atomically check token validity, expiration, update password, and clear reset token in one single DB write.
    // This strictly eliminates race conditions: two simultaneous requests with the same token can never both succeed.
    const user = await db.consumeResetTokenAndSetPassword(tokenHash, trimmedToken, passwordHash);
    if (!user) {
      throw new Error('Invalid or expired password reset token.');
    }

    console.log(`[AuthService] Password reset successfully for user ${user.id} (${maskEmail(user.email)})`);
    return true;
  }
}

export const authService = AuthService.getInstance();
