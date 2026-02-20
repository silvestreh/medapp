import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { EncounterFormAdapter, EncounterFormValues } from './encounter-form-types';

dayjs.extend(customParseFormat);

function parseTriState(val?: string): boolean | 'indeterminate' {
  if (val === 'si' || val === 'on') return true;
  if (val === 'no' || val === 'off') return false;
  return 'indeterminate';
}

function triStateToString(val: boolean | 'indeterminate'): string {
  if (val === true) return 'si';
  if (val === false) return 'no';
  return '';
}

function flatTriStateLegacy(
  values: EncounterFormValues,
  formKey: string
): { type: string; values: Record<string, string> } {
  const legacy: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'boolean') {
      legacy[key] = value ? 'si' : 'no';
    } else if (value === 'indeterminate') {
      legacy[key] = '';
    } else if (value instanceof Date) {
      legacy[key] = value.toISOString();
    } else if (value != null && value !== '') {
      legacy[key] = String(value);
    }
  }
  return { type: formKey, values: legacy };
}

// ---------------------------------------------------------------------------
// Evolution
// ---------------------------------------------------------------------------

export const evolutionAdapter: EncounterFormAdapter = {
  fromLegacy(data) {
    return {
      evo_descripcion: data?.values?.evo_descripcion || '',
    };
  },
  toLegacy(values) {
    return {
      type: 'general/evolucion_consulta_internacion',
      values: { evo_descripcion: values.evo_descripcion || '' },
    };
  },
};

// ---------------------------------------------------------------------------
// Reason for Consultation
// ---------------------------------------------------------------------------

export const reasonForConsultationAdapter: EncounterFormAdapter = {
  fromLegacy(data) {
    const values = data?.values || {};
    const count = parseInt(values.consulta_intern_count || '0', 10);
    const reasons: { reason: string; description: string }[] = [];

    for (let i = 0; i < count; i++) {
      reasons.push({
        reason: values[`motivo_text_${i}`] || '',
        description: values[`motivo_descripcion_${i}`] || '',
      });
    }

    return {
      reasons: reasons.length > 0 ? reasons : [{ reason: '', description: '' }],
    };
  },
  toLegacy(values) {
    const reasons: { reason: string; description: string }[] = values.reasons || [];
    const resultValues: Record<string, string> = {
      consulta_intern_count: reasons.length.toString(),
    };

    reasons.forEach((item, index) => {
      resultValues[`motivo_text_${index}`] = item.reason;
      resultValues[`motivo_descripcion_${index}`] = item.description;
    });

    return { type: 'general/consulta_internacion', values: resultValues };
  },
};

// ---------------------------------------------------------------------------
// Current Illness
// ---------------------------------------------------------------------------

export const currentIllnessAdapter: EncounterFormAdapter = {
  fromLegacy(data) {
    const values = data?.values || {};
    const count = parseInt(values.sintoma_count || '0', 10);
    const symptoms: { symptom: string }[] = [];

    for (let i = 0; i < count; i++) {
      symptoms.push({ symptom: values[`sintoma_${i}`] || '' });
    }

    return {
      symptoms,
      notas_ap_resp: values.notas_ap_resp || '',
      notas_ap_cardio: values.notas_ap_cardio || '',
      notas_ap_digest: values.notas_ap_digest || '',
      notas_ap_uro: values.notas_ap_uro || '',
      notas_ap_loco: values.notas_ap_loco || '',
      notas_piel: values.notas_piel || '',
      notas_otro: values.notas_otro || '',
    };
  },
  toLegacy(values) {
    const symptoms: { symptom: string }[] = values.symptoms || [];
    const resultValues: Record<string, string> = {
      sintoma_count: symptoms.length.toString(),
      sintoma: symptoms[0]?.symptom || '',
      notas_ap_resp: values.notas_ap_resp || '',
      notas_ap_cardio: values.notas_ap_cardio || '',
      notas_ap_digest: values.notas_ap_digest || '',
      notas_ap_uro: values.notas_ap_uro || '',
      notas_ap_loco: values.notas_ap_loco || '',
      notas_piel: values.notas_piel || '',
      notas_otro: values.notas_otro || '',
    };

    symptoms.forEach((s, i) => {
      resultValues[`sintoma_${i}`] = s.symptom;
    });

    return { type: 'general/enfermedad_actual', values: resultValues };
  },
};

// ---------------------------------------------------------------------------
// Personal History
// ---------------------------------------------------------------------------

