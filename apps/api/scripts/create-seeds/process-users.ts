import type cliProgress from 'cli-progress';
import dayjs from 'dayjs';
import { startCase } from 'lodash';
import {
  normalizeNameWithLLM,
  normalizeCity,
  provinceToISO,
  normalizePhoneNumber,
  normalizeMaritalStatus,
  transformSchedule,
  getCountry,
} from '../utils';
import type {
  MongoUser,
  MongoEncounter,
  MongoStudy,
  ProcessingStats,
  SeedUser,
  SeedPersonalData,
  SeedContactData,
  SeedMdSettings,
} from './types';

interface ProcessUsersOptions {
  users: MongoUser[];
  encounters: MongoEncounter[];
  studies: MongoStudy[];
  skipLLM: boolean;
  bar: cliProgress.SingleBar;
}

interface ProcessUsersResult {
  users: SeedUser[];
  keptUserIds: Set<string>;
  weirdUserId: string | undefined;
  stats: ProcessingStats;
}

export async function processUsers({
  users,
  encounters,
  studies,
  skipLLM,
  bar,
}: ProcessUsersOptions): Promise<ProcessUsersResult> {
  const stats: ProcessingStats = {
    total: users.length,
    kept: 0,
    discarded: 0,
    reasons: {},
  };

  const medicIdsWithEncounters = new Set(encounters.map(e => e.medic_id));

  // All studies are attributed to JUANCA_ID during seed generation
  const JUANCA_ID = '540dc81947771d1f3f8b4567';
  const medicIdsWithStudies = new Set<string>(studies.length > 0 ? [JUANCA_ID] : []);

  const seedUsers: SeedUser[] = [];
  const keptUserIds = new Set<string>();
  let weirdUserId: string | undefined;

  for (const user of users) {
    const userId = user._id.$oid;
    const isReceptionist = user.__class === 'Receptionist';
    const isSuperUser = user.__class === 'SuperUser';

    if (!isReceptionist && !isSuperUser) {
      const hasEncounters = medicIdsWithEncounters.has(userId);
      const hasStudies = medicIdsWithStudies.has(userId);

      if (!hasEncounters && !hasStudies) {
        stats.discarded++;
        stats.reasons['medic_without_activity'] = (stats.reasons['medic_without_activity'] || 0) + 1;
        bar.increment();
        continue;
      }
    }

    if (!user.username) {
      weirdUserId = userId;
    }

    // Clean names
    let firstName = user.personal_data?.first_name;
    let lastName = user.personal_data?.last_name;

    if (skipLLM) {
      if (firstName) firstName = startCase(firstName.toLowerCase());
      if (lastName) lastName = startCase(lastName.toLowerCase());
    } else {
      const cleanedFirst = await normalizeNameWithLLM(firstName);
      if (cleanedFirst) firstName = startCase(cleanedFirst.toLowerCase());
      const cleanedLast = await normalizeNameWithLLM(lastName);
      if (cleanedLast) lastName = startCase(cleanedLast.toLowerCase());
    }

    // Build personalData
    let personalData: SeedPersonalData | undefined;
    if (user.personal_data && Object.keys(user.personal_data).length > 0) {
      const birthDate = dayjs(
        `${user.personal_data.dob_year}-${user.personal_data.dob_month}-${user.personal_data.dob_day}`,
      );
      personalData = {
        firstName,
        lastName,
        nationality: user.personal_data.nationality
          ? getCountry(user.personal_data.nationality) || 'AR'
          : 'AR',
        documentType: user.personal_data.document_type,
        documentValue: user.personal_data.document_value || userId,
        maritalStatus: normalizeMaritalStatus(user.personal_data.marital_status),
        birthDate: birthDate.isValid() ? birthDate.toISOString() : null,
      };
    }

    // Build contactData
    let contactData: SeedContactData | undefined;
    if (user.contact_data && Object.keys(user.contact_data).length > 0) {
      const city = normalizeCity(user.contact_data.city);
      contactData = {
        streetAddress: user.contact_data.street_address,
        city,
        province: provinceToISO(user.contact_data.province),
        country: user.contact_data.city === 'aysen' ? 'CL' : 'AR',
        phoneNumber: normalizePhoneNumber(user.contact_data.phone_number),
        email: user.contact_data.email,
      };
    }

    // Build mdSettings for Medics
    let mdSettings: SeedMdSettings | undefined;
    if (user.__class === 'Medic') {
      mdSettings = {
        userId,
        medicalSpecialty: user.medical_specialty,
        nationalLicenseNumber: user.national_license_number,
        stateLicense: user.state_license,
        stateLicenseNumber: user.state_license_number,
        ...transformSchedule(user),
      };
    }

    const roleId: SeedUser['roleId'] =
      user.__class === 'SuperUser'
        ? 'admin'
        : user.__class === 'Receptionist'
          ? 'receptionist'
          : 'medic';

    seedUsers.push({
      id: userId,
      username: user.username ?? 'weird_user',
      password: user.bf_password || 'retrete',
      roleId,
      personalData,
      contactData,
      mdSettings,
    });

    keptUserIds.add(userId);
    bar.increment();
  }

  stats.kept = seedUsers.length;

  return { users: seedUsers, keptUserIds, weirdUserId, stats };
}
