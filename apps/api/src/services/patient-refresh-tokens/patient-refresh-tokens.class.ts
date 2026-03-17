import crypto from 'crypto';
import { BadRequest, NotAuthenticated } from '@feathersjs/errors';
import type { Application, PatientRefreshToken } from '../../declarations';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class PatientRefreshTokens {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(data: { action: string; refreshToken?: string }) {
    const { action } = data;

    switch (action) {
    case 'refresh':
      return this.refresh(data.refreshToken);
    default:
      throw new BadRequest('Unsupported action');
    }
  }

  async generateTokenPair(patientId: string, organizationId: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const config = this.app.get('sireAuthentication');
    const authService = this.app.service('authentication') as any;

    const accessToken = await authService.createAccessToken(
      { sub: patientId, type: 'patient', organizationId },
      { audience: config.audience, expiresIn: config.accessTokenExpiresIn },
    );

    const refreshToken = crypto.randomUUID();
    const family = crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const sequelize = this.app.get('sequelizeClient');
    const RefreshTokenModel = sequelize.models.patient_refresh_tokens;

    await RefreshTokenModel.create({
      id: crypto.randomUUID(),
      patientId,
      organizationId,
      tokenHash: hashToken(refreshToken),
      family,
      audience: config.audience,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  private async refresh(refreshToken?: string) {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new BadRequest('Refresh token is required');
    }

    const tokenHash = hashToken(refreshToken);
    const sequelize = this.app.get('sequelizeClient');
    const RefreshTokenModel = sequelize.models.patient_refresh_tokens;

    const record = await RefreshTokenModel.findOne({
      where: { tokenHash },
      raw: true,
    }) as unknown as PatientRefreshToken | null;

    if (!record) {
      throw new NotAuthenticated('Invalid refresh token');
    }

    if (record.revokedAt) {
      // Reuse detected — revoke entire family
      await RefreshTokenModel.update(
        { revokedAt: new Date() },
        { where: { family: (record as any).family, revokedAt: null } },
      );
      throw new NotAuthenticated('Refresh token reuse detected. All sessions revoked.');
    }

    if (new Date(record.expiresAt) < new Date()) {
      throw new NotAuthenticated('Refresh token expired');
    }

    // Revoke the current token
    await RefreshTokenModel.update(
      { revokedAt: new Date() },
      { where: { id: record.id } },
    );

    // Issue new pair with same family
    const config = this.app.get('sireAuthentication');
    const authService = this.app.service('authentication') as any;

    const accessToken = await authService.createAccessToken(
      { sub: record.patientId, type: 'patient', organizationId: record.organizationId },
      { audience: config.audience, expiresIn: config.accessTokenExpiresIn },
    );

    const newRefreshToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await RefreshTokenModel.create({
      id: crypto.randomUUID(),
      patientId: record.patientId,
      organizationId: record.organizationId,
      tokenHash: hashToken(newRefreshToken),
      family: (record as any).family,
      audience: config.audience,
      expiresAt,
    });

    // Fetch patient name
    let patientName = '';
    try {
      const patientRecord = await this.app.service('patients').get(record.patientId) as any;
      const pd = patientRecord.personalData;
      if (pd) {
        patientName = `${pd.firstName || ''} ${pd.lastName || ''}`.trim();
      }
    } catch {
      // Name not available
    }

    return {
      accessToken,
      refreshToken: newRefreshToken,
      patient: { id: record.patientId, organizationId: record.organizationId, name: patientName },
    };
  }
}
