import { describe, it, expect } from 'vitest';
import { authService } from '../src/modules/auth/auth.service';

describe('AuthService Integration', () => {
  it('registers a new user and issues a valid JWT token', async () => {
    const testEmail = `tester_${Date.now()}@synctheater.com`;
    const testUsername = `user_${Date.now()}`;
    const result = await authService.register({
      email: testEmail,
      username: testUsername,
      password: 'SecurePassword123!',
    });

    expect(result.token).toBeDefined();
    expect(result.user.email).toBe(testEmail.toLowerCase());
    expect(result.user.username).toBe(testUsername);

    // Verify token
    const verified = await authService.verifyToken(result.token);
    expect(verified.userId).toBe(result.user.id);
    expect(verified.email).toBe(testEmail.toLowerCase());
  });

  it('rejects duplicate email registrations', async () => {
    const email = `duplicate_${Date.now()}@synctheater.com`;
    await authService.register({
      email,
      username: `unique1_${Date.now()}`,
      password: 'Password123!',
    });

    await expect(
      authService.register({
        email,
        username: `unique2_${Date.now()}`,
        password: 'Password123!',
      })
    ).rejects.toThrowError(/already exists/);
  });

  it('authenticates user with valid credentials and rejects bad password', async () => {
    const email = `login_${Date.now()}@synctheater.com`;
    const username = `login_${Date.now()}`;
    await authService.register({
      email,
      username,
      password: 'CorrectPassword123!',
    });

    // Valid login
    const loginRes = await authService.login({
      identifier: email,
      password: 'CorrectPassword123!',
    });
    expect(loginRes.token).toBeDefined();

    // Invalid login
    await expect(
      authService.login({
        identifier: email,
        password: 'WrongPassword!',
      })
    ).rejects.toThrowError(/Invalid email or password/);
  });

  it('successfully resets password using a valid reset token and enables login with new password', async () => {
    const email = `reset_success_${Date.now()}@synctheater.com`;
    const username = `reset_user_${Date.now()}`;
    await authService.register({
      email,
      username,
      password: 'OldPassword123!',
    });

    // Request reset token
    const { resetToken } = await authService.requestPasswordReset(email);
    expect(resetToken).toBeDefined();
    expect(resetToken).not.toBe('');

    // Reset password
    const result = await authService.resetPassword(resetToken, 'BrandNewPassword456!');
    expect(result).toBe(true);

    // Login with new password must succeed
    const loginNew = await authService.login({
      identifier: email,
      password: 'BrandNewPassword456!',
    });
    expect(loginNew.token).toBeDefined();

    // Login with old password must fail
    await expect(
      authService.login({
        identifier: email,
        password: 'OldPassword123!',
      })
    ).rejects.toThrowError(/Invalid email or password/);
  }, 15000);

  it('stores cryptographic SHA-256 hash in database instead of raw token', async () => {
    const email = `hash_check_${Date.now()}@synctheater.com`;
    const username = `hash_user_${Date.now()}`;
    await authService.register({
      email,
      username,
      password: 'OldPassword123!',
    });

    const { rawToken } = await authService.requestPasswordReset(email);
    expect(rawToken).toBeDefined();

    // Query user directly from DB
    const { db } = await import('../src/database');
    const user = await db.findUserByEmail(email);
    expect(user).toBeDefined();
    expect(user!.resetToken).toBeDefined();
    // Stored token must NOT equal the raw token exposed to user
    expect(user!.resetToken).not.toBe(rawToken);
    // Stored token must be a 64-character SHA-256 hex string
    expect(user!.resetToken).toHaveLength(64);
  }, 15000);

  it('ensures reset tokens are strictly single-use and cannot be replayed', async () => {
    const email = `single_use_${Date.now()}@synctheater.com`;
    const username = `single_user_${Date.now()}`;
    await authService.register({
      email,
      username,
      password: 'OldPassword123!',
    });

    const { rawToken } = await authService.requestPasswordReset(email);
    expect(rawToken).toBeDefined();

    // First use: must succeed
    const firstAttempt = await authService.resetPassword(rawToken!, 'NewPass123456!');
    expect(firstAttempt).toBe(true);

    // Second use with the same token: must fail as already used/cleared
    await expect(
      authService.resetPassword(rawToken!, 'AnotherNewPass999!')
    ).rejects.toThrowError(/Invalid or expired password reset token/);
  }, 15000);

  it('rejects password reset with an expired token', async () => {
    const email = `expired_token_${Date.now()}@synctheater.com`;
    const username = `expired_user_${Date.now()}`;
    const user = await authService.register({
      email,
      username,
      password: 'OldPassword123!',
    });

    const { rawToken } = await authService.requestPasswordReset(email);
    expect(rawToken).toBeDefined();

    // Artificially set expiry date in the past
    const { db } = await import('../src/database');
    await db.updateUser(user.user.id, {
      resetTokenExpiry: new Date(Date.now() - 3600 * 1000), // 1 hour ago
    });

    // Reset attempt with expired token must be rejected
    await expect(
      authService.resetPassword(rawToken!, 'NewPasswordAfterExpiry!')
    ).rejects.toThrowError(/expired/i);
  }, 15000);

  it('rejects password reset with invalid or non-existent token', async () => {
    await expect(
      authService.resetPassword('fake-non-existent-token-xyz', 'SomeNewPassword123!')
    ).rejects.toThrowError(/Invalid or expired password reset token/);
  });

  it('returns generic success when requesting reset for non-existent email', async () => {
    const result = await authService.requestPasswordReset('non_existent_account@nowhere.com');
    expect(result.success).toBe(true);
    expect(result.rawToken).toBeUndefined();
  });
});
