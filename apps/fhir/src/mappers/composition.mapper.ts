import type { Composition, Reference } from '@medplum/fhirtypes';
import { v4 as uuidv4 } from 'uuid';
import { AR_SYSTEMS, LOINC_CODES } from '../utils/identifiers';

interface FhirResource {
  resourceType: string;
  id?: string;
}

interface CompositionInput {
  patientId: string;
  practitionerId: string;
  organizationId: string;
  conditions: FhirResource[];
  allergies: FhirResource[];
  medications: FhirResource[];
}

function makeEntryReferences(resources: FhirResource[]): Reference[] {
  return resources.map((r) => ({
    reference: `${r.resourceType}/${r.id}`,
  }));
}

export function mapComposition(input: CompositionInput): Composition {
  const now = new Date().toISOString();

  const composition: Composition = {
    resourceType: 'Composition',
    id: uuidv4(),
    meta: {
      profile: ['http://fhir.msal.gob.ar/core/StructureDefinition/Composition-ar-ips-core'],
    },
    language: 'es-AR',
    identifier: {
      system: 'urn:ietf:rfc:3986',
      value: `urn:uuid:${uuidv4()}`,
    },
    status: 'final',
    type: {
      coding: [{
        system: AR_SYSTEMS.LOINC,
        code: LOINC_CODES.PATIENT_SUMMARY,
        display: 'Patient summary Document',
      }],
    },
    subject: {
      reference: `Patient/${input.patientId}`,
    },
    date: now,
    author: [{
      reference: `Practitioner/${input.practitionerId}`,
    }],
    title: 'Resumen del Paciente (IPS Argentina)',
    custodian: {
      reference: `Organization/${input.organizationId}`,
    },
    section: [],
  };

  // Immunizations section (emptyReason - no data available)
  composition.section!.push({
    title: 'Inmunizaciones',
    code: {
      coding: [{ system: AR_SYSTEMS.LOINC, code: LOINC_CODES.IMMUNIZATIONS, display: 'History of Immunization Narrative' }],
    },
    text: {
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>No hay datos de vacunación disponibles</p></div>',
    },
    emptyReason: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/list-empty-reason', code: 'unavailable', display: 'Unavailable' }],
    },
  });

  // Conditions section
  composition.section!.push({
    title: 'Problemas',
    code: {
      coding: [{ system: AR_SYSTEMS.LOINC, code: LOINC_CODES.CONDITIONS, display: 'Problem list - Reported' }],
    },
    text: {
      status: 'generated',
      div: input.conditions.length > 0
        ? '<div xmlns="http://www.w3.org/1999/xhtml"><p>Ver recursos adjuntos</p></div>'
        : '<div xmlns="http://www.w3.org/1999/xhtml"><p>No se registran antecedentes patológicos</p></div>',
    },
    ...(input.conditions.length > 0
      ? { entry: makeEntryReferences(input.conditions) }
      : {
        emptyReason: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/list-empty-reason', code: 'nilknown', display: 'Nil Known' }],
        },
      }),
  });

  // Medications section
  composition.section!.push({
    title: 'Medicación',
    code: {
      coding: [{ system: AR_SYSTEMS.LOINC, code: LOINC_CODES.MEDICATIONS, display: 'History of Medication use Narrative' }],
    },
    text: {
      status: 'generated',
      div: input.medications.length > 0
        ? '<div xmlns="http://www.w3.org/1999/xhtml"><p>Ver recursos adjuntos</p></div>'
        : '<div xmlns="http://www.w3.org/1999/xhtml"><p>No se registra medicación</p></div>',
    },
    ...(input.medications.length > 0
      ? { entry: makeEntryReferences(input.medications) }
      : {
        emptyReason: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/list-empty-reason', code: 'nilknown', display: 'Nil Known' }],
        },
      }),
  });

  // Allergies section
  composition.section!.push({
    title: 'Alergias e Intolerancias',
    code: {
      coding: [{ system: AR_SYSTEMS.LOINC, code: LOINC_CODES.ALLERGIES, display: 'Allergies and adverse reactions Document' }],
    },
    text: {
      status: 'generated',
      div: input.allergies.length > 0
        ? '<div xmlns="http://www.w3.org/1999/xhtml"><p>Ver recursos adjuntos</p></div>'
        : '<div xmlns="http://www.w3.org/1999/xhtml"><p>No se registran alergias</p></div>',
    },
    ...(input.allergies.length > 0
      ? { entry: makeEntryReferences(input.allergies) }
      : {
        emptyReason: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/list-empty-reason', code: 'nilknown', display: 'Nil Known' }],
        },
      }),
  });

  return composition;
}
