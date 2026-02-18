import fs from 'fs/promises';
import path from 'path';
import { omit } from 'lodash';
import cliProgress from 'cli-progress';

import { resetDatabase } from './reset-db';
import app from '../src/app';

import { importUsers } from './import-seeds/import-users';
import { importPatients } from './import-seeds/import-patients';
import { importEncounters } from './import-seeds/import-encounters';
import { importAppointments } from './import-seeds/import-appointments';
import { importStudies } from './import-seeds/import-studies';
import { importResults } from './import-seeds/import-results';
import { importLicenses } from './import-seeds/import-licenses';

import type {
  SeedUser,
  SeedPatient,
  SeedEncounter,
  SeedAppointment,
  SeedStudy,
  SeedResult,
  SeedLicense,
} from './create-seeds/types';

const SEEDS_DIR = path.join(__dirname, './seeds');
const resetPasswords = process.argv.includes('--reset-passwords');

async function loadSeed<T>(filename: string): Promise<T> {
  const content = await fs.readFile(path.join(SEEDS_DIR, filename), 'utf-8');
  return JSON.parse(content) as T;
}

async function seedStaticData(multibar: cliProgress.MultiBar) {
  const chunkSize = 500;

  // Seed roles
  const roles = JSON.parse(
    await fs.readFile(path.join(SEEDS_DIR, 'roles.json'), 'utf-8'),
  );
  const rolesService = app.service('roles');
  for (const role of roles) {
    await rolesService.create(role);
  }

  // Seed ICD-10 (icd10-es.json already has the correct tree structure)
  const icd10Raw: any[] = JSON.parse(
    await fs.readFile(path.join(SEEDS_DIR, 'icd10-es.json'), 'utf-8'),
  );
  const icd10Service = app.service('icd-10');
  const icd10Bar = multibar.create(icd10Raw.length, 0, { title: 'ICD-10' });
  for (let i = 0; i < icd10Raw.length; i += chunkSize) {
    const chunk = icd10Raw.slice(i, i + chunkSize).map((item) => omit(item, 'level'));
    await icd10Service.create(chunk);
    icd10Bar.increment(chunk.length);
  }

  // Seed laboratories + medications (from medications.json)
  const medsRaw: any[] = JSON.parse(
    await fs.readFile(path.join(SEEDS_DIR, 'medications.json'), 'utf-8'),
  );

  const laboratoriesService = app.service('laboratories');
  const medicationsService = app.service('medications');

  const uniqueLabNames = Array.from(
    new Set(medsRaw.map((r) => r.Laboratorio?.trim()).filter(Boolean)),
  ) as string[];

  const labBar = multibar.create(uniqueLabNames.length, 0, { title: 'Laboratories' });
  const labMap = new Map<string, string>();
  for (const labName of uniqueLabNames) {
    try {
      const lab = await laboratoriesService.create({ name: labName });
      labMap.set(labName, lab.id);
    } catch {
      const existing = (await laboratoriesService.find({
        query: { name: labName, $limit: 1 },
        paginate: false,
      })) as any[];
      if (existing.length > 0) {
        labMap.set(labName, existing[0].id);
      }
    }
    labBar.increment();
  }

  const medicationsData = medsRaw
    .filter((r) => r.Nombre_Comercial_Presentacion && r.Monodroga_Generico)
    .map((r) => ({
      commercialNamePresentation: r.Nombre_Comercial_Presentacion,
      genericDrug: r.Monodroga_Generico,
      laboratoryId: labMap.get(r.Laboratorio?.trim()),
      pharmaceuticalForm: r.Forma_Farmaceutica,
      certificateNumber: r.Numero_Certificado,
      gtin: r.GTIN,
      availability: r.Disponibilidad,
    }));

  const medsBar = multibar.create(medicationsData.length, 0, { title: 'Medications' });
  for (let i = 0; i < medicationsData.length; i += chunkSize) {
    const chunk = medicationsData.slice(i, i + chunkSize);
    await medicationsService.create(chunk);
    medsBar.increment(chunk.length);
  }

  // Seed prepagas
  const prepagasRaw: any[] = JSON.parse(
    await fs.readFile(path.join(SEEDS_DIR, 'prepagas.json'), 'utf-8'),
  );
  const prepagasService = app.service('prepagas');
  const prepagasBar = multibar.create(prepagasRaw.length, 0, { title: 'Prepagas' });
  for (let i = 0; i < prepagasRaw.length; i += chunkSize) {
    const chunk = prepagasRaw.slice(i, i + chunkSize);
    await prepagasService.create(chunk);
    prepagasBar.increment(chunk.length);
  }
}

