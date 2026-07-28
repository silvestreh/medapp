import type { Condition } from '@medplum/fhirtypes';
import { AR_SYSTEMS, IPS_ABSENT_UNKNOWN_SYSTEM } from '../utils/identifiers';
import { narrative } from '../utils/fhir-helpers';

interface ConditionInput {
  issueId: string;
  date: Date | null;
  description: string;
}

interface ConditionContext {
  encounterId: string;
  patientId: string;
  medicId: string;
  encounterDate: string;
}

export function mapCondition(
  input: ConditionInput,
  context: ConditionContext,
  index: number,
  icdLookup?: Record<string, string>
): Condition {
  const condition: Condition = {
    resourceType: 'Condition',
    id: `${context.encounterId}-condition-${index}`,
    meta: {
      profile: ['http://hl7.org/fhir/uv/ips/StructureDefinition/Condition-uv-ips'],
    },
    text: narrative(icdLookup?.[input.issueId] || `ICD-10 ${input.issueId}`),
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: 'active',
      }],
    },
    // The Spanish ICD-10 label goes in code.text — the terminology server
    // only accepts its own canonical display strings for coding.display.
    code: {
      coding: [{
        system: AR_SYSTEMS.ICD10,
        code: input.issueId,
      }],
      text: icdLookup?.[input.issueId] || undefined,
    },
    subject: {
      reference: `Patient/${context.patientId}`,
    },
    encounter: {
      reference: `Encounter/${context.encounterId}`,
    },
    recorder: {
      reference: `Practitioner/${context.medicId}`,
    },
  };

  if (input.date) {
    condition.onsetDateTime = input.date.toISOString().split('T')[0];
  }

  if (input.description) {
    condition.note = [{ text: input.description }];
  }

  return condition;
}

export function mapConditions(
  items: ConditionInput[],
  context: ConditionContext,
  icdLookup?: Record<string, string>
): Condition[] {
  return items.map((item, index) => mapCondition(item, context, index, icdLookup));
}

// IPS placeholder for patients with no recorded problems.
export function mapNoKnownProblems(patientId: string): Condition {
  return {
    resourceType: 'Condition',
    id: `${patientId}-no-known-problems`,
    meta: {
      profile: ['http://hl7.org/fhir/uv/ips/StructureDefinition/Condition-uv-ips'],
    },
    text: narrative('No se registran antecedentes patológicos'),
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: 'active',
      }],
    },
    code: {
      coding: [{
        system: IPS_ABSENT_UNKNOWN_SYSTEM,
        code: 'no-known-problems',
        display: 'No known problems',
      }],
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
  };
}
