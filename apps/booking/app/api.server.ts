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

export interface BookingData {
  patientId: string;
  data: any[];
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

export async function requestOtp(documentNumber: string) {
  const client = createClient();
  return await client.service('patient-otp').create({
    action: 'request-otp',
    documentNumber,
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

export async function findBookings(token: string): Promise<BookingData> {
  const client = createClient(token);
  return await client.service('booking').find({}) as BookingData;
}