(async () => {
  console.log('=== Import Seeds ===');
  if (resetPasswords) {
    console.log('  --reset-passwords: all user passwords will be set to "retrete"');
  }
  console.log('');

  const multibar = new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      format: '{bar} | {percentage}% | ETA: {eta_formatted} | {value}/{total} | {title}',
    },
    cliProgress.Presets.shades_classic,
  );

  try {
    // Step 1: Reset database
    console.log('Resetting database...');
    await resetDatabase();
    console.log('Database reset complete.\n');

    // Step 2: Seed static data (roles, ICD-10, medications, prepagas)
    console.log('Seeding static data...');
    await seedStaticData(multibar);
    console.log('Static data seeded.\n');

    // Step 3: Load seed files
    console.log('Loading seed files...');
    const [users, patients, encounters, appointments, studies, studyResults, licenses] =
      await Promise.all([
        loadSeed<SeedUser[]>('user.seed.json'),
        loadSeed<SeedPatient[]>('patient.seed.json'),
        loadSeed<SeedEncounter[]>('encounter.seed.json'),
        loadSeed<SeedAppointment[]>('appointment.seed.json'),
        loadSeed<SeedStudy[]>('studies.seed.json'),
        loadSeed<SeedResult[]>('results.seed.json'),
        loadSeed<SeedLicense[]>('licenses.seed.json'),
      ]);

    console.log(
      `Loaded: ${users.length} users, ${patients.length} patients, ` +
      `${encounters.length} encounters, ${appointments.length} appointments, ` +
      `${studies.length} studies, ${studyResults.length} results, ` +
      `${licenses.length} licenses\n`,
    );

    // Step 4: Import users
    const userBar = multibar.create(users.length, 0, { title: 'Users' });
    const usersResult = await importUsers({ users, resetPasswords, bar: userBar });

    // Step 5: Import patients
    const patientBar = multibar.create(patients.length, 0, { title: 'Patients' });
    const patientsResult = await importPatients({ patients, bar: patientBar });

    // Step 6: Import encounters
    const encounterBar = multibar.create(encounters.length, 0, { title: 'Encounters' });
    const encountersResult = await importEncounters({
      encounters,
      validUserIds: usersResult.validUserIds,
      mongoToRealPatientId: patientsResult.mongoToRealPatientId,
      bar: encounterBar,
    });

    // Step 7: Import appointments
    const appointmentBar = multibar.create(appointments.length, 0, { title: 'Appointments' });
    const appointmentsResult = await importAppointments({
      appointments,
      validUserIds: usersResult.validUserIds,
      mongoToRealPatientId: patientsResult.mongoToRealPatientId,
      bar: appointmentBar,
    });

    // Step 8: Import studies
    const studyBar = multibar.create(studies.length, 0, { title: 'Studies' });
    const studiesResult = await importStudies({
      studies,
      mongoToRealPatientId: patientsResult.mongoToRealPatientId,
      bar: studyBar,
    });

    // Step 9: Import study results
    const resultBar = multibar.create(studyResults.length, 0, { title: 'Results' });
    const resultsResult = await importResults({
      studyResults,
      seedToRealStudyId: studiesResult.seedToRealStudyId,
      bar: resultBar,
    });

    // Step 10: Import licenses as time-off events
    const licenseBar = multibar.create(licenses.length, 0, { title: 'Licenses' });
    const licensesResult = await importLicenses({
      licenses,
      validUserIds: usersResult.validUserIds,
      bar: licenseBar,
    });

    multibar.stop();

    // Summary
    console.log('\n=== Import Summary ===');
    console.log(`  Users: ${usersResult.validUserIds.size}/${users.length} imported`);
    console.log(
      `  Patients: ${patientsResult.validPatientIds.size}/${patients.length} imported`,
    );
    console.log(
      `  Encounters: ${encountersResult.importedCount}/${encounters.length} imported, ${encountersResult.skippedCount} skipped`,
    );
    console.log(
      `  Appointments: ${appointmentsResult.importedCount}/${appointments.length} imported, ${appointmentsResult.skippedCount} skipped`,
    );
    console.log(
      `  Studies: ${studiesResult.importedCount}/${studies.length} imported, ${studiesResult.skippedCount} skipped`,
    );
    console.log(
      `  Results: ${resultsResult.importedCount}/${studyResults.length} imported, ${resultsResult.skippedCount} skipped`,
    );
    console.log(
      `  Licenses: ${licensesResult.importedCount}/${licenses.length} imported, ${licensesResult.skippedCount} skipped`,
    );

    // Write skipped items to JSON files
    const skippedDir = path.join(SEEDS_DIR, 'import-skipped');
    await fs.mkdir(skippedDir, { recursive: true });

    const skippedFiles: Array<{ name: string; data: any[] }> = [
      { name: 'users.json', data: usersResult.skipped },
      { name: 'patients.json', data: patientsResult.skipped },
      { name: 'encounters.json', data: encountersResult.skipped },
      { name: 'appointments.json', data: appointmentsResult.skipped },
      { name: 'studies.json', data: studiesResult.skipped },
      { name: 'results.json', data: resultsResult.skipped },
      { name: 'licenses.json', data: licensesResult.skipped },
    ];

    for (const { name, data } of skippedFiles) {
      if (data.length > 0) {
        await fs.writeFile(
          path.join(skippedDir, name),
          JSON.stringify(data, null, 2),
        );
        console.log(`  Wrote ${data.length} skipped items to import-skipped/${name}`);
      }
    }

    console.log('\nImport completed!');
  } catch (error) {
    multibar.stop();
    console.error('Import failed:', error);
    process.exit(1);
  }

  process.exit(0);
})();
