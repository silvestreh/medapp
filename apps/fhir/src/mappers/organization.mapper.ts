import type { Organization } from '@medplum/fhirtypes';
import { AR_SYSTEMS, DOMAIN_SYSTEM } from '../utils/identifiers';

interface InternalOrganization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  isActive: boolean;
}

export function mapOrganization(internal: InternalOrganization): Organization {
  const refesId = internal.settings?.refesId as string | undefined;

  const organization: Organization = {
    resourceType: 'Organization',
    id: internal.id,
    meta: {
      profile: ['http://fhir.msal.gob.ar/core/StructureDefinition/Organization-ar-core'],
    },
    active: internal.isActive,
    name: internal.name,
    identifier: [],
  };

  if (refesId) {
    organization.identifier!.push({
      use: 'official',
      system: AR_SYSTEMS.REFES,
      value: refesId,
    });
  }

  organization.identifier!.push({
    use: 'usual',
    system: DOMAIN_SYSTEM,
    value: internal.id,
  });

  return organization;
}
