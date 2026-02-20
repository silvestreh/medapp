import { LocalStrategy } from '@feathersjs/authentication-local';
import { NotAuthenticated } from '@feathersjs/errors';
import { verifyTotpCode } from './utils/totp';

export class TwoFactorLocalStrategy extends LocalStrategy {
  async findEntity(username: string, params: any) {
    const entity = await super.findEntity(username, params);
    console.log('[auth] findEntity result: id =', entity?.id, '| dataValues.id =', entity?.dataValues?.id, '| username =', entity?.username);
    return entity;
  }

  async getEntity(result: any, params: any) {
    console.log('[auth] getEntity called with id =', result?.id, '| dataValues.id =', result?.dataValues?.id);
    return super.getEntity(result, params);
  }

  async authenticate(data: any, params: any) {
    const usernameField = (this.configuration as any)?.usernameField || 'username';
    console.log('[auth] local strategy: attempting login for', data?.[usernameField]);
    let result: any;
    try {
      result = await super.authenticate(data, params);
      console.log('[auth] local strategy: auth passed, user id:', result?.user?.id);
    } catch (err: any) {
      console.error('[auth] local strategy: auth failed:', err?.message || err);
      throw err;
    }

    const sequelize = this.app?.get('sequelizeClient');
    const usersModel = sequelize?.models?.users;
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
