import fs from 'fs/promises';
import path from 'path';
import cliProgress from 'cli-progress';
import { cleanedNames } from './utils';
import { loadDumps } from './create-seeds/load-dumps';
import { deduplicatePatients } from './create-seeds/deduplicate-patients';
import { processUsers } from './create-seeds/process-users';
import { processPatients, transformPatientToSeed } from './create-seeds/process-patients';
import { processEncounters } from './create-seeds/process-encounters';
import { processAppointments } from './create-seeds/process-appointments';
import { processStudies } from './create-seeds/process-studies';
import { processResults } from './create-seeds/process-results';
import { processLicenses } from './create-seeds/process-licenses';
import { writeSeeds } from './create-seeds/write-seeds';
import type { ProcessingStats } from './create-seeds/types';

const SEEDS_DIR = path.join(__dirname, 'seeds');
const DISCARDED_DIR = path.join(SEEDS_DIR, 'discarded');

const skipLLM = process.argv.includes('--no-llm');

function printStats(label: string, stats: ProcessingStats) {
  console.log(`  ${label}: ${stats.kept}/${stats.total} kept, ${stats.discarded} discarded`);
  for (const [reason, count] of Object.entries(stats.reasons)) {
    console.log(`    - ${reason}: ${count}`);
  }
}

