import { LocalStrategy } from '@feathersjs/authentication-local';
import { NotAuthenticated } from '@feathersjs/errors';
import { Op } from 'sequelize';
import { verifyTotpCode } from './utils/totp';
import { isPasswordValid } from './utils/validate-password';
import { encryptValue } from './hooks/encryption';

export class TwoFactorLocalStrategy extends LocalStrategy {
  private async resolveEmailToUsername(email: string): Promise<string | null> {
    try {
      const sequelize = this.app?.get('sequelizeClient');
      if (!sequelize) return null;

      const { contact_data, user_contact_data, users } = sequelize.models;
      const encryptedEmail = encryptValue(email.toLowerCase());

      // Find ALL contact_data records with this email (there may be separate
      // records for the same email linked to patients vs users)
      const contactRecords = await contact_data?.findAll({
        where: { email: encryptedEmail },
        attributes: ['id'],
        raw: true,
      });

      if (!contactRecords || contactRecords.length === 0) return null;

      const contactDataIds = contactRecords.map((r: any) => r.id);

      // Find which of these contact_data records is linked to a user
      const ucdRecord = await user_contact_data?.findOne({
        where: { contactDataId: { [Op.in]: contactDataIds } },
        attributes: ['ownerId'],
        raw: true,
      });

      if (!ucdRecord) return null;

      const userRecord = await users?.findOne({
        where: { id: ucdRecord.ownerId },
        attributes: ['username'],
        raw: true,
      });

      return userRecord?.username ?? null;
    } catch (err) {
      console.error('[auth:email] resolveEmailToUsername failed:', err);
      return null;
    }
  }

  async authenticate(data: any, params: any) {
    const usernameField = (this.configuration as any)?.usernameField || 'username';

    const rawIdentifier = data?.[usernameField];
    if (typeof rawIdentifier === 'string' && rawIdentifier.includes('@')) {
      const resolvedUsername = await this.resolveEmailToUsername(rawIdentifier);
      if (resolvedUsername) {
        data[usernameField] = resolvedUsername;
      }
      // If not resolved, fall through — treat the raw value as a username
    }

    let result: any;

    try {
      result = await super.authenticate(data, params);
    } catch (err: any) {
      throw err;
    }

    const passwordField = (this.configuration as any)?.passwordField || 'password';
    if (!isPasswordValid(data?.[passwordField] || '')) {
      result.user.hasWeakPassword = true;
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
