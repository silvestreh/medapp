import type { Bundle, BundleEntry, Composition, Resource } from '@medplum/fhirtypes';
import { v4 as uuidv4 } from 'uuid';
import { FHIR_BASE_URL } from '../utils/identifiers';

interface FhirResource {
  resourceType: string;
  id?: string;
}

export interface IpsBundleInput {
  composition: Composition;
  patient: FhirResource;
  // Reached via Patient.managingOrganization (Composition-ar-ips-core
  // forbids author/custodian references, so this is the org's only link).
  organization: FhirResource;
  // Every practitioner referenced by a clinical resource (recorder /
  // informationSource) must travel in the bundle so the document is fully
  // resolvable.
  practitioners: FhirResource[];
  conditions: FhirResource[];
  allergies: FhirResource[];
  medications: FhirResource[];
}

export function mapIpsBundle(input: IpsBundleInput): Bundle {
  const entries: BundleEntry[] = [];

  const addEntry = (r: FhirResource) => {
    entries.push({
      // Absolute RESTful fullUrl so the relative references used inside the
      // resources (e.g. Patient/<id>) resolve within the bundle per FHIR
      // bundle-resolution rules. urn:uuid fullUrls would break resolution
      // (and derived ids like <encounterId>-condition-0 are not UUIDs).
      fullUrl: `${FHIR_BASE_URL}/${r.resourceType}/${r.id}`,
      resource: r as Resource,
    });
  };

  // Composition must be first entry in a document bundle
  addEntry(input.composition);
  addEntry(input.patient);
  addEntry(input.organization);

  for (const condition of input.conditions) addEntry(condition);
  for (const allergy of input.allergies) addEntry(allergy);
  for (const medication of input.medications) addEntry(medication);
  for (const practitioner of input.practitioners) addEntry(practitioner);

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
