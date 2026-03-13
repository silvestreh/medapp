import crypto from 'crypto';
import { BadRequest, NotAuthenticated } from '@feathersjs/errors';
import type { Application } from '../../declarations';

type PatientOtpAction = 'request-otp' | 'verify-otp';

interface PendingOtp {
  code: string;
  patientId: string;
  expiresAt: number;
  attempts: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_VERIFY_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_OTP_REQUESTS = 3;

export class PatientOtp {
  app: Application;
  private pendingOtps: Map<string, PendingOtp> = new Map();
  private requestRateLimits: Map<string, RateLimitEntry> = new Map();

  constructor(app: Application) {
    this.app = app;
  }

  async create(data: any) {
    const action = data?.action as PatientOtpAction | undefined;

    if (!action) {
      throw new BadRequest('Action is required');
    }

    switch (action) {
    case 'request-otp':
      return this.requestOtp(data);
    case 'verify-otp':
      return this.verifyOtp(data);
    default:
      throw new BadRequest('Unsupported action');
    }
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [key, entry] of this.pendingOtps) {
      if (entry.expiresAt < now) {
        this.pendingOtps.delete(key);
      }
    }
    for (const [key, entry] of this.requestRateLimits) {
      if (entry.windowStart + RATE_LIMIT_WINDOW_MS < now) {
        this.requestRateLimits.delete(key);
      }
    }
  }

  private isRateLimited(documentNumber: string): boolean {
    const entry = this.requestRateLimits.get(documentNumber);
    if (!entry) return false;

    const now = Date.now();
    if (entry.windowStart + RATE_LIMIT_WINDOW_MS < now) {
      this.requestRateLimits.delete(documentNumber);
      return false;
    }

    return entry.count >= MAX_OTP_REQUESTS;
  }

  private trackRequest(documentNumber: string) {
    const now = Date.now();
    const entry = this.requestRateLimits.get(documentNumber);

    if (!entry || entry.windowStart + RATE_LIMIT_WINDOW_MS < now) {
      this.requestRateLimits.set(documentNumber, { count: 1, windowStart: now });
    } else {
      entry.count += 1;
    }
  }

  private async findPatientByDocument(documentNumber: string): Promise<{ patientId: string; hasPhone: boolean } | null> {
    const result = await this.app.service('patients').find({
      query: { documentValue: documentNumber, $limit: 1 },
    } as any) as any;

    const patients = result.data || result;

    if (!patients.length) {
      return null;
    }

    const patient = patients[0];
    const phoneNumber = patient.contactData?.phoneNumber;
    const hasPhone = Array.isArray(phoneNumber)
      ? phoneNumber.length > 0
      : !!phoneNumber;

    return { patientId: String(patient.id), hasPhone };
  }

  private async requestOtp(data: any) {
    const { documentNumber } = data;

    if (!documentNumber || typeof documentNumber !== 'string') {
      throw new BadRequest('Document number is required');
    }

    this.cleanupExpired();

    if (this.isRateLimited(documentNumber)) {
      return { action: 'request-otp', status: 'rate_limited' };
    }

    this.trackRequest(documentNumber);

    const result = await this.findPatientByDocument(documentNumber);

    if (!result) {
      return { action: 'request-otp', status: 'not_found' };
    }

    if (!result.hasPhone) {
      return { action: 'request-otp', status: 'no_phone' };
    }

    const code = crypto.randomInt(100000, 999999).toString();

    this.pendingOtps.set(documentNumber, {
      code,
      patientId: result.patientId,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });

    console.log(`[Patient OTP] Code for document ${documentNumber}: ${code}`);

    return { action: 'request-otp', status: 'otp_sent' };
  }

  private async verifyOtp(data: any) {
    const { documentNumber, code } = data;

    if (!documentNumber || typeof documentNumber !== 'string') {
      throw new BadRequest('Document number is required');
    }

    if (!code || typeof code !== 'string') {
      throw new BadRequest('Code is required');
    }

    this.cleanupExpired();

    const pending = this.pendingOtps.get(documentNumber);

    if (!pending) {
      throw new NotAuthenticated('Invalid or expired code');
    }

    if (pending.expiresAt < Date.now()) {
      this.pendingOtps.delete(documentNumber);
      throw new NotAuthenticated('Invalid or expired code');
    }

    pending.attempts += 1;

    if (pending.attempts > MAX_VERIFY_ATTEMPTS) {
      this.pendingOtps.delete(documentNumber);
      throw new NotAuthenticated('Too many attempts. Please request a new code.');
    }

    if (pending.code !== code.trim()) {
      throw new NotAuthenticated('Invalid or expired code');
    }

    this.pendingOtps.delete(documentNumber);

    const authService = this.app.service('authentication');
    const config = this.app.get('patientAuthentication');
    const accessToken = await (authService as any).createAccessToken(
      { sub: pending.patientId, type: 'patient' },
      { audience: config.audience },
    );

    return {
      action: 'verify-otp',
      verified: true,
      accessToken,
      patient: { id: pending.patientId },
    };
  }
}
