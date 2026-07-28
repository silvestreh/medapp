import type { Extension, MedicationStatement } from '@medplum/fhirtypes';
import { IPS_ABSENT_UNKNOWN_SYSTEM } from '../utils/identifiers';
import { narrative } from '../utils/fhir-helpers';

interface MedicationHistoryInput {
  droga: string;
  ant_fecha: Date | null;
  efectivo: boolean | 'indeterminate';
  efecto_adverso: string;
  ant_comments: string;
}

interface PrescriptionMedicine {
  text: string;
  quantity?: string;
  posology?: string;
  medicationId?: string;
}

interface PrescriptionInput {
  id: string;
  content?: {
    diagnosis?: string;
    medicines?: PrescriptionMedicine[];
  };
  status: string;
  date?: string;
  medicId?: string;
}

interface MedicationContext {
  patientId: string;
  medicId: string;
  encounterId?: string;
  encounterDate?: string;
}

// MedicationStatement-uv-ips requires effective[x] (1..1). When no date is
// known we assert it explicitly with a data-absent-reason extension.
type MedicationStatementWithPrimitiveExt = MedicationStatement & {
  _effectiveDateTime?: { extension: Extension[] };
};

const DATA_ABSENT_UNKNOWN: Extension = {
  url: 'http://hl7.org/fhir/StructureDefinition/data-absent-reason',
  valueCode: 'unknown',
};

function setEffective(statement: MedicationStatementWithPrimitiveExt, date?: string | null) {
  if (date) {
    statement.effectiveDateTime = date;
  } else {
    statement._effectiveDateTime = { extension: [DATA_ABSENT_UNKNOWN] };
  }
}

function toDateString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().split('T')[0];
}

function mapEffectiveStatus(efectivo: boolean | 'indeterminate'): MedicationStatement['status'] {
  if (efectivo === true) return 'active';
  if (efectivo === false) return 'stopped';
  return 'unknown';
}

export function mapMedicationHistory(
  items: MedicationHistoryInput[],
  context: MedicationContext
): MedicationStatement[] {
  return items.map((item, index): MedicationStatement => {
    const statement: MedicationStatementWithPrimitiveExt = {
      resourceType: 'MedicationStatement',
      id: `${context.encounterId || 'unknown'}-medication-${index}`,
      meta: {
        profile: ['http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationStatement-uv-ips'],
      },
      text: narrative(`Medicación: ${item.droga}`),
      status: mapEffectiveStatus(item.efectivo),
      medicationCodeableConcept: {
        text: item.droga,
      },
      subject: {
        reference: `Patient/${context.patientId}`,
      },
      informationSource: {
        reference: `Practitioner/${context.medicId}`,
      },
    };

    setEffective(statement, toDateString(item.ant_fecha) || toDateString(context.encounterDate));

    const notes: string[] = [];
    if (item.efecto_adverso) notes.push(`Efecto adverso: ${item.efecto_adverso}`);
    if (item.ant_comments) notes.push(item.ant_comments);
    if (notes.length > 0) {
      statement.note = [{ text: notes.join('. ') }];
    }

    return statement;
  });
}

export function mapPrescriptionMedications(
  prescriptions: PrescriptionInput[],
  context: MedicationContext
): MedicationStatement[] {
  const statements: MedicationStatement[] = [];

  for (const rx of prescriptions) {
    const medicines = rx.content?.medicines || [];
    for (let i = 0; i < medicines.length; i++) {
      const med = medicines[i];
      if (!med.text || med.text.trim() === '') continue;

      const statement: MedicationStatementWithPrimitiveExt = {
        resourceType: 'MedicationStatement',
        id: `prescription-${rx.id}-med-${i}`,
        meta: {
          profile: ['http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationStatement-uv-ips'],
        },
        text: narrative(`Medicación: ${med.text}`),
        status: rx.status === 'completed' ? 'completed' : rx.status === 'cancelled' ? 'stopped' : 'active',
        medicationCodeableConcept: {
          text: med.text,
        },
        subject: {
          reference: `Patient/${context.patientId}`,
        },
        informationSource: {
          reference: `Practitioner/${rx.medicId || context.medicId}`,
        },
      };

      setEffective(statement, toDateString(rx.date));

      if (med.posology) {
        statement.dosage = [{ text: med.posology }];
      }

      statements.push(statement);
    }
  }

  return statements;
}

// IPS placeholder for patients with no recorded medication.
export function mapNoKnownMedications(patientId: string): MedicationStatement {
  const statement: MedicationStatementWithPrimitiveExt = {
    resourceType: 'MedicationStatement',
    id: `${patientId}-no-known-medications`,
    meta: {
      profile: ['http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationStatement-uv-ips'],
    },
    text: narrative('No se registra medicación'),
    status: 'unknown',
    medicationCodeableConcept: {
      coding: [{
        system: IPS_ABSENT_UNKNOWN_SYSTEM,
        code: 'no-known-medications',
        display: 'No known medications',
      }],
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
  };
  setEffective(statement);
  return statement;
}
