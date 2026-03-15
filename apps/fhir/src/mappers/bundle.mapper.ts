import type { Bundle, BundleEntry, Composition, Resource } from '@medplum/fhirtypes';
import { v4 as uuidv4 } from 'uuid';

interface FhirResource {
  resourceType: string;
  id?: string;
}

export interface IpsBundleInput {
  composition: Composition;
  patient: FhirResource;
  practitioner: FhirResource;
  organization: FhirResource;
  conditions: FhirResource[];
  allergies: FhirResource[];
  medications: FhirResource[];
}

export function mapIpsBundle(input: IpsBundleInput): Bundle {
  const entries: BundleEntry[] = [];

  const addEntry = (r: FhirResource) => {
    entries.push({
      fullUrl: `urn:uuid:${r.id}`,
      resource: r as Resource,
    });
  };

  // Composition must be first entry in a document bundle
  addEntry(input.composition);
  addEntry(input.patient);
  addEntry(input.practitioner);
  addEntry(input.organization);

  for (const condition of input.conditions) addEntry(condition);
  for (const allergy of input.allergies) addEntry(allergy);
  for (const medication of input.medications) addEntry(medication);

  return {
    resourceType: 'Bundle',
    id: uuidv4(),
    language: 'es-AR',
    meta: {
      profile: ['http://fhir.msal.gob.ar/core/StructureDefinition/Bundle-ar-ips-core'],
    },
    identifier: {
      system: 'urn:ietf:rfc:3986',
      value: `urn:uuid:${uuidv4()}`,
    },
    type: 'document',
    timestamp: new Date().toISOString(),
    entry: entries,
  };
}
