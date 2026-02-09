import { es } from './es';

export const en: typeof es = {
  common: {
    welcome: 'Welcome',
    required: 'Required',
    optional: 'Optional',
    no_results: 'No results found',
  },
  forms: {
    'general/consulta_internacion': 'Reason for Consultation/Admission',
    'antecedentes/familiares': 'Family History',
    'antecedentes/habitacionales': 'Housing History',
    'antecedentes/medicamentosos': 'Medication History',
    'antecedentes/ocupacionales': 'Occupational History',
    'antecedentes/personales': 'Personal History',
    'antecedentes/habitos': 'Habits',
    'alergias/general': 'Allergy (general)',
    'alergias/medicamentos': 'Drug Allergy',
    'alergias/asma': 'Asthma',
    'cardiologia/general': 'Cardiology (general)',
    'general/enfermedad_actual': 'Current Illness',
    'general/evolucion_consulta_internacion': 'Evolution/Evaluation of Consultation-Admission',
    consulta_internacion_reason: 'Reason',
    consulta_internacion_description: 'Description',
    consulta_internacion_add: 'Add reason',
    consulta_internacion_placeholder_reason: 'Type to select a reason',
    consulta_internacion_placeholder_description: 'Description (optional)',
    consulta_internacion_title_item: 'Reason #{{index}}',
  },
};
