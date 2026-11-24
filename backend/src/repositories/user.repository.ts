import { Pool } from 'pg';
import { User, UserProfile, UserPreference, Role } from '../database/types';
import { InMemoryDbState } from './types';
import { FallbackStorage } from './fallback.storage';

export class UserRepository {
  constructor(
    private getPool: () => Pool | null,
    private isConnected: () => boolean,
    private inMemoryDb: InMemoryDbState,
    private storage: FallbackStorage
  ) {}

  public async createUser(data: {
    email: string;
    username: string;
    passwordHash: string;
    role?: Role;
    emailVerified?: boolean;
    verificationToken?: string | null;
  }): Promise<User> {
    const user: User = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      email: data.email,
      username: data.username,
      passwordHash: data.passwordHash,
      emailVerified: data.emailVerified !== undefined ? data.emailVerified : false,
      verificationToken: data.verificationToken || null,
      resetToken: null,
      resetTokenExpiry: null,
      role: data.role || 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `INSERT INTO users (id, email, username, password_hash, email_verified, verification_token, reset_token, reset_token_expiry, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          user.id,
          user.email,
          user.username,
          user.passwordHash,
          user.emailVerified,
          user.verificationToken,
          user.resetToken,
          user.resetTokenExpiry,
          user.role,
          user.createdAt,
          user.updatedAt,
        ]
      );
    } else {
      this.inMemoryDb.users.push(user);
      this.storage.persist(this.inMemoryDb);
    }

    // Initialize profile & preferences
    await this.createInitialProfile(user.id);
    await this.createInitialPreferences(user.id);

    return user;
  }

  private async createInitialProfile(userId: string): Promise<void> {
    const profile: UserProfile = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      userId,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
      bio: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `INSERT INTO user_profiles (id, user_id, avatar_url, bio, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [profile.id, profile.userId, profile.avatarUrl, profile.bio, profile.createdAt, profile.updatedAt]
      );
    } else {
      this.inMemoryDb.profiles.push(profile);
      this.storage.persist(this.inMemoryDb);
    }
  }

  private async createInitialPreferences(userId: string): Promise<void> {
    const pref: UserPreference = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      userId,
      theme: 'dark',
      accentColor: '#E50914',
      theaterSetting: 'classic',
      audioVolume: 0.8,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `INSERT INTO user_preferences (id, user_id, theme, accent_color, theater_setting, audio_volume, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [pref.id, pref.userId, pref.theme, pref.accentColor, pref.theaterSetting, pref.audioVolume, pref.createdAt, pref.updatedAt]
      );
    } else {
      this.inMemoryDb.preferences.push(pref);
      this.storage.persist(this.inMemoryDb);
    }
  }

  public async findUserByEmail(email: string): Promise<User | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
      if (res.rows.length === 0) return null;
      return this.mapUserRow(res.rows[0]);
    }
    return this.inMemoryDb.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  public async findUserByUsername(username: string): Promise<User | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(`SELECT * FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`, [username]);
      if (res.rows.length === 0) return null;
      return this.mapUserRow(res.rows[0]);
    }
    return this.inMemoryDb.users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  public async findUserById(id: string): Promise<User | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [id]);
      if (res.rows.length === 0) return null;
      return this.mapUserRow(res.rows[0]);
    }
    return this.inMemoryDb.users.find((u) => u.id === id) || null;
  }

  public async findUserByResetToken(token: string): Promise<User | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW() LIMIT 1`,
        [token]
      );
      if (res.rows.length === 0) return null;
      return this.mapUserRow(res.rows[0]);
    }
    const user = this.inMemoryDb.users.find(
      (u) => u.resetToken === token && u.resetTokenExpiry && new Date(u.resetTokenExpiry).getTime() > Date.now()
    );
    return user || null;
  }

  public async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL, updated_at = NOW() WHERE id = $2`,
        [passwordHash, userId]
      );
      return;
    }
    const idx = this.inMemoryDb.users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      this.inMemoryDb.users[idx].passwordHash = passwordHash;
      this.inMemoryDb.users[idx].resetToken = null;
      this.inMemoryDb.users[idx].resetTokenExpiry = null;
      this.inMemoryDb.users[idx].updatedAt = new Date();
      this.storage.persist(this.inMemoryDb);
    }
  }

  public async consumeResetTokenAndSetPassword(
    tokenHash: string,
    legacyToken: string,
    passwordHash: string
  ): Promise<User | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `UPDATE users
         SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL, updated_at = NOW()
         WHERE (reset_token = $2 OR reset_token = $3)
           AND reset_token_expiry > NOW()
         RETURNING *`,
        [passwordHash, tokenHash, legacyToken]
      );
      if (res.rows.length === 0) return null;
      return this.mapUserRow(res.rows[0]);
    }

    const idx = this.inMemoryDb.users.findIndex(
      (u) =>
        (u.resetToken === tokenHash || u.resetToken === legacyToken) &&
        u.resetTokenExpiry &&
        new Date(u.resetTokenExpiry).getTime() > Date.now()
    );
    if (idx === -1) return null;

    const user = this.inMemoryDb.users[idx];
    user.passwordHash = passwordHash;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    user.updatedAt = new Date();
    this.storage.persist(this.inMemoryDb);
    return user;
  }

  public async updateResetToken(userId: string, token: string | null, expiry: Date | null): Promise<void> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `UPDATE users SET reset_token = $1, reset_token_expiry = $2, updated_at = NOW() WHERE id = $3`,
        [token, expiry, userId]
      );
      return;
    }
    const idx = this.inMemoryDb.users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      this.inMemoryDb.users[idx].resetToken = token;
      this.inMemoryDb.users[idx].resetTokenExpiry = expiry;
      this.inMemoryDb.users[idx].updatedAt = new Date();
      this.storage.persist(this.inMemoryDb);
    }
  }

  public async updateUser(userId: string, data: Partial<User>): Promise<User | null> {
    const current = await this.findUserById(userId);
    if (!current) return null;
    const updated: User = {
      ...current,
      ...data,
      updatedAt: new Date(),
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `UPDATE users 
         SET email = $1, username = $2, password_hash = $3, email_verified = $4, reset_token = $5, reset_token_expiry = $6, updated_at = NOW() 
         WHERE id = $7`,
        [
          updated.email,
          updated.username,
          updated.passwordHash,
          updated.emailVerified,
          updated.resetToken,
          updated.resetTokenExpiry,
          userId,
        ]
      );
    } else {
      const idx = this.inMemoryDb.users.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        this.inMemoryDb.users[idx] = updated;
        this.storage.persist(this.inMemoryDb);
      }
    }
    return updated;
  }

  public findProfileByUserId(userId: string): Promise<UserProfile | null> {
    return this.getProfileByUserId(userId);
  }

  public findPreferencesByUserId(userId: string): Promise<UserPreference | null> {
    return this.getPreferencesByUserId(userId);
  }

  public async getProfileByUserId(userId: string): Promise<UserProfile | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(`SELECT * FROM user_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        userId: r.user_id,
        avatarUrl: r.avatar_url,
        bio: r.bio,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }
    return this.inMemoryDb.profiles.find((p) => p.userId === userId) || null;
  }

  public async updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile | null> {
    const current = await this.getProfileByUserId(userId);
    if (!current) return null;
    const updated: UserProfile = {
      ...current,
      ...data,
      updatedAt: new Date(),
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `UPDATE user_profiles SET avatar_url = $1, bio = $2, updated_at = NOW() WHERE user_id = $3`,
        [updated.avatarUrl, updated.bio, userId]
      );
    } else {
      const idx = this.inMemoryDb.profiles.findIndex((p) => p.userId === userId);
      if (idx !== -1) {
        this.inMemoryDb.profiles[idx] = updated;
        this.storage.persist(this.inMemoryDb);
      }
    }
    return updated;
  }

  public async getPreferencesByUserId(userId: string): Promise<UserPreference | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(`SELECT * FROM user_preferences WHERE user_id = $1 LIMIT 1`, [userId]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        userId: r.user_id,
        theme: r.theme,
        accentColor: r.accent_color,
        theaterSetting: r.theater_setting,
        audioVolume: parseFloat(r.audio_volume),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }
    return this.inMemoryDb.preferences.find((p) => p.userId === userId) || null;
  }

  public async updatePreferences(userId: string, data: Partial<UserPreference>): Promise<UserPreference | null> {
    const current = await this.getPreferencesByUserId(userId);
    if (!current) return null;
    const updated: UserPreference = {
      ...current,
      ...data,
      updatedAt: new Date(),
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `UPDATE user_preferences SET theme = $1, accent_color = $2, theater_setting = $3, audio_volume = $4, updated_at = NOW() WHERE user_id = $5`,
        [updated.theme, updated.accentColor, updated.theaterSetting, updated.audioVolume, userId]
      );
    } else {
      const idx = this.inMemoryDb.preferences.findIndex((p) => p.userId === userId);
      if (idx !== -1) {
        this.inMemoryDb.preferences[idx] = updated;
        this.storage.persist(this.inMemoryDb);
      }
    }
    return updated;
  }

  private mapUserRow(r: any): User {
    return {
      id: r.id,
      email: r.email,
      username: r.username,
      passwordHash: r.password_hash,
      emailVerified: r.email_verified,
      verificationToken: r.verification_token,
      resetToken: r.reset_token,
      resetTokenExpiry: r.reset_token_expiry,
      role: r.role,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