export const personalHistoryAdapter: EncounterFormAdapter = {
  fromLegacy(data) {
    const values = data?.values || {};
    const count = parseInt(values.antecedente_count || '0', 10);
    const items: { issueId: string; date: Date | null; description: string }[] = [];

    for (let i = 0; i < count; i++) {
      const dateStr = values[`fecha_antecedente_${i}`];
      const parsed = dateStr ? dayjs(dateStr, 'DD/MM/YYYY') : null;
      items.push({
        issueId: values[`antecedente_${i}`] || '',
        date: parsed?.isValid() ? parsed.toDate() : null,
        description: values[`antecedente_descripcion_${i}`] || '',
      });
    }

    return {
      items: items.length > 0 ? items : [{ issueId: '', date: null, description: '' }],
    };
  },
  toLegacy(values) {
    const items: { issueId: string; date: Date | null; description: string }[] = values.items || [];
    const resultValues: Record<string, string> = {
      antecedente_count: items.length.toString(),
    };

    items.forEach((item, index) => {
      resultValues[`antecedente_${index}`] = item.issueId;
      resultValues[`fecha_antecedente_${index}`] = item.date ? dayjs(item.date).format('DD/MM/YYYY') : '';
      resultValues[`antecedente_descripcion_${index}`] = item.description;
    });

    return { type: 'antecedentes/personales', values: resultValues };
  },
};

// ---------------------------------------------------------------------------
// Drug Allergy
// ---------------------------------------------------------------------------

export const drugAllergyAdapter: EncounterFormAdapter = {
  fromLegacy(data) {
    const values = data?.values || {};
    const count = parseInt(values.al_m_count || '0', 10);
    const entries: { drug: string; status: string }[] = [];

    for (let i = 0; i < count; i++) {
      entries.push({
        drug: values[`al_m_droga_${i}`] || '',
        status: values[`al_m_estado_${i}`] || '',
      });
    }

    return {
      entries: entries.length > 0 ? entries : [{ drug: '', status: '' }],
    };
  },
  toLegacy(values) {
    const entries: { drug: string; status: string }[] = values.entries || [];
    const resultValues: Record<string, string> = {
      al_m_count: entries.length.toString(),
    };

    entries.forEach((entry, i) => {
      resultValues[`al_m_droga_${i}`] = entry.drug;
      resultValues[`al_m_estado_${i}`] = entry.status;
    });

    return { type: 'alergias/medicamentos', values: resultValues };
  },
};

// ---------------------------------------------------------------------------
// Family History
// ---------------------------------------------------------------------------

const RELATIONSHIP_MAP: Record<string, string> = {
  paternal_grandfather: 'Abuelo paterno',
  maternal_grandfather: 'Abuelo materno',
  paternal_grandmother: 'Abuela paterna',
  maternal_grandmother: 'Abuela materna',
  father: 'Padre',
  mother: 'Madre',
  uncle: 'Tío',
  aunt: 'Tía',
  brother: 'Hermano',
  sister: 'Hermana',
  son: 'Hijo',
  daughter: 'Hija',
};

const REVERSE_RELATIONSHIP_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(RELATIONSHIP_MAP).map(([k, v]) => [v, k])
);

export const familyHistoryAdapter: EncounterFormAdapter = {
  fromLegacy(data) {
    const values = data?.values || {};
    const relationships = (values.fam_table_parentesco as unknown as string[]) || [];
    const firstNames = (values.fam_table_nombre as unknown as string[]) || [];
    const lastNames = (values.fam_table_apellido as unknown as string[]) || [];
    const aliveStatuses = (values.fam_table_vive as unknown as string[]) || [];
    const issuesJson = (values.fam_table_json_antecedentes as unknown as string[]) || [];

    const items = relationships.map((rel, i) => {
      const relationshipValue = REVERSE_RELATIONSHIP_MAP[rel] || rel;

      let issueId: string[] = [];
      try {
        const parsed = JSON.parse(issuesJson[i] || '[]');
        issueId = Array.isArray(parsed) ? parsed : [];
      } catch {
        /* empty */
      }

      let isAlive: boolean | 'indeterminate' = 'indeterminate';
      const alive = aliveStatuses[i]?.toLowerCase();
      if (alive === 'si' || alive === 'sí') isAlive = true;
      else if (alive === 'no') isAlive = false;

      return {
        relationship: relationshipValue,
        isAlive,
        firstName: firstNames[i] || '',
        lastName: lastNames[i] || '',
        issueId,
      };
    });

    return {
      items:
        items.length > 0
          ? items
          : [
              {
                relationship: '',
                isAlive: 'indeterminate' as const,
                firstName: '',
                lastName: '',
                issueId: [] as string[],
              },
            ],
    };
  },
  toLegacy(values) {
    const items: any[] = values.items || [];
    const resultValues = {
      fam_table_parentesco: items.map((item: any) => RELATIONSHIP_MAP[item.relationship] || item.relationship),
      fam_table_nombre: items.map((item: any) => item.firstName),
      fam_table_apellido: items.map((item: any) => item.lastName),
      fam_table_vive: items.map((item: any) => {
        if (item.isAlive === true) return 'si';
        if (item.isAlive === false) return 'no';
        return '';
      }),
      fam_table_json_antecedentes: items.map((item: any) =>
        JSON.stringify(Array.isArray(item.issueId) ? item.issueId : [])
      ),
    };

    return { type: 'antecedentes/familiares', values: resultValues as any };
  },
};

