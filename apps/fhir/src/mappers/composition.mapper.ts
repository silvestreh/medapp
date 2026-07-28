import type { Composition, CompositionSection, Identifier } from '@medplum/fhirtypes';
import { v4 as uuidv4 } from 'uuid';
import { AR_SYSTEMS, LOINC_CODES } from '../utils/identifiers';
import { narrative } from '../utils/fhir-helpers';

interface FhirResource {
  resourceType: string;
  id?: string;
}

interface CompositionInput {
  patientId: string;
  // Composition-ar-ips-core forbids author/custodian references (0..0) and
  // requires logical identifiers instead: the author is the authoring
  // *institution* in the REFES namespace, and the custodian is the domain
  // registered with the national federator (federador.msal.gob.ar/uri).
  authorIdentifier: { system?: string; value: string };
  custodianIdentifier: { system?: string; value: string };
  conditions: FhirResource[];
  allergies: FhirResource[];
  medications: FhirResource[];
}

function toIdentifier(input: { system?: string; value: string }): Identifier {
  const identifier: Identifier = { value: input.value };
  if (input.system) identifier.system = input.system;
  return identifier;
}

// NOTE: coding.display is intentionally omitted from LOINC codings — the
// bundle language is es-AR and the terminology server rejects any display
// that isn't its canonical es-AR string. Section slicing matches on
// system+code only.
function buildSection(
  title: string,
  loincCode: string,
  resources: FhirResource[],
  emptyText: string,
  emptyReasonCode: 'nilknown' | 'unavailable' = 'nilknown'
): CompositionSection {
  const section: CompositionSection = {
    title,
    code: {
      coding: [{ system: AR_SYSTEMS.LOINC, code: loincCode }],
    },
    text: {
      status: 'generated',
      div: resources.length > 0
        ? '<div xmlns="http://www.w3.org/1999/xhtml"><p>Ver recursos adjuntos</p></div>'
        : `<div xmlns="http://www.w3.org/1999/xhtml"><p>${emptyText}</p></div>`,
    },
  };

  if (resources.length > 0) {
    section.entry = resources.map((r) => ({ reference: `${r.resourceType}/${r.id}` }));
  } else {
    section.emptyReason = {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/list-empty-reason', code: emptyReasonCode }],
    };
  }

  return section;
}

export function mapComposition(input: CompositionInput): Composition {
  const now = new Date().toISOString();

  return {
    resourceType: 'Composition',
    id: uuidv4(),
    meta: {
      profile: ['http://fhir.msal.gob.ar/core/StructureDefinition/Composition-ar-ips-core'],
    },
    language: 'es-AR',
    text: narrative('Resumen del Paciente (IPS Argentina)'),
    identifier: {
      system: 'urn:ietf:rfc:3986',
      value: `urn:uuid:${uuidv4()}`,
    },
    status: 'final',
    type: {
      coding: [{
        system: AR_SYSTEMS.LOINC,
        code: LOINC_CODES.PATIENT_SUMMARY,
      }],
      text: 'Resumen del paciente',
    },
    subject: {
      reference: `Patient/${input.patientId}`,
    },
    date: now,
    author: [{
      type: 'Organization',
      identifier: toIdentifier(input.authorIdentifier),
    }],
    title: 'Resumen del Paciente (IPS Argentina)',
    custodian: {
      type: 'Organization',
      identifier: toIdentifier(input.custodianIdentifier),
    },
    section: [
      // The Immunizations section keeps emptyReason: Immunization-ar-core
      // demands lotNumber/protocolApplied/location, so an absent-info
      // placeholder can never conform. There is no immunization data in
      // this system.
      buildSection('Inmunizaciones', LOINC_CODES.IMMUNIZATIONS, [], 'No hay datos de vacunación disponibles', 'unavailable'),
      buildSection('Problemas', LOINC_CODES.CONDITIONS, input.conditions, 'No se registran antecedentes patológicos'),
      buildSection('Medicación', LOINC_CODES.MEDICATIONS, input.medications, 'No se registra medicación'),
      buildSection('Alergias e Intolerancias', LOINC_CODES.ALLERGIES, input.allergies, 'No se registran alergias'),
    ],
  };
}
