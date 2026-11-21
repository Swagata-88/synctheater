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
  });

  it('rejects password reset with invalid or non-existent token', async () => {
    await expect(
      authService.resetPassword('fake-non-existent-token-xyz', 'SomeNewPassword123!')
    ).rejects.toThrowError(/Invalid or expired password reset token/);
  });
});
