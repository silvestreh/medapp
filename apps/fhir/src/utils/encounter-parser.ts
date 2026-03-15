import {
  personalHistoryAdapter,
  drugAllergyAdapter,
  generalAllergyAdapter,
  medicationHistoryAdapter,
} from '@athelas/encounter-schemas';

interface LegacyFormData {
  type: string;
  values: Record<string, string>;
}

export interface ParsedEncounterData {
  raw: Record<string, LegacyFormData>;
  conditions: { issueId: string; date: Date | null; description: string }[];
  drugAllergies: { drug: string; status: string }[];
  generalAllergies: Record<string, string>;
  medications: {
    droga: string;
    ant_fecha: Date | null;
    efectivo: boolean | 'indeterminate';
    efecto_adverso: string;
    ant_comments: string;
  }[];
}

function safeParse(value: unknown): Record<string, LegacyFormData> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, LegacyFormData>;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return {};
}

export function parseEncounterData(data: unknown): ParsedEncounterData {
  const raw = safeParse(data);

  // Personal history → Conditions (ICD-10)
  const personalHistoryForm = raw['antecedentes/personales'];
  const personalHistory = personalHistoryAdapter.fromLegacy(personalHistoryForm);
  const conditions = (personalHistory.items || [])
    .filter((item: { issueId: string }) => item.issueId && item.issueId.trim() !== '');

  // Drug allergies
  const drugAllergyForm = raw['alergias/medicamentos'];
  const drugAllergyData = drugAllergyAdapter.fromLegacy(drugAllergyForm);
  const drugAllergies = (drugAllergyData.entries || [])
    .filter((entry: { drug: string }) => entry.drug && entry.drug.trim() !== '');

  // General allergies (text fields with allergen categories)
  const generalAllergyForm = raw['alergias/general'];
  const generalAllergyData = generalAllergyAdapter.fromLegacy(generalAllergyForm);
  const generalAllergies: Record<string, string> = {};
  const allergenFields = [
    'al_alimentos', 'al_acaros', 'al_animales', 'al_insectos_venenos',
    'al_mohos', 'al_parasitos', 'al_polen_arboles', 'al_polen_gramineas', 'al_otros',
  ];
  for (const field of allergenFields) {
    const val = generalAllergyData[field];
    if (val && typeof val === 'string' && val.trim() !== '') {
      generalAllergies[field] = val;
    }
  }

  // Medication history
  const medicationForm = raw['antecedentes/medicamentosos'];
  const medicationData = medicationHistoryAdapter.fromLegacy(medicationForm);
  const medications = (medicationData.medications || [])
    .filter((med: { droga: string }) => med.droga && med.droga.trim() !== '');

  return {
    raw,
    conditions,
    drugAllergies,
    generalAllergies,
    medications,
  };
}
