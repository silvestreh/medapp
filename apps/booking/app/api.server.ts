import { createClient } from '~/feathers.server';

// -- Types --

export interface OrganizationInfo {
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface PatientBooking {
  id: string;
  startDate: string;
  medic: {
    firstName: string;
    lastName: string;
    specialty: string;
  };
}

export interface MedicData {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  title: string;
}

export interface AnonymizedSlot {
  date: string;
  taken: boolean;
  extra?: boolean;
}

// -- patient-otp (public, no auth) --

export async function getOrganization(slug: string): Promise<OrganizationInfo> {
  const client = createClient();
  const result = await client.service('patient-otp').create({
    action: 'get-organization',
    slug,
  }) as any;
  return result.organization;
}

export async function requestOtp(documentNumber: string, slug: string) {
  const client = createClient();
  return await client.service('patient-otp').create({
    action: 'request-otp',
    documentNumber,
    slug,
  }) as { action: string; status: 'otp_sent' | 'not_found' | 'no_phone' | 'rate_limited'; maskedPhone?: string };
}

export async function verifyOtp(documentNumber: string, code: string, slug: string) {
  const client = createClient();
  return await client.service('authentication').create({
    strategy: 'patient-otp',
    documentNumber,
    code,
    slug,
  }) as { accessToken: string; authentication: any; patient: { id: string; organizationId: string } };
}

// -- booking (authenticated) --

export async function findMedics(token: string): Promise<MedicData[]> {
  const client = createClient(token);
  return await client.service('booking').find({
    query: { intent: 'find-medics' },
  }) as MedicData[];
}

export async function findAppointments(token: string, medicId: string, date?: string): Promise<AnonymizedSlot[]> {
  const client = createClient(token);
  return await client.service('booking').find({
    query: { intent: 'find-appointments', medicId, date },
  }) as AnonymizedSlot[];
}

export async function createBooking(
  token: string,
  medicId: string,
  startDate: string
): Promise<{ ok: boolean; appointmentId?: string }> {
  const client = createClient(token);
  return await client.service('booking').create({ medicId, startDate }) as {
    ok: boolean;
    appointmentId?: string;
  };
}

// -- Turnstile verification --

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(turnstileToken: string): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY) {
    console.warn('TURNSTILE_SECRET_KEY not set, skipping verification');
    return true;
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: TURNSTILE_SECRET_KEY,
      response: turnstileToken,
    }),
  });

  const result = await response.json();
  return result.success === true;
}

export async function cancelBooking(token: string, appointmentId: string): Promise<{ ok: boolean }> {
  const client = createClient(token);
  return await client.service('booking').remove(appointmentId) as { ok: boolean };
}

export async function findBookings(token: string): Promise<PatientBooking[]> {
  const client = createClient(token);
  return await client.service('booking').find({
    query: { intent: 'find-bookings' },
  }) as PatientBooking[];
}
