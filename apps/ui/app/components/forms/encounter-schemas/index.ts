import type { EncounterSchema, EncounterFormAdapter } from '../encounter-form-types';
import evolution from './evolution.json';
import reasonForConsultation from './reason-for-consultation.json';
import currentIllness from './current-illness.json';
import personalHistory from './personal-history.json';
import drugAllergy from './drug-allergy.json';
import familyHistory from './family-history.json';
import medicationHistory from './medication-history.json';
import housingHistory from './housing-history.json';
import generalAllergy from './general-allergy.json';
import asthma from './asthma.json';
import cardiology from './cardiology.json';
import habits from './habits.json';
import occupationalHistory from './occupational-history.json';

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
} from '../encounter-form-adapters';

export interface EncounterFormDefinition {
  schema: EncounterSchema;
  adapter: EncounterFormAdapter;
}

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
