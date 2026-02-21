import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { BadRequest, NotAuthenticated } from '@feathersjs/errors';
import type { Application, User } from '../../declarations';

type WebAuthnAction =
  | 'generate-registration-options'
  | 'verify-registration'
  | 'generate-authentication-options'
  | 'verify-authentication';

const getRpConfig = () => {
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

    if (!action) {
      throw new BadRequest('Action is required');
    }

    switch (action) {
    case 'generate-registration-options':
      return this.generateRegistrationOptions(data, params);
    case 'verify-registration':
      return this.verifyRegistration(data, params);
    case 'generate-authentication-options':
      return this.generateAuthenticationOptions();
    case 'verify-authentication':
      return this.verifyAuthentication(data);
    default:
      throw new BadRequest('Unsupported action');
    }
  }

  private async generateRegistrationOptions(_data: any, params: any) {
    const user = params?.user as User | undefined;
    if (!user) {
      throw new NotAuthenticated('Authentication required');
    }

    const { rpID, rpName } = getRpConfig();

    const existingCredentials = await this.getUserCredentials(String(user.id));

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
      throw new NotAuthenticated('Authentication required');
    }

    const { credential, deviceName } = data;
    if (!credential) {
      throw new BadRequest('Credential response is required');
    }

    const { rpID, origin } = getRpConfig();

    const sequelize = this.getSequelize();
    const freshUser = await sequelize.models.users.findByPk(user.id, { raw: true });
    const expectedChallenge = freshUser?.currentChallenge;

    if (!expectedChallenge) {
      throw new BadRequest('No pending registration challenge');
    }

    try {
      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        throw new BadRequest('Registration verification failed');
      }

      const { credential: registeredCredential, credentialBackedUp } = verification.registrationInfo;

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

      return {
        action: 'verify-registration',
        verified: true,
        backedUp: credentialBackedUp,
      };
    } catch (error: any) {
      if (error instanceof BadRequest || error instanceof NotAuthenticated) throw error;
      throw new BadRequest('Registration verification failed');
    }
  }

  private async generateAuthenticationOptions() {
    const { rpID } = getRpConfig();

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
    });

    this._pendingChallenges = this._pendingChallenges || new Map();
    this._pendingChallenges.set(options.challenge, Date.now());
    this.cleanupExpiredChallenges();

    return { action: 'generate-authentication-options', options };
  }

  private _pendingChallenges?: Map<string, number>;

  private cleanupExpiredChallenges() {
    if (!this._pendingChallenges) return;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [challenge, timestamp] of this._pendingChallenges) {
      if (timestamp < fiveMinutesAgo) {
        this._pendingChallenges.delete(challenge);
      }
    }
  }


  private async verifyAuthentication(data: any) {
    const { credential, challenge } = data;
    if (!credential) {
      throw new BadRequest('Credential response is required');
    }
    if (!challenge) {
      throw new BadRequest('Challenge is required');
    }

    this._pendingChallenges = this._pendingChallenges || new Map();
    if (!this._pendingChallenges.has(challenge)) {
      throw new BadRequest('Invalid or expired challenge');
    }
    this._pendingChallenges.delete(challenge);

    const { rpID, origin } = getRpConfig();
    const sequelize = this.getSequelize();

    const credentialRecord = await sequelize.models.passkey_credentials.findOne({
      where: { credentialId: credential.id },
      raw: true,
    });

    if (!credentialRecord) {
      throw new NotAuthenticated('Unknown credential');
    }

    const user = await sequelize.models.users.findByPk(credentialRecord.userId, { raw: true });
    if (!user) {
      throw new NotAuthenticated('User not found');
    }

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

      if (!verification.verified) {
        throw new NotAuthenticated('Authentication verification failed');
      }

      await sequelize.models.passkey_credentials.update(
        { counter: verification.authenticationInfo.newCounter },
        { where: { id: credentialRecord.id } }
      );

      const authService = this.app.service('authentication');
      const accessToken = await (authService as any).createAccessToken({ sub: user.id });

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
      throw new NotAuthenticated('Authentication verification failed');
    }
  }
}
