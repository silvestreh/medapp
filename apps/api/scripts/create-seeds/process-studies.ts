import crypto from 'crypto';
import dayjs from 'dayjs';
import type cliProgress from 'cli-progress';
import type { MongoStudy, MongoPatient, ProcessingStats, SeedStudy, SeedPatient } from './types';
import { transformPatientToSeed } from './process-patients';

const JUANCA_ID = '540dc81947771d1f3f8b4567';
const DE_LOS_SANTOS_ID = '5549f38e75d036e0058b457a';
const LIPRERI_ID = '55c0c04975d036f44f8b45db';
const SORIA_ID = '5a71da3671302e8a638b4576';
const ALVAREZ_ID = '5ca5377671302ed70a8b458a';
const MAM_ID = '5818bc9a71302eb3768b472a';

interface ResolvedMedic {
  medicId: string | null;
  referringDoctor: string | null;
}

const OTHER_MEDICS = new Map<string, ResolvedMedic>([
  ['de los santos', { medicId: DE_LOS_SANTOS_ID, referringDoctor: 'De Los Santos' }],
  ['r. de los santos', { medicId: DE_LOS_SANTOS_ID, referringDoctor: 'De Los Santos' }],
  ['lipreri', { medicId: LIPRERI_ID, referringDoctor: 'Lipreri' }],
  ['soria o.', { medicId: SORIA_ID, referringDoctor: 'Soria O.' }],
  ['alvarez', { medicId: ALVAREZ_ID, referringDoctor: 'Alvarez' }],
  ['mam', { medicId: MAM_ID, referringDoctor: 'MAM' }],

  ['m.e. sirotinsky', { medicId: null, referringDoctor: 'M.E. Sirotinsky' }],
  ['sirotinsky', { medicId: null, referringDoctor: 'M.E. Sirotinsky' }],
  ['.m.e. sirotinsky', { medicId: null, referringDoctor: 'M.E. Sirotinsky' }],
  ['m. e. sirotinsky', { medicId: null, referringDoctor: 'M.E. Sirotinsky' }],
  ['mes', { medicId: null, referringDoctor: 'M.E. Sirotinsky' }],
  ['es', { medicId: null, referringDoctor: 'M.E. Sirotinsky' }],

  ['lutteral', { medicId: null, referringDoctor: 'Dra. Lutteral' }],
  ['dra. lutteral', { medicId: null, referringDoctor: 'Dra. Lutteral' }],

  ['canigia', { medicId: null, referringDoctor: 'Canigia Pilar' }],
  ['canigia pilar', { medicId: null, referringDoctor: 'Canigia Pilar' }],

  ['g. perez juarez', { medicId: null, referringDoctor: 'G. Perez Juarez' }],
  ['p. juarez', { medicId: null, referringDoctor: 'G. Perez Juarez' }],

  ['a. ambrosi', { medicId: null, referringDoctor: 'A. Ambrosi' }],
  ['cipriani hernan', { medicId: null, referringDoctor: 'Cipriani Hernan' }],
  ['tedesco nicolas', { medicId: null, referringDoctor: 'Tedesco Nicolas' }],
  ['pittaioli', { medicId: null, referringDoctor: 'Pittaioli' }],
  ['de sábato', { medicId: null, referringDoctor: 'De Sábato' }],
  ['zamboschi', { medicId: null, referringDoctor: 'Zamboschi' }],
  ['hzco', { medicId: null, referringDoctor: 'HZCO' }],
  ['rios part', { medicId: null, referringDoctor: 'Rios Part' }],
  ["d'assaro", { medicId: null, referringDoctor: "D'Assaro" }],
  ['goffredo', { medicId: null, referringDoctor: 'Goffredo' }],
  ['arizcuren', { medicId: null, referringDoctor: 'Arizcuren' }],
  ['gurevich', { medicId: null, referringDoctor: 'Gurevich' }],
  ['torres', { medicId: null, referringDoctor: 'Torres' }],
  ['dr. rappallini.', { medicId: null, referringDoctor: 'Dr. Rappallini' }],
  ['j. montalva', { medicId: null, referringDoctor: 'J. Montalva' }],
  ['dra. arrieta', { medicId: null, referringDoctor: 'Dra. Arrieta' }],
  ['pereyra', { medicId: null, referringDoctor: 'Pereyra' }],
  ['barreda', { medicId: null, referringDoctor: 'Barreda' }],
]);

