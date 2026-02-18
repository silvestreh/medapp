import type cliProgress from 'cli-progress';
import dayjs from 'dayjs';
import { startCase } from 'lodash';
import {
  normalizeNameWithLLM,
  normalizeCity,
  provinceToISO,
  normalizePhoneNumber,
  normalizeMaritalStatus,
  getCountry,
} from '../utils';
import type {
  MongoPatient,
  MongoEncounter,
  MongoStudy,
  ProcessingStats,
  SeedPatient,
  SeedPersonalData,
  SeedContactData,
} from './types';

interface ProcessPatientsOptions {
  patients: MongoPatient[];
  encounters: MongoEncounter[];
  studies: MongoStudy[];
  skipLLM: boolean;
  bar: cliProgress.SingleBar;
}

interface ProcessPatientsResult {
  patients: SeedPatient[];
  keptPatientIds: Set<string>;
  stats: ProcessingStats;
}

export function transformPatientToSeed(patient: MongoPatient): SeedPatient {
  const patientId = patient._id.$oid;

  let personalData: SeedPersonalData | undefined;
  if (patient.personal_data && Object.keys(patient.personal_data).length > 0) {
    const birthDate = dayjs(
      `${patient.personal_data.dob_year}-${patient.personal_data.dob_month}-${patient.personal_data.dob_day}`,
    );
    const city = normalizeCity(patient.contact_data?.city);

    personalData = {
      firstName: patient.personal_data.first_name
        ? startCase(patient.personal_data.first_name.toLowerCase())
        : undefined,
      lastName: patient.personal_data.last_name
        ? startCase(patient.personal_data.last_name.toLowerCase())
        : undefined,
      nationality: patient.personal_data.nationality
        ? getCountry(patient.personal_data.nationality) || 'AR'
        : 'AR',
      documentType: patient.personal_data.document_type,
      documentValue: patient.personal_data.document_value || patientId,
      maritalStatus: normalizeMaritalStatus(patient.personal_data.marital_status),
      birthDate: birthDate.isValid() ? birthDate.toISOString() : null,
    };
  }

  let contactData: SeedContactData | undefined;
  if (patient.contact_data && Object.keys(patient.contact_data).length > 0) {
    const city = normalizeCity(patient.contact_data.city);
    contactData = {
      streetAddress: patient.contact_data.street_address,
      city,
      province: city === 'aysen' ? null : provinceToISO(patient.contact_data.province),
      country: city === 'aysen' ? 'CL' : 'AR',
      phoneNumber: normalizePhoneNumber(patient.contact_data.phone_number),
      email: patient.contact_data.email,
    };
  }

  return {
    id: patientId,
    medicare: patient.medicare,
    medicareNumber: patient.medicare_number,
    medicarePlan: patient.medicare_plan,
    deleted: Boolean(patient.deleted),
    personalData,
    contactData,
  };
}

export async function processPatients({
  patients,
  encounters,
  studies,
  skipLLM,
  bar,
}: ProcessPatientsOptions): Promise<ProcessPatientsResult> {
  const stats: ProcessingStats = {
    total: patients.length,
    kept: 0,
    discarded: 0,
    reasons: {},
  };

  const patientIdsWithEncounters = new Set(encounters.map(e => e.patient_id));

  const patientIdsWithStudies = new Set<string>();
  const dniToPatientId = new Map<string, string>();

  for (const patient of patients) {
    const dni = patient.personal_data?.document_value;
    if (dni) {
      dniToPatientId.set(dni, patient._id.$oid);
    }
  }

  for (const study of studies) {
    if (study.patient?.id) {
      patientIdsWithStudies.add(study.patient.id);
    }
    if (study.patient?.dni) {
      const matchedId = dniToPatientId.get(study.patient.dni);
      if (matchedId) {
        patientIdsWithStudies.add(matchedId);
      }
    }
  }

  const seedPatients: SeedPatient[] = [];
  const keptPatientIds = new Set<string>();

  for (const patient of patients) {
    const patientId = patient._id.$oid;
    const hasEncounters = patientIdsWithEncounters.has(patientId);
    const hasStudies = patientIdsWithStudies.has(patientId);

    if (!hasEncounters && !hasStudies) {
      stats.discarded++;
      stats.reasons['no_encounters_or_studies'] = (stats.reasons['no_encounters_or_studies'] || 0) + 1;
      bar.increment();
      continue;
    }

    // Clean names via LLM then transform
    let firstName = patient.personal_data?.first_name;
    let lastName = patient.personal_data?.last_name;

    if (skipLLM) {
      if (firstName) firstName = startCase(firstName.toLowerCase());
      if (lastName) lastName = startCase(lastName.toLowerCase());
    } else {
      const cleanedFirst = await normalizeNameWithLLM(firstName);
      if (cleanedFirst) firstName = startCase(cleanedFirst.toLowerCase());
      const cleanedLast = await normalizeNameWithLLM(lastName);
      if (cleanedLast) lastName = startCase(cleanedLast.toLowerCase());
    }

    // Build the seed with the cleaned names
    const patientWithCleanNames: MongoPatient = {
      ...patient,
      mugshot: '',
      personal_data: {
        ...patient.personal_data,
        first_name: firstName,
        last_name: lastName,
      },
    };

    seedPatients.push(transformPatientToSeed(patientWithCleanNames));
    keptPatientIds.add(patientId);
    bar.increment();
  }

  stats.kept = seedPatients.length;

  return { patients: seedPatients, keptPatientIds, stats };
}
