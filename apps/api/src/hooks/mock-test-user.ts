import { Hook, HookContext } from '@feathersjs/feathers';
import {
  isTestPatient,
  MOCK_TREATMENT,
  MOCK_READINGS,
  MOCK_DOSE_SCHEDULE,
  MOCK_DOSE_LOGS,
} from '../test-user';

type MockService = 'sire-treatments' | 'sire-readings' | 'sire-dose-schedules' | 'sire-dose-logs' | 'sire-push-tokens';

const MOCK_DATA: Record<MockService, any[]> = {
  'sire-treatments': [MOCK_TREATMENT],
  'sire-readings': MOCK_READINGS,
  'sire-dose-schedules': [MOCK_DOSE_SCHEDULE],
  'sire-dose-logs': MOCK_DOSE_LOGS,
  'sire-push-tokens': [],
};

/**
 * For the test patient, intercepts all service calls and returns mock data
 * without touching the database. Supports find, get, create, and patch.
 */
const mockTestUser = (service: MockService): Hook => async (context: HookContext): Promise<HookContext> => {
  const patientId = context.params.patient?.id;
  if (!isTestPatient(patientId)) return context;

  const records = MOCK_DATA[service] || [];

  if (context.method === 'find') {
    context.result = { total: records.length, limit: 50, skip: 0, data: records };
  } else if (context.method === 'get') {
    context.result = records[0] || null;
  } else if (context.method === 'create') {
    // Simulate successful create (e.g. dose log, push token)
    context.result = { id: `test-${Date.now()}`, ...context.data };
  } else if (context.method === 'patch') {
    context.result = { ...(records[0] || {}), ...context.data };
  }

  return context;
};

export default mockTestUser;