export function resolveMedic(medic: string | undefined): ResolvedMedic {
  const raw = medic?.trim() || '';
  if (!raw) return { medicId: JUANCA_ID, referringDoctor: null };

  const normalized = raw.toLowerCase();
  const match = OTHER_MEDICS.get(normalized);
  if (match) return match;

  return { medicId: JUANCA_ID, referringDoctor: raw };
}

function generateObjectId(): string {
  return crypto.randomBytes(12).toString('hex');
}

interface ProcessStudiesOptions {
  studies: MongoStudy[];
  allPatients: MongoPatient[];
  keptPatientIds: Set<string>;
  bar: cliProgress.SingleBar;
}

interface DiscardedStudy extends MongoStudy {
  REASON: string;
}

interface ProcessStudiesResult {
  studies: SeedStudy[];
  discardedStudies: DiscardedStudy[];
  syntheticPatients: SeedPatient[];
  keptStudyIds: Set<string>;
  rescuedPatientIds: Set<string>;
  stats: ProcessingStats;
}

export function processStudies({
  studies,
  allPatients,
  keptPatientIds,
  bar,
}: ProcessStudiesOptions): ProcessStudiesResult {
  const stats: ProcessingStats = {
    total: studies.length,
    kept: 0,
    discarded: 0,
    reasons: {},
  };

  // Build DNI -> patient ID map from ALL patients (not just kept)
  const dniToPatientId = new Map<string, string>();
  const allPatientIds = new Set<string>();
  for (const patient of allPatients) {
    allPatientIds.add(patient._id.$oid);
    const dni = patient.personal_data?.document_value;
    if (dni) {
      dniToPatientId.set(dni, patient._id.$oid);
    }
  }

  // Build name -> patient ID map from ALL patients for name-based matching
  const nameToPatientId = new Map<string, string>();
  for (const patient of allPatients) {
    const first = patient.personal_data?.first_name?.trim().toLowerCase();
    const last = patient.personal_data?.last_name?.trim().toLowerCase();
    if (first && last) {
      nameToPatientId.set(`${first}|${last}`, patient._id.$oid);
    }
  }

  const kept: SeedStudy[] = [];
  const discardedStudies: DiscardedStudy[] = [];
  const keptStudyIds = new Set<string>();
  const rescuedPatientIds = new Set<string>();
  const syntheticPatients: SeedPatient[] = [];

  // Track synthetic patients we've already created by DNI/name to avoid duplicates
  const syntheticDniToId = new Map<string, string>();
  const syntheticNameToId = new Map<string, string>();

  for (const study of studies) {
    let patientId: string | null = null;
    let rescued = false;

    // Step 1: match by study.patient.id against kept patients
    if (study.patient?.id && keptPatientIds.has(study.patient.id)) {
      patientId = study.patient.id;
    }

    // Step 2: match by DNI against kept patients
    if (!patientId && study.patient?.dni) {
      const matchedId = dniToPatientId.get(study.patient.dni);
      if (matchedId && keptPatientIds.has(matchedId)) {
        patientId = matchedId;
      }
    }

    // Step 3: match by study.patient.id against ALL patients (rescue)
    if (!patientId && study.patient?.id && allPatientIds.has(study.patient.id)) {
      patientId = study.patient.id;
      rescued = true;
    }

    // Step 4: match by DNI against ALL patients (rescue)
    if (!patientId && study.patient?.dni) {
      const matchedId = dniToPatientId.get(study.patient.dni);
      if (matchedId) {
        patientId = matchedId;
        rescued = true;
      }
    }

    // Step 5: create a synthetic patient from embedded study.patient data (has DNI)
    if (!patientId && study.patient?.dni) {
      const existingSyntheticId = syntheticDniToId.get(study.patient.dni);
      if (existingSyntheticId) {
        patientId = existingSyntheticId;
      } else {
        const syntheticId = generateObjectId();
        const syntheticMongo: MongoPatient = {
          _id: { $oid: syntheticId },
          personal_data: {
            first_name: study.patient.first_name,
            last_name: study.patient.last_name,
            document_value: study.patient.dni,
            document_type: 'DNI',
          },
          contact_data: {},
          mugshot: '',
          medicare: study.patient.medicare || '',
          medicare_number: '',
          medicare_plan: '',
          deleted: false,
        };

        syntheticPatients.push(transformPatientToSeed(syntheticMongo));
        syntheticDniToId.set(study.patient.dni, syntheticId);
        dniToPatientId.set(study.patient.dni, syntheticId);
        allPatientIds.add(syntheticId);
        keptPatientIds.add(syntheticId);
        patientId = syntheticId;
        stats.reasons['synthetic_patient_created'] = (stats.reasons['synthetic_patient_created'] || 0) + 1;
      }
    }

    // Step 6: match by first_name + last_name against all patients
    if (!patientId && study.patient?.first_name && study.patient?.last_name) {
      const nameKey = `${study.patient.first_name.trim().toLowerCase()}|${study.patient.last_name.trim().toLowerCase()}`;
      const matchedId = nameToPatientId.get(nameKey);
      if (matchedId) {
        patientId = matchedId;
        if (!keptPatientIds.has(matchedId)) {
          rescued = true;
        }
        stats.reasons['matched_by_name'] = (stats.reasons['matched_by_name'] || 0) + 1;
      }
    }

    if (patientId && rescued) {
      rescuedPatientIds.add(patientId);
      keptPatientIds.add(patientId);
      stats.reasons['rescued_patient'] = (stats.reasons['rescued_patient'] || 0) + 1;
    }

    // Step 7: create/reuse a synthetic patient keyed by name
    if (!patientId) {
      const firstName = study.patient?.first_name?.trim() || 'Unknown';
      const lastName = study.patient?.last_name?.trim() || 'Unknown';
      const nameKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;

      const existingSyntheticId = syntheticNameToId.get(nameKey);
      if (existingSyntheticId) {
        patientId = existingSyntheticId;
      } else {
        const syntheticId = generateObjectId();
        const syntheticMongo: MongoPatient = {
          _id: { $oid: syntheticId },
          personal_data: {
            first_name: firstName,
            last_name: lastName,
            document_value: generateObjectId(),
            document_type: 'DNI',
          },
          contact_data: {},
          mugshot: '',
          medicare: study.patient?.medicare || '',
          medicare_number: '',
          medicare_plan: '',
          deleted: false,
        };

        syntheticPatients.push(transformPatientToSeed(syntheticMongo));
        syntheticNameToId.set(nameKey, syntheticId);
        allPatientIds.add(syntheticId);
        keptPatientIds.add(syntheticId);
        patientId = syntheticId;
        stats.reasons['synthetic_patient_no_dni'] = (stats.reasons['synthetic_patient_no_dni'] || 0) + 1;
      }
    }

    const { medicId, referringDoctor } = resolveMedic(study.medic);

    kept.push({
      id: study._id.$oid,
      date: dayjs(study.date.$date).toISOString(),
      protocol: study.protocol,
      studies: Object.keys(study.studies).filter(key => study.studies[key]),
      noOrder: study.noOrder,
      medicId,
      referringDoctor,
      patientId: patientId!,
    });

    keptStudyIds.add(study._id.$oid);
    bar.increment();
  }

  stats.kept = kept.length;

  return { studies: kept, discardedStudies, syntheticPatients, keptStudyIds, rescuedPatientIds, stats };
}