// ---------------------------------------------------------------------------
// Housing History
// ---------------------------------------------------------------------------

export const housingHistoryAdapter: EncounterFormAdapter = {
  fromLegacy(data) {
    const values = data?.values || {};
    const result: EncounterFormValues = {};

    const triStateFields = [
      'aberturas_puertas',
      'aberturas_ventanas',
      'sanitarios',
      'electricidad',
      'electricidad_segura',
      'electricidad_legal',
      'equip_cocina',
      'equip_tel_linea',
      'equip_tel_celular',
      'equip_lavarropas',
      'equip_antena_satelital',
      'equip_internet',
      'equip_automovil',
      'equip_moto',
      'alfombras',
      'colchonlanamas4',
      'almohadamas2',
      'cortinadosgruesos',
      'empapelado',
      'biblioteca',
      'peluche',
      'rellenos',
      'frazadas',
      'mascotas',
      'cucarachas',
      'zona_chagas',
    ];

    const textFields = [
      'cohabita_con',
      'ambientes',
      'tipo_piso',
      'tipo_pared',
      'tipo_techo',
      'humedad',
      'ventilacion',
      'tipo_agua',
      'canerias',
      'tipo_cloacas',
      'tipo_gas',
      'estufas',
      'equip_heladera',
      'equip_televisor',
    ];

    for (const key of triStateFields) {
      result[key] = parseTriState(values[key]);
    }
    for (const key of textFields) {
      result[key] = values[key] || '';
    }

    return result;
  },
  toLegacy(values) {
    return flatTriStateLegacy(values, 'antecedentes/habitacionales');
  },
};

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

export const habitsAdapter: EncounterFormAdapter = {
  fromLegacy(data) {
    const values = data?.values || {};

    const triStateFields = [
      'dieta_toggle',
      'dieta_baja_sodio',
      'dieta_baja_calorias',
      'dieta_baja_hidratos',
      'dieta_baja_grasas',
      'alcohol_cerveza',
      'alcohol_vino',
      'alcohol_whisky',
      'alcohol_otras',
      'fuma_toggle',
      'infusiones_te',
      'infusiones_cafe',
      'infusiones_mate',
      'infusiones_hierbas',
      'infusiones_otras',
      'exposolar_laboral',
      'exposolar_proteccion_toggle',
      'exposolar_proteccion_horario',
      'exposolar_proteccion_sombraropa',
      'exposolar_proteccion_cremas',
    ];

    const textFields = [
      'alimentacion_cantidad',
      'alimentacion_calidad',
      'dieta_cumple',
      'alcohol',
      'fuma_cantidad',
      'infusiones',
      'sal',
      'actividad_fisica',
      'trabajo_tipo',
      'trabajo_continuidad',
      'trabajo_educacion',
      'trabajo_actividad_social',
      'actividad_sexual',
      'sexo_parejas',
      'adicciones_cocaina_inhalatoria',
      'adicciones_cocaina_endovenosas',
      'adicciones_marihuana',
      'adicciones_notas_adicionales',
      'exposolar_recreacional',
    ];

    const result: EncounterFormValues = {};

    for (const key of triStateFields) {
      result[key] = parseTriState(values[key]);
    }
    for (const key of textFields) {
      result[key] = values[key] || '';
    }

    result.fuma_desde = values.fuma_desde ? dayjs(values.fuma_desde, ['YYYY', 'DD/MM/YYYY']).toDate() : null;
    result.fuma_hasta = values.fuma_hasta ? dayjs(values.fuma_hasta, ['YYYY', 'DD/MM/YYYY']).toDate() : null;

    return result;
  },
  toLegacy(values) {
    const legacy: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'boolean') {
        legacy[key] = value ? 'si' : 'no';
      } else if (value === 'indeterminate') {
        legacy[key] = '';
      } else if (value instanceof Date) {
        legacy[key] = dayjs(value).format(key === 'fuma_desde' ? 'YYYY' : 'DD/MM/YYYY');
      } else if (value != null && value !== '') {
        legacy[key] = String(value);
      }
    }
    return { type: 'antecedentes/habitos', values: legacy };
  },
};

