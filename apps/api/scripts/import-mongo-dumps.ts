import fs from 'fs/promises';
import path from 'path';
import cliProgress from 'cli-progress';
import dayjs from 'dayjs';
import { omit, startCase } from 'lodash';

import app from '../src/app';
import { normalizeCity, provinceToISO, normalizePhoneNumber, normalizeMaritalStatus, transformSchedule, getCountry } from './utils';
import { resetDatabase } from './reset-db';

interface MongoID {
  $oid: string;
}

interface MongoTimestamp {
  $numberLong: string;
}

interface MongoDate {
  $date: string;
}

interface PersonalData {
  id?: string;
  dob_year?: string;
  dob_month?: string;
  dob_day?: string;
  marital_status?: string | null;
  document_value?: string;
  document_type?: string;
  nationality?: string;
  last_name?: string;
  first_name?: string;
}

interface ContactData {
  email?: string;
  phone_number?: string;
  phone_type?: string;
  province?: string;
  city?: string;
  street_address?: string;
}

interface DailySchedule {
  [key: string]: {
    end: string;
    start: string;
  };
}

interface MongoUser {
  _id: MongoID;
  username?: string;
  bf_password?: string;
  personal_data?: PersonalData;
  contact_data?: ContactData;
  country_license?: string;
  medical_specialty?: string;
  national_license_number?: string;
  schedule_all_shifts?: DailySchedule;
  schedule_all_week_custom_time?: boolean;
  schedule_all_week_end_time?: string;
  schedule_all_week_shift_duration?: number;
  schedule_all_week_start_time?: string;
  schedule_friday?: boolean;
  schedule_monday?: boolean;
  schedule_saturday?: boolean;
  schedule_sunday?: boolean;
  schedule_thursday?: boolean;
  schedule_tuesday?: boolean;
  schedule_wednesday?: boolean;
  state_license?: string;
  state_license_number?: string;
  __class?: 'Medic' | 'Receptionist' | 'SuperUser';
}

interface MongoAppointment {
  _id: MongoID;
  patient_id: string;
  medic_id: string;
  receptionist_id: string;
  start_timestamp: MongoTimestamp;
  extra?: boolean;
}

interface MongoEncounter {
  _id: MongoID;
  medic_id: string;
  patient_id: string;
  timestamp: MongoTimestamp;
  datas: {
    [key: string]: any;
  };
}

interface MongoPatient {
  _id: MongoID;
  personal_data: PersonalData;
  mugshot: string;
  contact_data: ContactData;
  medicare: string;
  medicare_number: string;
  medicare_plan: string;
  deleted: boolean;
}

interface SkippedAppointment extends MongoAppointment {
  reason: string;
}

interface SkippedEncounter extends MongoEncounter {
  reason: string;
}

interface MongoStudyPatient {
  medicare: string;
  dni: string;
  last_name: string;
  first_name: string;
  id: string;
  value: string;
  label: string;
}

interface MongoStudy {
  _id: MongoID;
  date: MongoDate;
  protocol: number;
  noOrder: boolean;
  medic: string;
  studies: {
    [key: string]: boolean;
  };
  patient: MongoStudyPatient;
  results: MongoID[];
}

interface MongoStudyResult {
  _id: MongoID;
  study: MongoID;
  type: string;
  data: {
    [key: string]: string;
  };
}

interface SkippedStudy extends MongoStudy {
  reason: string;
}

interface SkippedStudyResult extends MongoStudyResult {
  reason: string;
}

async function seedData() {
  console.log('Seeding data...');

  const roles = JSON.parse(
    await fs.readFile(path.join(__dirname, './seeds/roles.json'), 'utf-8')
  );

  const rolesService = app.service('roles');

  for (const role of roles) {
    await rolesService.create(role);
  }
}

