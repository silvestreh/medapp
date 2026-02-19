import type cliProgress from 'cli-progress';
import dayjs from 'dayjs';
import { startCase } from 'lodash';
import {
  normalizeCity,
  provinceToISO,
  normalizePhoneNumber,
  normalizeMaritalStatus,
  transformSchedule,
  getCountry,
} from '../utils';

function stripDoctorPrefix(name: string): string {
  return name.replace('Dr ', '').replace('Dra ', '');
}
import { resolveMedic } from './process-studies';
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
  bar,
}: ProcessUsersOptions): Promise<ProcessUsersResult> {
  const stats: ProcessingStats = {
    total: users.length,
    kept: 0,
    discarded: 0,
    reasons: {},
  };

  const medicIdsWithEncounters = new Set(encounters.map(e => e.medic_id));

  const medicIdsWithStudies = new Set<string>();
  for (const study of studies) {
    const { medicId } = resolveMedic(study.medic);
    if (medicId) {
      medicIdsWithStudies.add(medicId);
    }
  }

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

    // Clean names: strip Dr/Dra prefix and title-case
    let firstName = user.personal_data?.first_name;
    let lastName = user.personal_data?.last_name;
    if (firstName) firstName = startCase(stripDoctorPrefix(firstName).toLowerCase());
    if (lastName) lastName = startCase(stripDoctorPrefix(lastName).toLowerCase());

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

    const JUANCA_ID = '540dc81947771d1f3f8b4567';

    const roleId: SeedUser['roleId'] =
      user.__class === 'SuperUser'
        ? 'admin'
        : user.__class === 'Receptionist'
          ? 'receptionist'
          : 'medic';

    const additionalRoleIds = userId === JUANCA_ID ? ['lab-owner'] : undefined;

    seedUsers.push({
      id: userId,
      username: user.username ?? 'weird_user',
      password: user.bf_password || 'retrete',
      roleId,
      additionalRoleIds,
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
