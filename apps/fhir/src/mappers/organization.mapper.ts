import type { Organization } from '@medplum/fhirtypes';
import { AR_SYSTEMS, DOMAIN_SYSTEM } from '../utils/identifiers';
import { narrative } from '../utils/fhir-helpers';

interface InternalOrganization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  isActive: boolean;
}

/**
 * Multiple tenant orgs can share the same physical establishment (e.g.
 * independent medics renting rooms in one institution). The FHIR layer
 * exposes ONE canonical Organization per REFES code — its resource id is
 * derived from the REFES id so tenants dedupe naturally.
 */
export function canonicalOrganizationId(internal: Pick<InternalOrganization, 'id' | 'settings'>): string {
  const refesId = internal.settings?.refesId as string | undefined;
  return refesId ? `refes-${refesId}` : internal.id;
}

export function mapOrganization(internal: InternalOrganization, officialName?: string): Organization {
  const refesId = internal.settings?.refesId as string | undefined;
  const name = officialName || internal.name;

  const organization: Organization = {
    resourceType: 'Organization',
    id: canonicalOrganizationId(internal),
    meta: {
      profile: ['http://fhir.msal.gob.ar/core/StructureDefinition/Organization-ar-core'],
    },
    text: narrative(name),
    active: internal.isActive,
    name,
    // Organization-ar-core allows exactly one identifier: the REFES id
    // (use fixed to 'usual'). Without a refesId the organization cannot
    // conform to the profile; we fall back to the domain identifier so the
    // resource still carries a usable id.
    identifier: refesId
      ? [{
        use: 'usual',
        system: AR_SYSTEMS.REFES,
        value: refesId,
      }]
      : [{
        use: 'usual',
        system: DOMAIN_SYSTEM,
        value: internal.id,
      }],
  };

  return organization;
}
