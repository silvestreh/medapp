import { AuthenticationBaseStrategy, AuthenticationResult } from '@feathersjs/authentication';
import { NotAuthenticated, BadRequest } from '@feathersjs/errors';

const MAX_VERIFY_ATTEMPTS = 5;

export class PatientOtpStrategy extends AuthenticationBaseStrategy {
  async authenticate(data: any): Promise<AuthenticationResult> {
    const { documentNumber, code, slug, app: clientApp } = data;

    if (!documentNumber || typeof documentNumber !== 'string') {
      throw new BadRequest('Document number is required');
    }

    if (!code || typeof code !== 'string') {
      throw new BadRequest('Code is required');
    }

    if (!slug || typeof slug !== 'string') {
      throw new BadRequest('Organization slug is required');
    }

    // Access the pending OTPs from the patient-otp service
    const otpService = this.app!.service('patient-otp') as any;
    otpService.cleanupExpired();

    const pending = otpService.pendingOtps.get(documentNumber);

    if (!pending) {
      throw new NotAuthenticated('Invalid or expired code');
    }

    if (pending.expiresAt < Date.now()) {
      otpService.pendingOtps.delete(documentNumber);
      throw new NotAuthenticated('Invalid or expired code');
    }

    pending.attempts += 1;

    if (pending.attempts > MAX_VERIFY_ATTEMPTS) {
      otpService.pendingOtps.delete(documentNumber);
      throw new NotAuthenticated('Too many attempts. Please request a new code.');
    }

    if (pending.code !== code.trim()) {
      throw new NotAuthenticated('Invalid or expired code');
    }

    otpService.pendingOtps.delete(documentNumber);

    // Resolve organization ID from slug
    const orgResult = await this.app!.service('organizations').find({
      query: { slug, $limit: 1 },
    } as any) as any;
    const organizations = orgResult.data || orgResult;
    if (!organizations.length) {
      throw new BadRequest('Organization not found');
    }
    const organizationId = String(organizations[0].id);

    // For sire app: short-lived access token + refresh token + patient name
    if (clientApp === 'sire') {
      const refreshTokenService = this.app!.service('patient-refresh-tokens') as any;
      const { accessToken, refreshToken } = await refreshTokenService.generateTokenPair(
        pending.patientId,
        organizationId,
      );

      // Fetch patient name to include in response
      let patientName = '';
      try {
        const patientRecord = await this.app!.service('patients').get(pending.patientId) as any;
        const pd = patientRecord.personalData;
        if (pd) {
          patientName = `${pd.firstName || ''} ${pd.lastName || ''}`.trim();
        }
      } catch {
        // Name not available
      }

      return {
        accessToken,
        refreshToken,
        authentication: { strategy: this.name },
        patient: { id: pending.patientId, organizationId, name: patientName },
      };
    }

    // Default: booking app behavior — 1-day access token, no refresh token
    const authService = this.app!.service('authentication') as any;
    const config = this.app!.get('patientAuthentication');
    const accessToken = await authService.createAccessToken(
      { sub: pending.patientId, type: 'patient', organizationId },
      { audience: config.audience },
    );

    return {
      accessToken,
      authentication: { strategy: this.name },
      patient: { id: pending.patientId, organizationId },
    };
  }
}
