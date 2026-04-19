export * from './types';
export * from './adapters';
export * from './study-types';
export * from './fieldset-types';
export * from './fieldset-utils';
export * from './custom-form-types';

import type { EncounterSchema, EncounterFormAdapter } from './types';
import type { StudySchema } from './study-types';

import evolution from './schemas/evolution.json';
import reasonForConsultation from './schemas/reason-for-consultation.json';
import currentIllness from './schemas/current-illness.json';
import personalHistory from './schemas/personal-history.json';
import drugAllergy from './schemas/drug-allergy.json';
import familyHistory from './schemas/family-history.json';
import medicationHistory from './schemas/medication-history.json';
import housingHistory from './schemas/housing-history.json';
import generalAllergy from './schemas/general-allergy.json';
import asthma from './schemas/asthma.json';
import cardiology from './schemas/cardiology.json';
import habits from './schemas/habits.json';
import occupationalHistory from './schemas/occupational-history.json';

import {
  evolutionAdapter,
  reasonForConsultationAdapter,
  currentIllnessAdapter,
  personalHistoryAdapter,
  drugAllergyAdapter,
  familyHistoryAdapter,
  medicationHistoryAdapter,
  housingHistoryAdapter,
  generalAllergyAdapter,
  asthmaAdapter,
  cardiologyAdapter,
  habitsAdapter,
  occupationalHistoryAdapter,
} from './adapters';

export {
  evolution,
  reasonForConsultation,
  currentIllness,
  personalHistory,
  drugAllergy,
  familyHistory,
  medicationHistory,
  housingHistory,
  generalAllergy,
  asthma,
  cardiology,
  habits,
  occupationalHistory,
};

export interface EncounterFormDefinition {
  schema: EncounterSchema;
  adapter: EncounterFormAdapter;
}

export const FORM_KEY_ORDER = [
  'general/consulta_internacion',
  'general/enfermedad_actual',
  'antecedentes/familiares',
  'antecedentes/habitacionales',
  'antecedentes/personales',
  'antecedentes/habitos',
  'antecedentes/medicamentosos',
  'antecedentes/ocupacionales',
  'alergias/general',
  'alergias/medicamentos',
  'alergias/asma',
  'cardiologia/general',
  'general/evolucion_consulta_internacion',
] as const;

// ---------------------------------------------------------------------------
// Study schemas
// ---------------------------------------------------------------------------

import studyAnemia from './study-schemas/anemia.json';
import studyAnticoagulation from './study-schemas/anticoagulation.json';
import studyCompatibility from './study-schemas/compatibility.json';
import studyHemostasis from './study-schemas/hemostasis.json';
import studyMyelogram from './study-schemas/myelogram.json';
import studyThrombophilia from './study-schemas/thrombophilia.json';

export {
  studyAnemia,
  studyAnticoagulation,
  studyCompatibility,
  studyHemostasis,
  studyMyelogram,
  studyThrombophilia,
};

export const studySchemas: Record<string, StudySchema> = {
  anemia: studyAnemia as StudySchema,
  anticoagulation: studyAnticoagulation as StudySchema,
  compatibility: studyCompatibility as StudySchema,
  hemostasis: studyHemostasis as StudySchema,
  myelogram: studyMyelogram as StudySchema,
  thrombophilia: studyThrombophilia as StudySchema,
};

// ---------------------------------------------------------------------------
// Encounter form definitions
// ---------------------------------------------------------------------------

export const encounterForms: Record<string, EncounterFormDefinition> = {
  'general/consulta_internacion': {
    schema: reasonForConsultation as EncounterSchema,
    adapter: reasonForConsultationAdapter,
  },
  'general/enfermedad_actual': {
    schema: currentIllness as EncounterSchema,
    adapter: currentIllnessAdapter,
  },
  'antecedentes/familiares': {
    schema: familyHistory as EncounterSchema,
    adapter: familyHistoryAdapter,
  },
  'antecedentes/habitacionales': {
    schema: housingHistory as EncounterSchema,
    adapter: housingHistoryAdapter,
  },
  'antecedentes/personales': {
    schema: personalHistory as EncounterSchema,
    adapter: personalHistoryAdapter,
  },
  'antecedentes/habitos': {
    schema: habits as EncounterSchema,
    adapter: habitsAdapter,
  },
  'antecedentes/medicamentosos': {
    schema: medicationHistory as EncounterSchema,
    adapter: medicationHistoryAdapter,
  },
  'antecedentes/ocupacionales': {
    schema: occupationalHistory as EncounterSchema,
    adapter: occupationalHistoryAdapter,
  },
  'alergias/general': {
    schema: generalAllergy as EncounterSchema,
    adapter: generalAllergyAdapter,
  },
  'alergias/medicamentos': {
    schema: drugAllergy as EncounterSchema,
    adapter: drugAllergyAdapter,
  },
  'alergias/asma': {
    schema: asthma as EncounterSchema,
    adapter: asthmaAdapter,
  },
  'cardiologia/general': {
    schema: cardiology as EncounterSchema,
    adapter: cardiologyAdapter,
  },
  'general/evolucion_consulta_internacion': {
    schema: evolution as EncounterSchema,
    adapter: evolutionAdapter,
  },
};
