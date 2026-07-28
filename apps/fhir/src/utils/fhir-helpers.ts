import type { Bundle, BundleEntry, Narrative, OperationOutcome, Resource } from '@medplum/fhirtypes';
import { v4 as uuidv4 } from 'uuid';
import { FHIR_BASE_URL } from './identifiers';

function escapeXhtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Minimal generated narrative satisfying the dom-6 best-practice constraint.
// lang/xml:lang keep the XHTML consistent with resources that declare
// language: es-AR (all narrative content here is Spanish).
export function narrative(text: string): Narrative {
  return {
    status: 'generated',
    div: `<div xmlns="http://www.w3.org/1999/xhtml" lang="es-AR" xml:lang="es-AR"><p>${escapeXhtml(text)}</p></div>`,
  };
}

export function createSearchBundle(resources: Resource[], total: number, selfUrl?: string): Bundle {
  return {
    resourceType: 'Bundle',
    id: uuidv4(),
    type: 'searchset',
    total,
    link: selfUrl ? [{ relation: 'self', url: selfUrl }] : undefined,
    entry: resources.map((resource): BundleEntry => ({
      fullUrl: `${FHIR_BASE_URL}/${resource.resourceType}/${resource.id}`,
      resource,
      search: { mode: 'match' },
    })),
  };
}

export function absoluteSelfUrl(originalUrl: string): string {
  return `${FHIR_BASE_URL}${originalUrl}`;
}

export function createOperationOutcome(
  severity: 'error' | 'warning' | 'information',
  code: string,
  diagnostics: string
): OperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    text: narrative(diagnostics),
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