(async () => {
  console.log('=== Create Seeds ===');
  if (skipLLM) {
    console.log('  --no-llm flag detected: skipping LLM name cleanup');
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
    // Step 0: Clean previous seeds
    console.log('Cleaning previous seeds...');
    const seedFiles = await fs.readdir(SEEDS_DIR).catch(() => []);
    for (const file of seedFiles) {
      if (file.endsWith('.seed.json')) {
        await fs.unlink(path.join(SEEDS_DIR, file));
      }
    }
    const discardedFiles = await fs.readdir(DISCARDED_DIR).catch(() => []);
    for (const file of discardedFiles) {
      if (file.endsWith('.json')) {
        await fs.unlink(path.join(DISCARDED_DIR, file));
      }
    }
    console.log('Done.\n');

    // Step 1: Load dumps
    console.log('Loading dumps into memory...');
    const dumps = await loadDumps();
    console.log(
      `Loaded: ${dumps.users.length} users, ${dumps.patients.length} patients, ` +
      `${dumps.encounters.length} encounters, ${dumps.appointments.length} appointments, ` +
      `${dumps.studies.length} studies, ${dumps.studyResults.length} results, ` +
      `${dumps.licenses.length} licenses`,
    );
    console.log('');

    // Step 2: Deduplicate soft-deleted patients
    console.log('Deduplicating patients...');
    const dedupResult = deduplicatePatients(dumps.patients);
    const remap = dedupResult.patientIdRemap;

    if (remap.size > 0) {
      console.log(`  Merged ${remap.size} duplicate patient(s)`);

      for (const encounter of dumps.encounters) {
        const remapped = remap.get(encounter.patient_id);
        if (remapped) {
          encounter.patient_id = remapped;
        }
      }

      for (const appointment of dumps.appointments) {
        const remapped = remap.get(appointment.patient_id);
        if (remapped) {
          appointment.patient_id = remapped;
        }
      }

      for (const study of dumps.studies) {
        if (study.patient?.id) {
          const remapped = remap.get(study.patient.id);
          if (remapped) {
            study.patient.id = remapped;
          }
        }
      }
    }
    console.log('');

    // Step 3: Process users (filter inactive Medics, LLM name cleanup, transform to API format)
    const userBar = multibar.create(dumps.users.length, 0, { title: 'Users' });
    const usersResult = await processUsers({
      users: dumps.users,
      encounters: dumps.encounters,
      studies: dumps.studies,
      bar: userBar,
    });

    // Step 4: Process patients (filter, LLM name cleanup, transform to API format)
    const patientBar = multibar.create(dedupResult.patients.length, 0, { title: 'Patients' });
    const patientsResult = await processPatients({
      patients: dedupResult.patients,
      encounters: dumps.encounters,
      studies: dumps.studies,
      skipLLM,
      bar: patientBar,
    });

    // Step 5: Process encounters (validate refs, transform to API format)
    const encounterBar = multibar.create(dumps.encounters.length, 0, { title: 'Encounters' });
    const encountersResult = processEncounters({
      encounters: dumps.encounters,
      keptUserIds: usersResult.keptUserIds,
      keptPatientIds: patientsResult.keptPatientIds,
      weirdUserId: usersResult.weirdUserId,
      bar: encounterBar,
    });

    // Step 6: Process appointments (6-month cutoff, transform to API format)
    const appointmentBar = multibar.create(dumps.appointments.length, 0, { title: 'Appointments' });
    const appointmentsResult = processAppointments({
      appointments: dumps.appointments,
      keptUserIds: usersResult.keptUserIds,
      keptPatientIds: patientsResult.keptPatientIds,
      bar: appointmentBar,
    });

    // Step 7: Process studies (patient matching, transform to API format)
    const studyBar = multibar.create(dumps.studies.length, 0, { title: 'Studies' });
    const studiesResult = processStudies({
      studies: dumps.studies,
      allPatients: dedupResult.patients,
      keptPatientIds: patientsResult.keptPatientIds,
      bar: studyBar,
    });

    // Rescue patients that were discarded but referenced by studies
    if (studiesResult.rescuedPatientIds.size > 0) {
      const allPatientsById = new Map(
        dedupResult.patients.map(p => [p._id.$oid, p]),
      );
      for (const rescuedId of studiesResult.rescuedPatientIds) {
        const mongoPatient = allPatientsById.get(rescuedId);
        if (mongoPatient) {
          patientsResult.patients.push(transformPatientToSeed(mongoPatient));
          patientsResult.keptPatientIds.add(rescuedId);
        }
      }
    }

    // Append synthetic patients created from orphan studies
    if (studiesResult.syntheticPatients.length > 0) {
      for (const sp of studiesResult.syntheticPatients) {
        patientsResult.patients.push(sp);
        patientsResult.keptPatientIds.add(sp.id);
      }
    }

    // Step 8: Process results (filter orphaned, transform to API format)
    const resultBar = multibar.create(dumps.studyResults.length, 0, { title: 'Results' });
    const resultsResult = processResults({
      studyResults: dumps.studyResults,
      keptStudyIds: studiesResult.keptStudyIds,
      bar: resultBar,
    });

    // Step 9: Process licenses (date cutoff, dedup, transform to API format)
    const licenseBar = multibar.create(dumps.licenses.length, 0, { title: 'Licenses' });
    const licensesResult = processLicenses({
      licenses: dumps.licenses,
      keptUserIds: usersResult.keptUserIds,
      bar: licenseBar,
    });

    multibar.stop();

    // Step 10: Write seed files
    console.log('\nWriting seed files...');
    await writeSeeds(
      {
        users: usersResult.users,
        patients: patientsResult.patients,
        encounters: encountersResult.encounters,
        appointments: appointmentsResult.appointments,
        studies: studiesResult.studies,
        studyResults: resultsResult.studyResults,
        licenses: licensesResult.licenses,
      },
      {
        encounters: encountersResult.discardedEncounters,
        studies: studiesResult.discardedStudies,
      },
    );

    // Summary
    console.log('\n=== Summary ===');
    printStats('Dedup', dedupResult.stats);
    printStats('Users', usersResult.stats);
    printStats('Patients', patientsResult.stats);
    printStats('Encounters', encountersResult.stats);
    printStats('Appointments', appointmentsResult.stats);
    printStats('Studies', studiesResult.stats);
    printStats('Results', resultsResult.stats);
    printStats('Licenses', licensesResult.stats);

    if (studiesResult.rescuedPatientIds.size > 0) {
      console.log(`\nRescued ${studiesResult.rescuedPatientIds.size} patient(s) via study references`);
    }

    if (studiesResult.syntheticPatients.length > 0) {
      console.log(`Created ${studiesResult.syntheticPatients.length} synthetic patient(s) from orphan study DNIs`);
    }

    if (cleanedNames.length > 0) {
      console.log(`Cleaned ${cleanedNames.length} names via LLM`);
    }

    const totalDiscardedEncounters = encountersResult.discardedEncounters.length;
    const totalDiscardedStudies = studiesResult.discardedStudies.length;
    if (totalDiscardedEncounters > 0 || totalDiscardedStudies > 0) {
      console.log('\nDiscarded files written to scripts/seeds/discarded/');
      if (totalDiscardedEncounters > 0) {
        console.log(`  encounters.json: ${totalDiscardedEncounters} records`);
      }
      if (totalDiscardedStudies > 0) {
        console.log(`  studies.json: ${totalDiscardedStudies} records`);
      }
    }

    console.log('\nSeed files written to scripts/seeds/*.seed.json');
  } catch (error) {
    multibar.stop();
    console.error('Seed creation failed:', error);
    process.exit(1);
  }

  process.exit(0);
})();