// ---------------------------------------------------------------------------
// Medication History
// ---------------------------------------------------------------------------

export const medicationHistoryAdapter: EncounterFormAdapter = {
  fromLegacy(data) {
    const values = data?.values || {};
    const count = parseInt(values.ant_med_count || '0', 10);
    const medications: any[] = [];

    for (let i = 0; i < count; i++) {
      const dateStr = values[`ant_fecha_${i}`];
      medications.push({
        droga: values[`droga_${i}`] || '',
        ant_fecha: dateStr ? new Date(dateStr) : null,
        efectivo: parseTriState(values[`efectivo_${i}`]),
        efecto_adverso: values[`efecto_adverso_${i}`] || '',
        ant_comments: values[`ant_comments_${i}`] || '',
      });
    }

    return {
      medications:
        medications.length > 0
          ? medications
          : [{ droga: '', ant_fecha: null, efectivo: 'indeterminate', efecto_adverso: '', ant_comments: '' }],
    };
  },
  toLegacy(values) {
    const medications: any[] = values.medications || [];
    const resultValues: Record<string, string> = {
      ant_med_count: medications.length.toString(),
    };

    medications.forEach((med: any, i: number) => {
      resultValues[`droga_${i}`] = med.droga;
      resultValues[`ant_fecha_${i}`] = med.ant_fecha ? med.ant_fecha.toISOString() : '';
      resultValues[`efectivo_${i}`] = triStateToString(med.efectivo);
      resultValues[`efecto_adverso_${i}`] = med.efecto_adverso;
      resultValues[`ant_comments_${i}`] = med.ant_comments;
    });

    return { type: 'antecedentes/medicamentosos', values: resultValues };
  },
};

// ---------------------------------------------------------------------------
// Occupational History
// ---------------------------------------------------------------------------

const OCC_SECTIONS = [
  'minas',
  'piedra',
  'abrasivos',
  'fundicion',
  'ceramica',
  'cementos',
  'polvo',
  'pigmentos',
  'vidrio',
  'mantos',
  'const',
  'refue',
  'fuego',
  'textil',
  'naval',
  'acusticos',
  'forros',
  'embrague',
  'empaque',
  'gases',
  'polvos',
  'rurales',
  'asma',
  'otras',
];

const OCC_TOP_TOGGLES = ['toggle_inha_polvos', 'toggle_asbesto'];

export const occupationalHistoryAdapter: EncounterFormAdapter = {
  fromLegacy(data) {
    const values = data?.values || {};
    const result: EncounterFormValues = {};

    for (const t of OCC_TOP_TOGGLES) {
      result[t] = parseTriState(values[t]);
    }

    for (const section of OCC_SECTIONS) {
      result[`toggle_${section}`] = parseTriState(values[`toggle_${section}`]);
      result[`${section}_desde`] = values[`${section}_desde`] ? new Date(values[`${section}_desde`]) : null;
      result[`${section}_hasta`] = values[`${section}_hasta`] ? new Date(values[`${section}_hasta`]) : null;
      result[`${section}_comments`] = values[`${section}_comments`] || '';
    }

    return result;
  },
  toLegacy(values) {
    const legacy: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'boolean') {
        legacy[key] = value ? 'si' : 'no';
      } else if (value === 'indeterminate') {
        legacy[key] = '';
      } else if (value instanceof Date) {
        legacy[key] = value.toISOString();
      } else if (value != null && value !== '') {
        legacy[key] = String(value);
      }
    }
    return { type: 'antecedentes/ocupacionales', values: legacy };
  },
};

// ---------------------------------------------------------------------------
// General Allergy
// ---------------------------------------------------------------------------

