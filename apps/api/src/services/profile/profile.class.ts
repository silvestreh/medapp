import { BadRequest, Forbidden, NotAuthenticated } from '@feathersjs/errors';
import type { Application, User } from '../../declarations';
import { buildTotpAuthUri, generateTotpSecret, verifyTotpCode } from '../../utils/totp';

type ProfileAction = 'setup-2fa' | 'enable-2fa' | 'change-password';

type SetupTwoFactorResponse = {
  action: 'setup-2fa';
  secret: string;
  otpauthUri: string;
};

type EnableTwoFactorResponse = {
  action: 'enable-2fa';
  twoFactorEnabled: true;
};

type ChangePasswordResponse = {
  action: 'change-password';
  success: true;
};

type ProfileActionResponse = SetupTwoFactorResponse | EnableTwoFactorResponse | ChangePasswordResponse;

const ensureAuthenticatedUser = (params: any): User => {
  const user = params?.user as User | undefined;
  if (!user) {
    throw new NotAuthenticated('Authentication required');
  }
  return user;
};

export class Profile {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  private async getRawUser(userId: string) {
    const sequelize = this.app.get('sequelizeClient');
    return sequelize.models.users.findByPk(userId, { raw: true });
  }

  async get(id: string, params: any) {
    if (id !== 'me') {
      throw new Forbidden('Only profile/me is allowed');
    }

    const user = ensureAuthenticatedUser(params);
    return {
      id: user.id,
      username: user.username,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
    };
  }

  async create(data: any, params: any): Promise<ProfileActionResponse> {
    const user = ensureAuthenticatedUser(params);
    const action = data?.action as ProfileAction | undefined;

    if (!action) {
      throw new BadRequest('Action is required');
    }

    if (action === 'setup-2fa') {
      if (user.twoFactorEnabled) {
        throw new BadRequest('2FA is already enabled');
      }

      const secret = generateTotpSecret();
      await this.app.service('users').patch(user.id, { twoFactorTempSecret: secret });

      const otpauthUri = buildTotpAuthUri({
        issuer: process.env.TOTP_ISSUER || 'MedApp',
        accountName: user.username,
        secret,
      });

      return {
        action: 'setup-2fa',
        secret,
        otpauthUri,
      };
    }

    if (action === 'enable-2fa') {
      if (user.twoFactorEnabled) {
        throw new BadRequest('2FA is already enabled');
      }

      const twoFactorCode = typeof data?.twoFactorCode === 'string' ? data.twoFactorCode.trim() : '';
      if (!twoFactorCode) {
        throw new BadRequest('2FA code is required');
      }

      const freshUser = await this.getRawUser(String(user.id));
      const pendingSecret = freshUser?.twoFactorTempSecret;
      if (!pendingSecret) {
        throw new BadRequest('You need to start 2FA setup first');
      }

      const isValidCode = verifyTotpCode({ secret: pendingSecret, code: twoFactorCode });
      if (!isValidCode) {
        throw new BadRequest('Invalid 2FA code');
      }

      await this.app.service('users').patch(user.id, {
        twoFactorEnabled: true,
        twoFactorSecret: pendingSecret,
        twoFactorTempSecret: null,
      });

      return {
        action: 'enable-2fa',
        twoFactorEnabled: true,
      };
    }

    if (action === 'change-password') {
      const currentPassword = typeof data?.currentPassword === 'string' ? data.currentPassword : '';
      const newPassword = typeof data?.newPassword === 'string' ? data.newPassword : '';
      const twoFactorCode = typeof data?.twoFactorCode === 'string' ? data.twoFactorCode.trim() : '';

      if (!currentPassword || !newPassword) {
        throw new BadRequest('Current and new password are required');
      }

      if (newPassword.length < 8) {
        throw new BadRequest('New password must be at least 8 characters');
      }

      if (user.twoFactorEnabled && !twoFactorCode) {
        throw new BadRequest('2FA code is required');
      }

      const authPayload: Record<string, unknown> = {
        strategy: 'local',
        username: user.username,
        password: currentPassword,
      };

      if (twoFactorCode) {
        authPayload.twoFactorCode = twoFactorCode;
      }

      try {
        await this.app.service('authentication').create(authPayload, { provider: undefined });
      } catch (error: any) {
        const reason = error?.data?.reason || '';
        if (reason === 'invalid_2fa_code') {
          throw new BadRequest('Invalid 2FA code');
        }
        throw new BadRequest('Invalid current password');
      }

      await this.app.service('users').patch(user.id, { password: newPassword });

      return {
        action: 'change-password',
        success: true,
      };
    }

    throw new BadRequest('Unsupported action');
  }
}
