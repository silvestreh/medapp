import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { BadRequest, NotAuthenticated } from '@feathersjs/errors';
import type { Application, User } from '../../declarations';
import logger from '../../logger';

type WebAuthnAction =
  | 'generate-registration-options'
  | 'verify-registration'
  | 'generate-authentication-options'
  | 'verify-authentication';

const getRpConfig = (app: Application) => {
  const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
  const rpName = process.env.WEBAUTHN_RP_NAME || 'MedApp';
  const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';
  return { rpID, rpName, origin };
};

export class WebAuthn {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  private getSequelize() {
    return this.app.get('sequelizeClient');
  }

  private async getUserCredentials(userId: string) {
    const sequelize = this.getSequelize();
    return sequelize.models.passkey_credentials.findAll({
      where: { userId },
      raw: true,
    });
  }

  async create(data: any, params: any) {
    const action = data?.action as WebAuthnAction | undefined;
    logger.debug('[webauthn] create called with action=%s', action);

    if (!action) {
      throw new BadRequest('Action is required');
    }

    switch (action) {
      case 'generate-registration-options':
        return this.generateRegistrationOptions(data, params);
      case 'verify-registration':
        return this.verifyRegistration(data, params);
      case 'generate-authentication-options':
        return this.generateAuthenticationOptions(data, params);
      case 'verify-authentication':
        return this.verifyAuthentication(data, params);
      default:
        throw new BadRequest('Unsupported action');
    }
  }

