import { LocalStrategy } from '@feathersjs/authentication-local';
import { NotAuthenticated } from '@feathersjs/errors';
import { verifyTotpCode } from './utils/totp';

export class TwoFactorLocalStrategy extends LocalStrategy {
  async authenticate(data: any, params: any) {
    const result: any = await super.authenticate(data, params);

    const sequelize = this.app?.get('sequelizeClient');
    const usersModel = sequelize?.models?.users;
    const usernameField = (this.configuration as any)?.usernameField || 'username';
    const username = data?.[usernameField];

    const persistedUser = await usersModel?.findOne({
      where: { [usernameField]: username },
      raw: true,
    });

    if (!persistedUser?.twoFactorEnabled) {
      return result;
    }

    const twoFactorCode = typeof data?.twoFactorCode === 'string' ? data.twoFactorCode : '';

    if (!twoFactorCode) {
      throw new NotAuthenticated('Not authenticated', {
        reason: '2fa_required',
      });
    }

    if (!persistedUser.twoFactorSecret || !verifyTotpCode({ secret: persistedUser.twoFactorSecret, code: twoFactorCode })) {
      throw new NotAuthenticated('Not authenticated', {
        reason: 'invalid_2fa_code',
      });
    }

    return result;
  }
}
