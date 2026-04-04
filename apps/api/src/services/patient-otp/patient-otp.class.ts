import crypto from 'crypto';
import { BadRequest } from '@feathersjs/errors';
import type { Application } from '../../declarations';
import { TEST_OTP_CODE, TEST_PATIENT_ID, isTestDocument } from '../../test-user';

type PatientOtpAction = 'request-otp' | 'get-organization' | 'list-organizations';

export interface PendingOtp {
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
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_REQUESTS = 5;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function isValidSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 100 && SLUG_RE.test(slug);
}

export class PatientOtp {
  app: Application;
  pendingOtps: Map<string, PendingOtp> = new Map();
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
    case 'get-organization':
      return this.getOrganization(data);
    case 'list-organizations':
      return this.listOrganizations();
    default:
      throw new BadRequest('Unsupported action');
    }
  }

  cleanupExpired() {
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

  private async findPatientByDocument(documentNumber: string): Promise<{ patientId: string; phone: string | null } | null> {
    const result = await this.app.service('patients').find({
      query: { documentValue: documentNumber, $limit: 1 },
    } as any) as any;

    const patients = result.data || result;

    if (!patients.length) {
      return null;
    }

    const patient = patients[0];
    const phoneNumber = patient.contactData?.phoneNumber;
    const rawPhone = this.pickMobileNumber(phoneNumber);

    return { patientId: String(patient.id), phone: rawPhone || null };
  }

  /**
   * Picks the best phone number for WhatsApp: prefers `cel:` over `tel:`.
   * Accepts a single string or an array of prefixed phone strings.
   */
  private pickMobileNumber(phoneNumber: string | string[] | null | undefined): string | null {
    if (!phoneNumber) return null;

    const numbers = Array.isArray(phoneNumber) ? phoneNumber : [phoneNumber];
    if (numbers.length === 0) return null;

    // Prefer cel: (mobile) over tel: (landline)
    const mobile = numbers.find((n) => typeof n === 'string' && n.startsWith('cel:'));
    const picked = mobile || numbers[0];

    return typeof picked === 'string' ? picked : null;
  }

  private maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 4) return digits;
    return '*'.repeat(digits.length - 4) + digits.slice(-4);
  }

  private async resolveOrganizationId(slug?: string): Promise<string | null> {
    if (!slug) return null;
    if (!isValidSlug(slug)) return null;

    const result = await this.app.service('organizations').find({
      query: { slug, $limit: 1 },
    } as any) as any;

    const organizations = result.data || result;
    return organizations.length ? String(organizations[0].id) : null;
  }

  private async requestOtp(data: any) {
    const { documentNumber, slug } = data;

    if (!documentNumber || typeof documentNumber !== 'string') {
      throw new BadRequest('Document number is required');
    }

    if (documentNumber.length > 50 || !/^[a-zA-Z0-9]+$/.test(documentNumber)) {
      throw new BadRequest('Invalid document number');
    }

    // Test user for app store review — fixed OTP, no DB, no WhatsApp
    if (isTestDocument(documentNumber)) {
      this.pendingOtps.set(documentNumber, {
        code: TEST_OTP_CODE,
        patientId: TEST_PATIENT_ID,
        expiresAt: Date.now() + OTP_TTL_MS,
        attempts: 0,
      });
      return { action: 'request-otp', status: 'otp_sent', maskedPhone: '******1234' };
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

    if (!result.phone) {
      return { action: 'request-otp', status: 'no_phone' };
    }

    const code = crypto.randomInt(100000, 999999).toString();

    this.pendingOtps.set(documentNumber, {
      code,
      patientId: result.patientId,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });

    // Send OTP via WhatsApp
    try {
      const organizationId = await this.resolveOrganizationId(slug);
      if (organizationId) {
        await this.app.service('whatsapp').create({
          type: 'text',
          organizationId,
          to: result.phone,
          body: `Tu código de verificación es: ${code}\n\nExpira en 5 minutos.`,
        });
      } else {
        console.warn('[Patient OTP] No organization slug provided, skipping WhatsApp send');
      }
    } catch (err) {
      console.error('[Patient OTP] Failed to send WhatsApp message:', err);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Patient OTP] Code for document ${documentNumber}: ${code}`);
    }

    return { action: 'request-otp', status: 'otp_sent', maskedPhone: this.maskPhone(result.phone) };
  }

  private async listOrganizations() {
    const result = await this.app.service('organizations').find({
      query: { isActive: true, $limit: 50 },
    } as any) as any;

    const organizations = result.data || result;

    return {
      action: 'list-organizations',
      organizations: organizations.map((org: any) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
      })),
    };
  }

  private async getOrganization(data: any) {
    const { slug } = data;

    if (!slug || typeof slug !== 'string' || !isValidSlug(slug)) {
      throw new BadRequest('Organization slug is required');
    }

    const result = await this.app.service('organizations').find({
      query: { slug, $limit: 1 },
    } as any) as any;

    const organizations = result.data || result;

    if (!organizations.length) {
      throw new BadRequest('Organization not found');
    }

    const org = organizations[0];
    const healthCenter = org.settings?.healthCenter || {};

    return {
      action: 'get-organization',
      organization: {
        name: org.name,
        slug: org.slug,
        logoUrl: healthCenter.logoUrl || null,
        address: healthCenter.address || null,
        phone: healthCenter.phone || null,
        email: healthCenter.email || null,
      },
    };
  }

}
