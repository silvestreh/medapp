import { HookContext } from '@feathersjs/feathers';
import { BadRequest, NotAuthenticated } from '@feathersjs/errors';

/**
 * Before-patch hook that handles password changes.
 * Validates the current password (and 2FA code if enabled) before allowing the update.
 */
export const changePassword = () => async (context: HookContext) => {
  const { app, data } = context;
  if (!data?.changePassword) return context;

  const { currentPassword, newPassword, twoFactorCode } = data.changePassword;

  if (!currentPassword || !newPassword) {
    throw new BadRequest('Current password and new password are required');
  }

  // Get the user's username for authentication
  const user = await app.service('users').get(context.id!, { provider: undefined });

  // Verify current password (and 2FA if enabled) via the authentication service
  try {
    await app.service('authentication').create({
      strategy: 'local',
      username: user.username,
      password: currentPassword,
      twoFactorCode: twoFactorCode || undefined,
    }, { provider: undefined });
  } catch (err: any) {
    if (err.data?.reason === '2fa_required') {
      throw new NotAuthenticated('2FA code is required');
    }
    if (err.data?.reason === 'invalid_2fa_code') {
      throw new BadRequest('Invalid 2FA code');
    }
    throw new BadRequest('Current password is incorrect');
  }

  // Replace data with just the new password — hashPassword() hook will hash it
  context.data = { password: newPassword };

  return context;
};
