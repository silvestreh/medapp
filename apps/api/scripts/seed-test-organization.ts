/**
 * Standalone seed script: creates a second test organization ("Clínica del Sur")
 * with its own users, patients, encounters, and studies.
 *
 * This script is independent from the main import-seeds pipeline and is designed
 * to be run AFTER the main seed has completed (so that roles, ICD-10, etc. exist).
 *
 * Usage:
 *   npx ts-node scripts/seed-test-organization.ts
 *
 * Add --reset-passwords to set all user passwords to "retrete".
 */

import { faker } from '@faker-js/faker/locale/es_MX';
import { Sequelize, QueryTypes } from 'sequelize';
import app from '../src/app';

const ORG_NAME = 'Clínica del Sur';
const ORG_SLUG = 'clinica-del-sur';

const PATIENT_COUNT = 25;
const ENCOUNTER_COUNT = 60;
const STUDY_COUNT = 15;

const resetPasswords = process.argv.includes('--reset-passwords');

// ── helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDni(): string {
  return String(faker.number.int({ min: 10_000_000, max: 99_999_999 }));
}

const STUDY_TYPES = [
  'anemia', 'anticoagulation', 'compatibility', 'hemostasis', 'myelogram', 'thrombophilia',
];

const MEDICAL_SPECIALTIES = [
  'Clínica Médica',
  'Cardiología',
  'Dermatología',
  'Pediatría',
  'Traumatología',
];

const CONSULTATION_REASONS = [
  'Control de rutina',
  'Dolor torácico',
  'Cefalea recurrente',
  'Dolor abdominal',
  'Fiebre persistente',
  'Tos crónica',
  'Mareos y vértigo',
  'Control post-quirúrgico',
  'Dolor lumbar',
  'Hipertensión arterial',
  'Fatiga crónica',
  'Erupción cutánea',
  'Control de diabetes',
  'Dificultad respiratoria',
  'Dolor articular',
];

const EVOLUTION_NOTES = [
  'Paciente evoluciona favorablemente. Se mantiene esquema terapéutico actual.',
  'Se ajusta medicación por hipertensión. Control en 15 días.',
  'Sin cambios significativos. Se solicitan estudios complementarios.',
  'Mejoría clínica notable. Se reduce dosis de analgésicos.',
  'Paciente refiere persistencia de síntomas. Se deriva a especialista.',
  'Examen físico sin particularidades. Se continúa con plan actual.',
  'Se indica reposo relativo y antiinflamatorios. Control en una semana.',
  'Resultados de laboratorio dentro de parámetros normales. Alta médica.',
];

const PERSONAL_HISTORY = [
  'Hipertensión arterial',
  'Diabetes mellitus tipo 2',
  'Asma bronquial',
  'Hipotiroidismo',
  'Dislipemia',
  'Cirugía de vesícula (2019)',
  'Fractura de muñeca (2021)',
];

function buildEncounterData(): Record<string, any> {
  const data: Record<string, any> = {};

  const reasonCount = faker.number.int({ min: 1, max: 3 });
  const reasonValues: Record<string, string> = {
    consulta_intern_count: String(reasonCount),
  };
  for (let i = 0; i < reasonCount; i++) {
    reasonValues[`motivo_text_${i}`] = pickRandom(CONSULTATION_REASONS);
    reasonValues[`motivo_descripcion_${i}`] = faker.datatype.boolean(0.4)
      ? faker.lorem.sentence()
      : '';
  }
  data['general/consulta_internacion'] = {
    type: 'general/consulta_internacion',
    values: reasonValues,
  };

  if (faker.datatype.boolean(0.6)) {
    data['general/evolucion_consulta_internacion'] = {
      type: 'general/evolucion_consulta_internacion',
      values: { evo_descripcion: pickRandom(EVOLUTION_NOTES) },
    };
  }

  if (faker.datatype.boolean(0.3)) {
    const historyCount = faker.number.int({ min: 1, max: 2 });
    const histValues: Record<string, string> = {
      antecedente_count: String(historyCount),
    };
    for (let i = 0; i < historyCount; i++) {
      histValues[`antecedente_${i}`] = pickRandom(PERSONAL_HISTORY);
      histValues[`fecha_antecedente_${i}`] = faker.date
        .past({ years: 10 })
        .toLocaleDateString('es-AR');
      histValues[`antecedente_descripcion_${i}`] = '';
    }
    data['antecedentes/personales'] = {
      type: 'antecedentes/personales',
      values: histValues,
    };
  }

  return data;
}

function randomNum(min: number, max: number, decimals = 1): string {
  return faker.number.float({ min, max, fractionDigits: decimals }).toString();
}