async function importData() {
  try {
    // Read and parse JSON files
    const users: MongoUser[] = JSON.parse(
      await fs.readFile(path.join(__dirname, './dumps/user.json'), 'utf-8')
    );
    const appointments: MongoAppointment[] = JSON.parse(
      await fs.readFile(path.join(__dirname, './dumps/appointment.json'), 'utf-8')
    );
    const encounters: MongoEncounter[] = JSON.parse(
      await fs.readFile(path.join(__dirname, './dumps/encounter.json'), 'utf-8')
    );
    const patients: MongoPatient[] = JSON.parse(
      await fs.readFile(path.join(__dirname, './dumps/patient.json'), 'utf-8')
    );
    const studies: MongoStudy[] = JSON.parse(
      await fs.readFile(path.join(__dirname, './dumps/studies.json'), 'utf-8')
    );
    const studyResults: MongoStudyResult[] = JSON.parse(
      await fs.readFile(path.join(__dirname, './dumps/results.json'), 'utf-8')
    );

    const multibar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: '{bar} | {percentage}% | {value}/{total} | {title}',
    }, cliProgress.Presets.shades_classic);

    // Create progress bars for each entity type
    const userBar = multibar.create(users.length, 0, { title: 'Users' });
    const patientBar = multibar.create(patients.length, 0, { title: 'Patients' });
    const encounterBar = multibar.create(encounters.length, 0, { title: 'Encounters' });
    const appointmentBar = multibar.create(appointments.length, 0, { title: 'Appointments' });
    const studyBar = multibar.create(studies.length, 0, { title: 'Studies' });
    const studyResultBar = multibar.create(studyResults.length, 0, { title: 'Study Results' });

    // Get services
    const usersService = app.service('users');
    const personalDataService = app.service('personal-data');
    const patientPersonalDataService = app.service('patient-personal-data');
    // const patientContactDataService = app.service('patient-contact-data');
    const mdSettingsService = app.service('md-settings');
    const appointmentsService = app.service('appointments');
    const encountersService = app.service('encounters');
    const patientsService = app.service('patients');
    const studiesService = app.service('studies');
    const studyResultsService = app.service('study-results');

    const validUserIds = new Set<string>();
    const validPatientIds = new Set<string>();
    const mongoToRealPatientId = new Map<string, string>();
    const validStudyIds = new Set<string>();
    const validStudyResultIds = new Set<string>();
    const invalidTimestamps = new Set<any>();
    const patientIdsWithEncounters = new Set<string>();
    const skippedAppointments: SkippedAppointment[] = [];
    const skippedEncounters: SkippedEncounter[] = [];
    const skippedStudies: SkippedStudy[] = [];
    const skippedStudyResults: SkippedStudyResult[] = [];
    const cleanedUpPatients = new Set<string>();
    const juancaId = '540dc81947771d1f3f8b4567';
    let weirdUserId;

    // Import users
    for (const user of users) {
      if (!user.username) {
        weirdUserId = user._id.$oid;
      }

      const birthDate = dayjs(`${user.personal_data?.dob_year}-${user.personal_data?.dob_month}-${user.personal_data?.dob_day}`);

      await usersService.create({
        id: user._id.$oid,
        username: user.username ?? 'weird_user',
        password: 'retrete',
        roleId: user.__class === 'SuperUser' ? 'admin' : user.__class === 'Receptionist' ? 'receptionist' : 'medic',
        personalData: Object.keys(user.personal_data || {}).length > 0
          ? {
            firstName: startCase(user.personal_data?.first_name?.toLowerCase?.()),
            lastName: startCase(user.personal_data?.last_name?.toLowerCase?.()),
            nationality: user.personal_data?.nationality ? getCountry(user.personal_data.nationality) : 'AR',
            documentType: user.personal_data?.document_type,
            documentValue: user.personal_data?.document_value || user._id.$oid,
            maritalStatus: normalizeMaritalStatus(user.personal_data?.marital_status),
            birthDate: birthDate.isValid() ? birthDate.toDate() : null,
          }
          : undefined,
        contactData: Object.keys(user.contact_data || {}).length > 0
          ? {
            streetAddress: user.contact_data?.street_address,
            city: normalizeCity(user.contact_data?.city),
            province: provinceToISO(user.contact_data?.province),
            country: user.contact_data?.city === 'aysen' ? 'CL' : 'AR',
            phoneNumber: normalizePhoneNumber(user.contact_data?.phone_number),
            email: user.contact_data?.email,
          }
          : undefined,
      });

      validUserIds.add(user._id.$oid);

      if (user.__class === 'Medic') {
        await mdSettingsService.create({
          userId: user._id.$oid,
          medicalSpecialty: user.medical_specialty,
          nationalLicenseNumber: user.national_license_number,
          stateLicense: user.state_license,
          stateLicenseNumber: user.state_license_number,
          ...transformSchedule(user),
        });
      }

      userBar.increment();
    }

    // Import patients
    for (const patient of patients) {
      const birthDate = dayjs(`${patient.personal_data?.dob_year}-${patient.personal_data?.dob_month}-${patient.personal_data?.dob_day}`);
      const city = normalizeCity(patient.contact_data.city);
      const documentValue = patient.personal_data.document_value || patient._id.$oid;

      // Check if we already have a patient with this personal data
      const existingPersonalData = await personalDataService.find({
        query: {
          documentValue,
          $limit: 1
        },
        paginate: false
      }) as any[];

      if (existingPersonalData.length > 0) {
        const pdId = existingPersonalData[0].id;
        const patientLink = await patientPersonalDataService.find({
          query: { personalDataId: pdId, $limit: 1 },
          paginate: false
        }) as any[];

        if (patientLink.length > 0) {
          const existingPatientId = patientLink[0].ownerId;
          mongoToRealPatientId.set(patient._id.$oid, existingPatientId);
          patientBar.increment();
          continue;
        }
      }

      const newPatient = await patientsService.create({
        id: patient._id.$oid,
        medicare: patient.medicare,
        medicareNumber: patient.medicare_number,
        medicarePlan: patient.medicare_plan,
        deleted: Boolean(patient.deleted),
        personalData: Object.keys(patient.personal_data || {}).length > 0
          ? {
            firstName: startCase(patient.personal_data.first_name?.toLowerCase?.()),
            lastName: startCase(patient.personal_data.last_name?.toLowerCase?.()),
            nationality: patient.personal_data.nationality ? getCountry(patient.personal_data.nationality) : 'AR',
            documentType: patient.personal_data.document_type,
            documentValue,
            maritalStatus: normalizeMaritalStatus(patient.personal_data.marital_status),
            birthDate: birthDate.isValid() ? birthDate.toDate() : null,
          }
          : undefined,
        contactData: Object.keys(patient.contact_data || {}).length > 0
          ? {
            streetAddress: patient.contact_data.street_address,
            city,
            province: city === 'aysen' ? null : provinceToISO(patient.contact_data.province),
            country: city === 'aysen' ? 'CL' : 'AR',
            phoneNumber: normalizePhoneNumber(patient.contact_data.phone_number),
            email: patient.contact_data.email,
          }
          : undefined,
      }) as any;

      validPatientIds.add(newPatient.id);
      mongoToRealPatientId.set(patient._id.$oid, newPatient.id);

      patientBar.increment();
    }

    // Import encounters
    for (const encounter of encounters) {
      if (!validUserIds.has(encounter.medic_id)) {
        skippedEncounters.push({ ...encounter, reason: 'missing_medic_reference' });
        encounterBar.increment();
        continue;
      }

      const realPatientId = mongoToRealPatientId.get(encounter.patient_id);
      if (!realPatientId) {
        skippedEncounters.push({ ...encounter, reason: 'missing_patient_reference' });
        encounterBar.increment();
        continue;
      }

      const timestamp = encounter.timestamp.$numberLong ? Number(encounter.timestamp.$numberLong) : Number(encounter.timestamp);

      if (isNaN(timestamp)) {
        skippedEncounters.push({ ...encounter, reason: 'invalid_timestamp' });
        invalidTimestamps.add(encounter.timestamp);
        encounterBar.increment();
        continue;
      }

      try {
        await encountersService.create({
          data: omit(encounter.datas, '__class') || {},
          date: dayjs.unix(timestamp).toDate(),
          medicId: encounter.medic_id === weirdUserId ? juancaId : encounter.medic_id,
          patientId: realPatientId
        });

        patientIdsWithEncounters.add(realPatientId);
      } catch (error: any) {
        skippedEncounters.push({ ...encounter, reason: error?.message });
      }

      encounterBar.increment();
    }

    // Import appointments
    for (const appointment of appointments) {
      if (!validUserIds.has(appointment.medic_id)) {
        skippedAppointments.push({ ...appointment, reason: 'missing_medic_reference' });
        appointmentBar.increment();
        continue;
      }

      const realPatientId = mongoToRealPatientId.get(appointment.patient_id);
      if (!realPatientId) {
        skippedAppointments.push({ ...appointment, reason: 'missing_patient_reference' });
        appointmentBar.increment();
        continue;
      }

      const timestamp = appointment.start_timestamp.$numberLong ? Number(appointment.start_timestamp.$numberLong) : Number(appointment.start_timestamp);

      if (isNaN(timestamp)) {
        skippedAppointments.push({ ...appointment, reason: 'invalid_timestamp' });
        invalidTimestamps.add(appointment.start_timestamp);
        appointmentBar.increment();
        continue;
      }

      if (!patientIdsWithEncounters.has(realPatientId)) {
        skippedAppointments.push({ ...appointment, reason: 'patient_without_encounters' });
        appointmentBar.increment();
        continue;
      }

      const startDate = dayjs.unix(timestamp);

      if (startDate.isBefore(dayjs().subtract(6, 'months'))) {
        skippedAppointments.push({ ...appointment, reason: 'appointment_too_old' });
        appointmentBar.increment();
        continue;
      }

      await appointmentsService.create({
        patientId: realPatientId,
        medicId: appointment.medic_id,
        startDate: startDate.toDate(),
        extra: Boolean(appointment.extra),
      });

      appointmentBar.increment();
    }

    // Import studies
    for (const study of studies) {
      let patient: any;
      let patientId: string | null = null;

      // Step 1: Try to find existing patient
      if (study.patient.id) {
        try {
          patient = await patientsService.get(study.patient.id);
          patientId = study.patient.id;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          // Patient ID exists but is invalid - log this case
          // console.warn(`Invalid patient ID reference: ${study.patient.id}`);
        }
      }

      // Step 2: Try to find by DNI if no patient yet
      if (!patient && study.patient.dni) {
        try {
          const [personalData] = (await personalDataService.find({
            query: { documentValue: study.patient.dni },
            paginate: false
          })) as unknown as PersonalData[];

          if (personalData) {
            const { ownerId } = await patientPersonalDataService.get(personalData.id as string);
            patient = await patientsService.get(ownerId);
            patientId = ownerId as string;
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error: any) {
          // console.warn(`Error looking up patient by DNI: ${study.patient.dni}`);
        }
      }

      // Step 3: Create new patient if not found
      if (!patient) {
        try {
          const documentValue = study.patient.dni;
          const existingPersonalData = await personalDataService.find({
            query: {
              documentValue,
              $limit: 1
            },
            paginate: false
          }) as any[];

          if (existingPersonalData.length > 0) {
            const pdId = existingPersonalData[0].id;
            const patientLink = await patientPersonalDataService.find({
              query: { personalDataId: pdId, $limit: 1 },
              paginate: false
            }) as any[];

            if (patientLink.length > 0) {
              patientId = patientLink[0].ownerId;
            }
          }

          if (!patientId) {
            const newPatient = await patientsService.create({
              medicare: study.patient.medicare || null,
              deleted: false,
              personalData: {
                firstName: study.patient.first_name,
                lastName: study.patient.last_name,
                documentValue: study.patient.dni, // Add DNI if available
              }
            }) as any;

            patientId = newPatient.id;
            validPatientIds.add(newPatient.id);
          }
        } catch (error: any) {
          console.error(`Failed to create new patient: ${error?.message}`);
          skippedStudies.push({ ...study, reason: 'failed_to_create_patient' });
          studyBar.increment();
          continue;
        }
      }

      // Step 4: Create the study with correct patient reference
      if (!patientId) {
        skippedStudies.push({ ...study, reason: 'no_valid_patient_reference' });
        studyBar.increment();
        continue;
      }

      try {
        await studiesService.create({
          id: study._id.$oid,
          date: dayjs(study.date.$date).toDate(),
          protocol: study.protocol,
          studies: Object.keys(study.studies).filter(key => study.studies[key]),
          noOrder: study.noOrder,
          medicId: juancaId, // Juan Carlos Herrera
          patientId,
        });

        validStudyIds.add(study._id.$oid);
      } catch (error: any) {
        skippedStudies.push({ ...study, reason: error?.message });
      }

      studyBar.increment();
    }

    // Import study results
    for (const studyResult of studyResults) {
      if (!validStudyIds.has(studyResult.study.$oid)) {
        skippedStudyResults.push({ ...studyResult, reason: 'missing_study_reference' });
        studyResultBar.increment();
        continue;
      }

      try {
        await studiesService.get(studyResult.study.$oid);
      } catch (error: any) {
        skippedStudyResults.push({ ...studyResult, reason: error?.message });
        studyResultBar.increment();
        continue;
      }

      await studyResultsService.create({
        id: studyResult._id.$oid,
        data: JSON.stringify(omit(studyResult.data, '__class')),
        studyId: studyResult.study.$oid,
        type: studyResult.type,
      });

      validStudyResultIds.add(studyResult._id.$oid);
      studyResultBar.increment();
    }

    // const cleanupBar = multibar.create(validPatientIds.size, 0, { title: 'Cleanup' });

    // for (const patientId of validPatientIds) {
    //   const patientEncounters = await encountersService.find({ query: { patientId }, paginate: false });
    //   const patientAppointments = await appointmentsService.find({ query: { patientId }, paginate: false });
    //   const patientStudies = await studiesService.find({ query: { patientId }, paginate: false });

    //   if (patientEncounters.length === 0 && patientAppointments.length === 0 && patientStudies.length === 0) {
    //     try {
    //       // First delete personal data
    //       const personalData = await patientPersonalDataService.find({
    //         query: { ownerId: patientId },
    //         paginate: false
    //       });
    //       const contactData = await patientContactDataService.find({
    //         query: { ownerId: patientId },
    //         paginate: false
    //       });

    //       for (const pd of personalData) {
    //         await patientPersonalDataService.remove(pd.id);
    //       }

    //       for (const cd of contactData) {
    //         await patientContactDataService.remove(cd.id);
    //       }

    //       // Then delete the patient
    //       await patientsService.remove(patientId);
    //       cleanedUpPatients.add(patientId);
    //     } catch (error: any) {
    //       if (error.name !== 'NotFound') {
    //         console.error(`Failed to cleanup patient ${patientId}:`, error);
    //       }
    //     }
    //   }

    //   cleanupBar.increment();
    // }

    multibar.stop();
    console.log('Import completed!');
    if (skippedAppointments.length > 0) {
      console.log(`Skipped ${skippedAppointments.length} appointments due to missing medic references`);
    }
    if (skippedEncounters.length > 0) {
      console.log(`Skipped ${skippedEncounters.length} encounters due to missing medic references`);
    }
    if (invalidTimestamps.size > 0) {
      console.log(`Skipped ${invalidTimestamps.size} appointments and encounters due to invalid timestamps`);
      console.log(Array.from(invalidTimestamps));
    }
    console.log('Imported users:', validUserIds.size, 'out of', users.length);
    console.log('Imported patients:', validPatientIds.size, 'out of', patients.length);
    console.log('Imported appointments:', appointments.length - skippedAppointments.length, 'out of', appointments.length);
    console.log('Imported encounters:', encounters.length - skippedEncounters.length, 'out of', encounters.length);
    console.log('Imported studies:', validStudyIds.size, 'out of', studies.length);
    console.log('Imported study results:', validStudyResultIds.size, 'out of', studyResults.length);
    console.log('Cleaned up patients:', cleanedUpPatients.size, 'out of', validPatientIds.size);

    // Write skipped data to error files
    await fs.mkdir(path.join(__dirname, './errors'), { recursive: true });

    if (skippedAppointments.length > 0) {
      await fs.writeFile(
        path.join(__dirname, './errors/appointments.json'),
        JSON.stringify(skippedAppointments, null, 2)
      );
    }

    if (skippedEncounters.length > 0) {
      await fs.writeFile(
        path.join(__dirname, './errors/encounters.json'),
        JSON.stringify(skippedEncounters, null, 2)
      );
    }

    if (skippedStudies.length > 0) {
      await fs.writeFile(
        path.join(__dirname, './errors/studies.json'),
        JSON.stringify(skippedStudies, null, 2)
      );
    }

    if (skippedStudyResults.length > 0) {
      await fs.writeFile(
        path.join(__dirname, './errors/study-results.json'),
        JSON.stringify(skippedStudyResults, null, 2)
      );
    }
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the import
(async () => {
  await resetDatabase();
  await seedData();
  await importData();
})();
