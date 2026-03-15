import type { Condition } from '@medplum/fhirtypes';
import { AR_SYSTEMS } from '../utils/identifiers';

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
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: 'active',
      }],
    },
    code: {
      coding: [{
        system: AR_SYSTEMS.ICD10,
        code: input.issueId,
        display: icdLookup?.[input.issueId] || undefined,
      }],
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