function buildStudyResult(studyType: string): { type: string; data: string } {
  const d: Record<string, string | { value: string; label: string }> = {};

  switch (studyType) {
  case 'anemia':
    d.rbc = randomNum(3.5, 6.5);
    d.hematocrit = randomNum(33, 52);
    d.hemoglobin = randomNum(10, 17);
    d.reticulocytes = randomNum(0.1, 2);
    d.vcm = randomNum(75, 100);
    d.hcm = randomNum(25, 35);
    d.chcm = randomNum(30, 37);
    d.rdw_sd = randomNum(37, 50);
    d.rdw_cv = randomNum(11, 16);
    d.serum_iron = randomNum(30, 170, 0);
    d.tibc_transferrin = randomNum(200, 500, 0);
    d.transferrin_saturation = randomNum(15, 55);
    d.leukocytes = randomNum(3.5, 11);
    d.ESR = randomNum(2, 30, 0);
    d.platelets = randomNum(150, 450, 0);
    d.direct_coombs = pickRandom([
      { value: 'positive', label: 'Positiva' },
      { value: 'negative', label: 'Negativa' },
    ]);
    d.lymphocytes = randomNum(18, 45);
    break;

  case 'anticoagulation':
    d.quick = randomNum(10, 16);
    d.rin = randomNum(0.8, 3.5);
    d.aptt = randomNum(25, 45);
    break;

  case 'compatibility': {
    const bt = () => pickRandom([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'ab', label: 'AB' },
      { value: 'o', label: '0' },
    ]);
    const rh = () => pickRandom([
      { value: 'positive', label: 'Positivo' },
      { value: 'negative', label: 'Negativo' },
    ]);
    d.female_blood_type = bt();
    d.female_rh0_d_factor = rh();
    d.female_indirect_coombs = pickRandom([
      { value: 'positive', label: 'Positiva' },
      { value: 'negative', label: 'Negativa' },
    ]);
    d.male_blood_type = bt();
    d.male_rh0_d_factor = rh();
    d.heterozygosity = randomNum(0, 100, 0);
    d.homozygosity = randomNum(0, 100, 0);
    break;
  }

  case 'hemostasis':
    d.quick = randomNum(10, 16);
    d.prothrombin_concentration = randomNum(65, 130);
    d.rin = randomNum(0.7, 1.5);
    d.aptt = randomNum(26, 44);
    d.ttd = randomNum(9, 15);
    d.fibrinogen = randomNum(1.5, 4.5);
    d.hematocrit = randomNum(33, 52);
    d.hemoglobin = randomNum(10, 17);
    d.yield_platelets = randomNum(150, 450, 0);
    break;

  case 'myelogram':
    d.procedure = 'Punción aspiración de médula ósea en cresta ilíaca posterior.';
    d.microscopy = faker.lorem.sentences(2);
    d.myelopoietic_series = faker.lorem.sentence();
    d.erythropoietic_series = faker.lorem.sentence();
    break;

  case 'thrombophilia':
    d.quick = randomNum(10, 16);
    d.percentage = randomNum(65, 135);
    d.rin = randomNum(0.7, 1.5);
    d.aptt = randomNum(26, 44);
    break;
  }

  return { type: studyType, data: JSON.stringify(d) };
}

