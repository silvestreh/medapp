import type { MedicationStatement } from '@medplum/fhirtypes';

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
}

interface MedicationContext {
  patientId: string;
  medicId: string;
  encounterId?: string;
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
    const statement: MedicationStatement = {
      resourceType: 'MedicationStatement',
      id: `${context.encounterId || 'unknown'}-medication-${index}`,
      meta: {
        profile: ['http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationStatement-uv-ips'],
      },
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

    if (item.ant_fecha) {
      statement.effectiveDateTime = item.ant_fecha.toISOString().split('T')[0];
    }

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

      const statement: MedicationStatement = {
        resourceType: 'MedicationStatement',
        id: `prescription-${rx.id}-med-${i}`,
        meta: {
          profile: ['http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationStatement-uv-ips'],
        },
        status: rx.status === 'completed' ? 'completed' : rx.status === 'cancelled' ? 'stopped' : 'active',
        medicationCodeableConcept: {
          text: med.text,
        },
        subject: {
          reference: `Patient/${context.patientId}`,
        },
        informationSource: {
          reference: `Practitioner/${context.medicId}`,
        },
      };

      if (med.posology) {
        statement.dosage = [{ text: med.posology }];
      }

      statements.push(statement);
    }
  }

  return statements;
}