  private async generateRegistrationOptions(_data: any, params: any) {
    const user = params?.user as User | undefined;
    if (!user) {
      logger.warn('[webauthn] generate-registration-options called without authenticated user');
      throw new NotAuthenticated('Authentication required');
    }

    const { rpID, rpName } = getRpConfig(this.app);
    logger.info('[webauthn] generating registration options for user=%s rpID=%s rpName=%s', user.username, rpID, rpName);

    const existingCredentials = await this.getUserCredentials(String(user.id));
    logger.debug('[webauthn] user has %d existing credentials', existingCredentials.length);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.username,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((cred: any) => ({
        id: cred.credentialId,
        transports: cred.transports || undefined,
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    logger.debug('[webauthn] registration options generated, challenge=%s', options.challenge.slice(0, 16) + '...');

    const sequelize = this.getSequelize();
    await sequelize.models.users.update(
      { currentChallenge: options.challenge },
      { where: { id: user.id } }
    );

    return { action: 'generate-registration-options', options };
  }

  private async verifyRegistration(data: any, params: any) {
    const user = params?.user as User | undefined;
    if (!user) {
      logger.warn('[webauthn] verify-registration called without authenticated user');
      throw new NotAuthenticated('Authentication required');
    }

    const { credential, deviceName } = data;
    if (!credential) {
      logger.warn('[webauthn] verify-registration called without credential payload');
      throw new BadRequest('Credential response is required');
    }

    logger.info('[webauthn] verifying registration for user=%s deviceName=%s', user.username, deviceName || '(none)');
    logger.debug('[webauthn] credential.id=%s credential.type=%s', credential.id, credential.type);

    const { rpID, origin } = getRpConfig(this.app);

    const sequelize = this.getSequelize();
    const freshUser = await sequelize.models.users.findByPk(user.id, { raw: true });
    const expectedChallenge = freshUser?.currentChallenge;

    if (!expectedChallenge) {
      logger.warn('[webauthn] no pending challenge found for user=%s', user.username);
      throw new BadRequest('No pending registration challenge');
    }

    logger.debug('[webauthn] verifying against expectedOrigin=%s expectedRPID=%s challenge=%s', origin, rpID, expectedChallenge.slice(0, 16) + '...');

    try {
      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      logger.debug('[webauthn] registration verification result: verified=%s', verification.verified);

      if (!verification.verified || !verification.registrationInfo) {
        logger.warn('[webauthn] registration verification failed for user=%s', user.username);
        throw new BadRequest('Registration verification failed');
      }

      const { credential: registeredCredential, credentialBackedUp } = verification.registrationInfo;

      logger.info('[webauthn] registration verified for user=%s credentialId=%s backedUp=%s', user.username, registeredCredential.id.slice(0, 16) + '...', credentialBackedUp);

      await sequelize.models.passkey_credentials.create({
        credentialId: registeredCredential.id,
        publicKey: Buffer.from(registeredCredential.publicKey).toString('base64url'),
        counter: registeredCredential.counter,
        transports: credential.response?.transports || null,
        deviceName: deviceName || null,
        userId: user.id,
      });

      await sequelize.models.users.update(
        { currentChallenge: null },
        { where: { id: user.id } }
      );

      logger.info('[webauthn] passkey credential saved for user=%s', user.username);

      return {
        action: 'verify-registration',
        verified: true,
        backedUp: credentialBackedUp,
      };
    } catch (error: any) {
      if (error instanceof BadRequest || error instanceof NotAuthenticated) throw error;
      logger.error('[webauthn] registration verification threw: %s', error?.message || error);
      throw new BadRequest('Registration verification failed');
    }
  }

  private async generateAuthenticationOptions(data: any, _params: any) {
    const { rpID } = getRpConfig(this.app);
    logger.info('[webauthn] generating authentication options, rpID=%s', rpID);

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
    });

    this._pendingChallenges = this._pendingChallenges || new Map();
    this._pendingChallenges.set(options.challenge, Date.now());
    this.cleanupExpiredChallenges();

    logger.debug('[webauthn] authentication options generated, challenge=%s pendingCount=%d', options.challenge.slice(0, 16) + '...', this._pendingChallenges.size);

    return { action: 'generate-authentication-options', options };
  }

  private _pendingChallenges?: Map<string, number>;

  private cleanupExpiredChallenges() {
    if (!this._pendingChallenges) return;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    let cleaned = 0;
    for (const [challenge, timestamp] of this._pendingChallenges) {
      if (timestamp < fiveMinutesAgo) {
        this._pendingChallenges.delete(challenge);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug('[webauthn] cleaned up %d expired challenges, remaining=%d', cleaned, this._pendingChallenges.size);
    }
  }

  private async verifyAuthentication(data: any, _params: any) {
    const { credential, challenge } = data;
    if (!credential) {
      logger.warn('[webauthn] verify-authentication called without credential');
      throw new BadRequest('Credential response is required');
    }
    if (!challenge) {
      logger.warn('[webauthn] verify-authentication called without challenge');
      throw new BadRequest('Challenge is required');
    }

    logger.info('[webauthn] verifying authentication, credentialId=%s challenge=%s', credential.id?.slice(0, 16) + '...', challenge.slice(0, 16) + '...');

    this._pendingChallenges = this._pendingChallenges || new Map();
    if (!this._pendingChallenges.has(challenge)) {
      logger.warn('[webauthn] challenge not found in pending set (expired or invalid), pendingCount=%d', this._pendingChallenges.size);
      throw new BadRequest('Invalid or expired challenge');
    }
    this._pendingChallenges.delete(challenge);

    const { rpID, origin } = getRpConfig(this.app);
    const sequelize = this.getSequelize();

    logger.debug('[webauthn] looking up credential by id=%s', credential.id);
    const credentialRecord = await sequelize.models.passkey_credentials.findOne({
      where: { credentialId: credential.id },
      raw: true,
    });

    if (!credentialRecord) {
      logger.warn('[webauthn] no credential record found for id=%s', credential.id);
      throw new NotAuthenticated('Unknown credential');
    }

    logger.debug('[webauthn] found credential record, userId=%s counter=%s', credentialRecord.userId, credentialRecord.counter);

    const user = await sequelize.models.users.findByPk(credentialRecord.userId, { raw: true });
    if (!user) {
      logger.warn('[webauthn] user not found for userId=%s', credentialRecord.userId);
      throw new NotAuthenticated('User not found');
    }

    logger.debug('[webauthn] verifying against expectedOrigin=%s expectedRPID=%s', origin, rpID);

    const publicKeyBytes = Uint8Array.from(Buffer.from(credentialRecord.publicKey, 'base64url'));

    try {
      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credentialRecord.credentialId,
          publicKey: publicKeyBytes,
          counter: Number(credentialRecord.counter),
          transports: credentialRecord.transports || undefined,
        },
      });

      logger.debug('[webauthn] authentication verification result: verified=%s newCounter=%s', verification.verified, verification.authenticationInfo?.newCounter);

      if (!verification.verified) {
        logger.warn('[webauthn] authentication verification returned verified=false for user=%s', user.username);
        throw new NotAuthenticated('Authentication verification failed');
      }

      await sequelize.models.passkey_credentials.update(
        { counter: verification.authenticationInfo.newCounter },
        { where: { id: credentialRecord.id } }
      );

      const authService = this.app.service('authentication');
      const accessToken = await (authService as any).createAccessToken({ sub: user.id });

      logger.info('[webauthn] authentication successful for user=%s (passkey login, 2FA bypassed)', user.username);

      return {
        action: 'verify-authentication',
        verified: true,
        accessToken,
        user: {
          id: user.id,
          username: user.username,
        },
      };
    } catch (error: any) {
      if (error instanceof BadRequest || error instanceof NotAuthenticated) throw error;
      logger.error('[webauthn] authentication verification threw: %s', error?.message || error);
      throw new NotAuthenticated('Authentication verification failed');
    }
  }
}
