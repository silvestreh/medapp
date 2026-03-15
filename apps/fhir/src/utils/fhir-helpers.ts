import type { Bundle, BundleEntry, OperationOutcome, Resource } from '@medplum/fhirtypes';
import { v4 as uuidv4 } from 'uuid';

export function createSearchBundle(resources: Resource[], total: number): Bundle {
  return {
    resourceType: 'Bundle',
    id: uuidv4(),
    type: 'searchset',
    total,
    entry: resources.map((resource): BundleEntry => ({
      fullUrl: `urn:uuid:${resource.id}`,
      resource,
    })),
  };
}

export function createOperationOutcome(
  severity: 'error' | 'warning' | 'information',
  code: string,
  diagnostics: string
): OperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity,
        code: code as OperationOutcome['issue'][0]['code'],
        diagnostics,
      },
    ],
  };
}

export function parseFhirSearchParams(query: Record<string, string | undefined>) {
  const count = Math.min(parseInt(query._count || '50', 10), 200);
  const offset = parseInt(query._offset || '0', 10);
  return { count, offset };
}