// ── main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('=== Seed Test Organization ===\n');

  const KNOWN_USERNAMES = ['admin.sur', 'dr.ramirez', 'dra.gonzalez', 'recep.sur'];

  try {
    // 1. Clean up previous run (if any), then create the organization
    const sequelize: Sequelize = app.get('sequelizeClient');

    console.log('Cleaning up previous run...');

    const existing = (await app.service('organizations').find({
      query: { slug: ORG_SLUG, $limit: 1 },
      paginate: false,
    } as any)) as any[];

    if (existing.length > 0) {
      const oldId = existing[0].id;
      await sequelize.query('DELETE FROM study_results WHERE "studyId" IN (SELECT id FROM studies WHERE "organizationId" = :id)', { replacements: { id: oldId } });
      await sequelize.query('DELETE FROM studies WHERE "organizationId" = :id', { replacements: { id: oldId } });
      await sequelize.query('DELETE FROM encounters WHERE "organizationId" = :id', { replacements: { id: oldId } });
      await sequelize.query('DELETE FROM appointments WHERE "organizationId" = :id', { replacements: { id: oldId } });
      await sequelize.query('DELETE FROM time_off_events WHERE "organizationId" = :id', { replacements: { id: oldId } });
      await sequelize.query('DELETE FROM md_settings WHERE "organizationId" = :id', { replacements: { id: oldId } });
      const patientIds = (await sequelize.query<{ patientId: string }>('SELECT "patientId" FROM organization_patients WHERE "organizationId" = :id', { replacements: { id: oldId }, type: QueryTypes.SELECT }));
      await sequelize.query('DELETE FROM organization_users WHERE "organizationId" = :id', { replacements: { id: oldId } });
      await sequelize.query('DELETE FROM organization_patients WHERE "organizationId" = :id', { replacements: { id: oldId } });
      if (patientIds.length > 0) {
        const pids = patientIds.map(r => r.patientId);
        await sequelize.query('DELETE FROM personal_data WHERE id IN (SELECT "personalDataId" FROM patient_personal_data WHERE "ownerId" IN (:pids))', { replacements: { pids } });
        await sequelize.query('DELETE FROM contact_data WHERE id IN (SELECT "contactDataId" FROM patient_contact_data WHERE "ownerId" IN (:pids))', { replacements: { pids } });
        await sequelize.query('DELETE FROM patients WHERE id IN (:pids)', { replacements: { pids } });
      }
      await sequelize.query('DELETE FROM organizations WHERE id = :id', { replacements: { id: oldId } });
    }

    // Also clean up users by known usernames (handles partial/failed previous runs)
    const orphanUsers = await sequelize.query<{ id: string }>(
      'SELECT id FROM users WHERE username IN (:usernames)',
      { replacements: { usernames: KNOWN_USERNAMES }, type: QueryTypes.SELECT },
    );
    if (orphanUsers.length > 0) {
      const uids = orphanUsers.map(r => r.id);
      await sequelize.query('DELETE FROM organization_users WHERE "userId" IN (:uids)', { replacements: { uids } });
      await sequelize.query('DELETE FROM md_settings WHERE "userId" IN (:uids)', { replacements: { uids } });
      await sequelize.query('DELETE FROM personal_data WHERE id IN (SELECT "personalDataId" FROM user_personal_data WHERE "ownerId" IN (:uids))', { replacements: { uids } });
      await sequelize.query('DELETE FROM contact_data WHERE id IN (SELECT "contactDataId" FROM user_contact_data WHERE "ownerId" IN (:uids))', { replacements: { uids } });
      await sequelize.query('DELETE FROM users WHERE id IN (:uids)', { replacements: { uids } });
    }

    console.log('  Done.\n');

    console.log(`Creating organization "${ORG_NAME}"...`);
    const org = await app.service('organizations').create({
      name: ORG_NAME,
      slug: ORG_SLUG,
      settings: {},
    } as any);
    const organizationId = (org as any).id;
    console.log(`  Created: ${organizationId}\n`);

    // 2. Create users (1 admin + 2 medics + 1 receptionist)
    console.log('Creating users...');
    const usersService = app.service('users');
    const mdSettingsService = app.service('md-settings');
    const orgUsersService = app.service('organization-users');

    const userSpecs = [
      { username: 'admin.sur', roleId: 'admin' as const, orgRole: 'owner' },
      { username: 'dr.ramirez', roleId: 'medic' as const, orgRole: 'member' },
      { username: 'dra.gonzalez', roleId: 'medic' as const, orgRole: 'member' },
      { username: 'recep.sur', roleId: 'receptionist' as const, orgRole: 'member' },
    ];

    const userIds: string[] = [];
    const medicIds: string[] = [];

    for (const spec of userSpecs) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const password = resetPasswords ? 'retrete' : faker.internet.password({ length: 12 });

      const user = (await usersService.create({
        username: spec.username,
        password,
        roleId: spec.roleId,
        personalData: {
          firstName,
          lastName,
          documentType: 'DNI',
          documentValue: randomDni(),
          nationality: 'AR',
        },
        contactData: {
          email: faker.internet.email({ firstName, lastName }).toLowerCase(),
          phoneNumber: [`cel:${faker.phone.number({ style: 'national' })}`],
          city: faker.location.city(),
          province: pickRandom(['Buenos Aires', 'Córdoba', 'Mendoza', 'Santa Fe']),
        },
      } as any)) as any;

      userIds.push(user.id);

      await orgUsersService.create({
        organizationId,
        userId: user.id,
        role: spec.orgRole,
      } as any);

      if (spec.roleId === 'medic') {
        medicIds.push(user.id);
        await mdSettingsService.create({
          userId: user.id,
          organizationId,
          medicalSpecialty: pickRandom(MEDICAL_SPECIALTIES),
          nationalLicenseNumber: String(faker.number.int({ min: 10000, max: 99999 })),
          stateLicense: pickRandom(['BA', 'CB', 'MZ', 'SF']),
          stateLicenseNumber: String(faker.number.int({ min: 100, max: 9999 })),
          scheduleAllWeekCustomTime: false,
          mondayStart: '08:00:00',
          mondayEnd: '12:00:00',
          tuesdayStart: '08:00:00',
          tuesdayEnd: '12:00:00',
          wednesdayStart: '08:00:00',
          wednesdayEnd: '12:00:00',
          thursdayStart: '08:00:00',
          thursdayEnd: '12:00:00',
          fridayStart: '08:00:00',
          fridayEnd: '12:00:00',
          saturdayStart: null,
          saturdayEnd: null,
          sundayStart: null,
          sundayEnd: null,
          encounterDuration: 20,
        } as any);
      }

      console.log(`  ${spec.roleId.padEnd(14)} ${spec.username} (${firstName} ${lastName})`);
    }

    // 3. Create patients
    console.log(`\nCreating ${PATIENT_COUNT} patients...`);
    const patientsService = app.service('patients');
    const orgPatientsService = app.service('organization-patients');
    const patientIds: string[] = [];

    const prepagas = ['OSDE', 'Swiss Medical', 'Galeno', 'Medicus', 'PAMI', ''];

    for (let i = 0; i < PATIENT_COUNT; i++) {
      const patient = (await patientsService.create({
        medicare: pickRandom(prepagas),
        medicareNumber: faker.datatype.boolean(0.7)
          ? String(faker.number.int({ min: 100000, max: 999999 }))
          : '',
        medicarePlan: '',
        deleted: false,
        personalData: {
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          documentType: 'DNI',
          documentValue: randomDni(),
          nationality: 'AR',
          birthDate: faker.date.birthdate({ min: 1, max: 90, mode: 'age' }).toISOString(),
          maritalStatus: pickRandom(['single', 'married', 'divorced', 'widowed', null]),
        },
        contactData: {
          email: faker.datatype.boolean(0.6) ? faker.internet.email().toLowerCase() : '',
          phoneNumber: [`cel:${faker.phone.number({ style: 'national' })}`],
          streetAddress: faker.location.streetAddress(),
          city: faker.location.city(),
          province: pickRandom(['Buenos Aires', 'Córdoba', 'Mendoza', 'Santa Fe']),
        },
      } as any)) as any;

      patientIds.push(patient.id);
      await orgPatientsService.create({ organizationId, patientId: patient.id } as any);
    }
    console.log(`  Created ${patientIds.length} patients.`);

    // 4. Create encounters
    console.log(`\nCreating ${ENCOUNTER_COUNT} encounters...`);
    const encountersService = app.service('encounters');
    let encounterOk = 0;

    for (let i = 0; i < ENCOUNTER_COUNT; i++) {
      try {
        await encountersService.create({
          data: buildEncounterData(),
          date: faker.date.recent({ days: 180 }),
          medicId: pickRandom(medicIds),
          patientId: pickRandom(patientIds),
          organizationId,
        } as any);
        encounterOk++;
      } catch (err: any) {
        console.error(`  encounter ${i} failed: ${err.message}`);
      }
    }
    console.log(`  Created ${encounterOk}/${ENCOUNTER_COUNT} encounters.`);

    // 5. Create studies with results
    console.log(`\nCreating ${STUDY_COUNT} studies with results...`);
    const studiesService = app.service('studies');
    const studyResultsService = app.service('study-results');
    let studyOk = 0;

    for (let i = 0; i < STUDY_COUNT; i++) {
      const studyTypeCount = faker.number.int({ min: 1, max: 4 });
      const studyTypes = faker.helpers.arrayElements(STUDY_TYPES, studyTypeCount);

      try {
        const study = (await studiesService.create({
          date: faker.date.recent({ days: 90 }),
          studies: studyTypes,
          noOrder: faker.datatype.boolean(0.2),
          medicId: pickRandom(medicIds),
          referringDoctor: faker.datatype.boolean(0.4)
            ? `Dr. ${faker.person.lastName()}`
            : null,
          patientId: pickRandom(patientIds),
          organizationId,
        } as any)) as any;

        for (const studyType of studyTypes) {
          const result = buildStudyResult(studyType);
          await studyResultsService.create({
            studyId: study.id,
            type: result.type,
            data: result.data,
          } as any);
        }

        studyOk++;
      } catch (err: any) {
        console.error(`  study ${i} failed: ${err.message}`);
      }
    }
    console.log(`  Created ${studyOk}/${STUDY_COUNT} studies.`);

    // Summary
    console.log('\n=== Summary ===');
    console.log(`  Organization: ${ORG_NAME} (${organizationId})`);
    console.log(`  Users: ${userIds.length}`);
    console.log(`  Patients: ${patientIds.length}`);
    console.log(`  Encounters: ${encounterOk}`);
    console.log(`  Studies: ${studyOk}`);
    console.log('\nDone!');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }

  process.exit(0);
})();
