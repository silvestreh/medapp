/**
 * Test user for app store review.
 *
 * Document "00000001" always gets the fixed OTP "123321",
 * skips all DB lookups, returns mock data, and produces no logs.
 */

export const TEST_DOCUMENT = '00000001';
export const TEST_OTP_CODE = '123321';
export const TEST_PATIENT_ID = '__test-patient__';
export const TEST_ORGANIZATION_ID = '__test-org__';

export function isTestPatient(patientId: string | undefined | null): boolean {
  return patientId === TEST_PATIENT_ID;
}

export function isTestDocument(documentNumber: string | undefined | null): boolean {
  return documentNumber === TEST_DOCUMENT;
}

// ---------------------------------------------------------------------------
// Mock data returned by sire services for the test patient
// ---------------------------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10);
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const MOCK_TREATMENT = {
  id: 'test-treatment-001',
  patientId: TEST_PATIENT_ID,
  organizationId: TEST_ORGANIZATION_ID,
  medicId: 'test-medic-001',
  medication: 'Acenocumarol',
  tabletDoseMg: 4,
  indication: 'Fibrilación auricular',
  targetInrMin: 2.0,
  targetInrMax: 3.0,
  startDate: '2025-01-15',
  endDate: null,
  nextControlDate: daysFromNow(7),
  status: 'active' as const,
  notes: null,
  createdAt: '2025-01-15T10:00:00.000Z',
  updatedAt: '2025-01-15T10:00:00.000Z',
};

export const MOCK_READINGS = [
  { id: 'test-reading-001', treatmentId: 'test-treatment-001', patientId: TEST_PATIENT_ID, organizationId: TEST_ORGANIZATION_ID, date: daysFromNow(-3), inr: 2.4, quick: null, percentage: 65, source: 'provider' as const, createdAt: daysFromNow(-3) + 'T10:00:00.000Z' },
  { id: 'test-reading-002', treatmentId: 'test-treatment-001', patientId: TEST_PATIENT_ID, organizationId: TEST_ORGANIZATION_ID, date: daysFromNow(-14), inr: 2.1, quick: null, percentage: 70, source: 'provider' as const, createdAt: daysFromNow(-14) + 'T10:00:00.000Z' },
  { id: 'test-reading-003', treatmentId: 'test-treatment-001', patientId: TEST_PATIENT_ID, organizationId: TEST_ORGANIZATION_ID, date: daysFromNow(-28), inr: 2.8, quick: null, percentage: 55, source: 'provider' as const, createdAt: daysFromNow(-28) + 'T10:00:00.000Z' },
];

export const MOCK_DOSE_SCHEDULE = {
  id: 'test-schedule-001',
  treatmentId: 'test-treatment-001',
  readingId: 'test-reading-001',
  startDate: daysFromNow(-3),
  endDate: null,
  schedule: {
    monday: 1,
    tuesday: 0.75,
    wednesday: 1,
    thursday: 0.75,
    friday: 1,
    saturday: 0.75,
    sunday: 1,
  },
  notes: null,
  createdById: 'test-medic-001',
  createdAt: daysFromNow(-3) + 'T10:00:00.000Z',
  updatedAt: daysFromNow(-3) + 'T10:00:00.000Z',
};

/** No log for today — lets the reviewer interact with the "take dose" button */
export const MOCK_DOSE_LOGS: any[] = [];