export const generalAllergyAdapter: EncounterFormAdapter = {
  fromLegacy(data) {
    const values = data?.values || {};
    const result: EncounterFormValues = {};

    const triStateFields = [
      'prurito_nasal',
      'prurito_ocular',
      'prurito_otico',
      'prurito_palatino',
      'estornudos',
      'disnea',
      'sibilancias',
      'bloqueo_nasal',
      'prurito',
      'ronchas',
      'edema',
      'escamas',
      'loc_cara',
      'loc_cuello',
      'loc_tronco',
      'loc_miembros',
      'loc_generalizado',
      'des_polvo',
      'des_humo',
      'des_humedad',
      'des_cambio_temperatura',
      'des_mascotas',
      'primavera',
      'verano',
      'otono',
      'invierno',
      'inf_frio',
      'inf_humedad',
      'inf_viento',
      'inf_calor',
      'inf_tormenta',
    ];

    const textFields = [
      'secrecion_nasal',
      'tos',
      'al_alimentos',
      'al_acaros',
      'al_animales',
      'al_insectos_venenos',
      'al_mohos',
      'al_parasitos',
      'al_polen_arboles',
      'al_polen_gramineas',
      'al_otros',
    ];

    for (const key of triStateFields) {
      result[key] = parseTriState(values[key]);
    }
    for (const key of textFields) {
      result[key] = values[key] || '';
    }

    return result;
  },
  toLegacy(values) {
    return flatTriStateLegacy(values, 'alergias/general');
  },
};

// ---------------------------------------------------------------------------
// Asthma
// ---------------------------------------------------------------------------

export const asthmaAdapter: EncounterFormAdapter = {
  fromLegacy(data) {
    const values = data?.values || {};
    return {
      severidad_clinica: values.severidad_clinica || '',
      toggle_sintomas: parseTriState(values.toggle_sintomas),
      frecuencia_anual: values.frecuencia_anual || '',
      tipo_exacerbaciones: values.tipo_exacerbaciones || '',
      toggle_sintoma_nocturno: parseTriState(values.toggle_sintoma_nocturno),
      frecuencia_nocturna: values.frecuencia_nocturna || '',
      pef_teorico: values.pef_teorico || '',
      pef_variabilidad: values.pef_variabilidad || '',
      fev_teorico: values.fev_teorico || '',
      fev_reversibilidad: values.fev_reversibilidad || '',
    };
  },
  toLegacy(values) {
    return flatTriStateLegacy(values, 'alergias/asma');
  },
};

// ---------------------------------------------------------------------------
// Cardiology
// ---------------------------------------------------------------------------

export const cardiologyAdapter: EncounterFormAdapter = {
  fromLegacy(data) {
    const values = data?.values || {};

    const murmurs: any[] = [];
    const count = parseInt(values.soplo_count || '0', 10);
    for (let i = 0; i < count; i++) {
      murmurs.push({
        characteristic: values[`caracteristica_soplo_${i}`] || '',
        location: values[`localizacion_soplo_${i}`] || '',
        intensity: values[`intensidad_soplo_${i}`] || '',
      });
    }

    if (murmurs.length === 0) {
      murmurs.push({ characteristic: '', location: '', intensity: '' });
    }

    const textFields = [
      'tension_arterial_sistolica',
      'tension_arterial_diastolica',
      'pulso_radial_derecho',
      'pulso_radial_izquierdo',
      'pulso_femoral_derecho',
      'pulso_femoral_izquierdo',
      'pulso_tibial_posterior_derecho',
      'pulso_tibial_posterior_izquierdo',
      'pulso_pedio_derecho',
      'pulso_pedio_izquierdo',
      'pulso_carotideo_derecho',
      'pulso_carotideo_izquierdo',
      'choque_de_punta',
      'fremito',
      'auscultacion_r1',
      'auscultacion_r2',
      'auscultacion_r3',
      'auscultacion_r4',
      'caracteristica_auscultacion_cuello_derecho',
      'intensidad_auscultacion_cuello_derecho',
      'caracteristica_auscultacion_cuello_izquierdo',
      'intensidad_auscultacion_cuello_izquierdo',
    ];

    const result: EncounterFormValues = {};
    for (const key of textFields) {
      result[key] = values[key] || '';
    }
    result.murmurs = murmurs;

    return result;
  },
  toLegacy(values) {
    const legacy: Record<string, string> = {};
    const murmurs: any[] = values.murmurs || [];

    for (const [key, value] of Object.entries(values)) {
      if (key === 'murmurs') continue;
      if (typeof value === 'string') legacy[key] = value;
    }

    legacy.soplo_count = murmurs.length.toString();
    murmurs.forEach((m: any, i: number) => {
      legacy[`caracteristica_soplo_${i}`] = m.characteristic;
      legacy[`localizacion_soplo_${i}`] = m.location;
      legacy[`intensidad_soplo_${i}`] = m.intensity;
    });

    return { type: 'cardiologia/general', values: legacy };
  },
};
