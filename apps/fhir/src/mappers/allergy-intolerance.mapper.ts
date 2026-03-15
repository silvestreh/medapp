import type { AllergyIntolerance } from '@medplum/fhirtypes';

interface DrugAllergyInput {
  drug: string;
  status: string;
}

interface AllergyContext {
  encounterId: string;
  patientId: string;
  medicId: string;
}

const ALLERGEN_FIELD_LABELS: Record<string, { display: string; category: AllergyIntolerance['category'] }> = {
  al_alimentos: { display: 'Alimentos', category: ['food'] },
  al_acaros: { display: 'Ácaros', category: ['environment'] },
  al_animales: { display: 'Animales', category: ['environment'] },
  al_insectos_venenos: { display: 'Insectos/Venenos', category: ['environment'] },
  al_mohos: { display: 'Mohos', category: ['environment'] },
  al_parasitos: { display: 'Parásitos', category: ['biologic'] },
  al_polen_arboles: { display: 'Polen de árboles', category: ['environment'] },
  al_polen_gramineas: { display: 'Polen de gramíneas', category: ['environment'] },
  al_otros: { display: 'Otros', category: ['environment'] },
};

function mapVerificationStatus(status: string) {
  const normalized = status.toLowerCase().trim();
  if (normalized === 'confirmado' || normalized === 'confirmed') {
    return {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }],
    };
  }
  return {
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'unconfirmed' }],
  };
}

export function mapDrugAllergies(
  entries: DrugAllergyInput[],
  context: AllergyContext
): AllergyIntolerance[] {
  return entries.map((entry, index): AllergyIntolerance => ({
    resourceType: 'AllergyIntolerance',
    id: `${context.encounterId}-drug-allergy-${index}`,
    meta: {
      profile: ['http://hl7.org/fhir/uv/ips/StructureDefinition/AllergyIntolerance-uv-ips'],
    },
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }],
    },
    verificationStatus: mapVerificationStatus(entry.status),
    type: 'allergy',
    category: ['medication'],
    code: {
      text: entry.drug,
    },
    patient: {
      reference: `Patient/${context.patientId}`,
    },
    recorder: {
      reference: `Practitioner/${context.medicId}`,
    },
  }));
}

export function mapGeneralAllergies(
  allergens: Record<string, string>,
  context: AllergyContext
): AllergyIntolerance[] {
  let index = 0;
  return Object.entries(allergens).map(([field, value]): AllergyIntolerance => {
    const meta = ALLERGEN_FIELD_LABELS[field] || { display: field, category: ['environment'] as AllergyIntolerance['category'] };
    return {
      resourceType: 'AllergyIntolerance',
      id: `${context.encounterId}-general-allergy-${index++}`,
      meta: {
        profile: ['http://hl7.org/fhir/uv/ips/StructureDefinition/AllergyIntolerance-uv-ips'],
      },
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }],
      },
      verificationStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'unconfirmed' }],
      },
      type: 'allergy',
      category: meta.category,
      code: {
        text: `${meta.display}: ${value}`,
      },
      patient: {
        reference: `Patient/${context.patientId}`,
      },
      recorder: {
        reference: `Practitioner/${context.medicId}`,
      },
    };
  });
}
