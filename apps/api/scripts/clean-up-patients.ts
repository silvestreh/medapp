import { groupBy } from 'lodash';
import cliProgress from 'cli-progress';
import ora from 'ora';
import fs from 'fs';
import path from 'path';

import app from '../src/app';
import { cleanUpQuery, restorePatientsQuery } from './cleanup-query';

const personalDataService = app.service('personal-data');
const patientPersonalDataService = app.service('patient-personal-data');
const patientsService = app.service('patients');

const summary = {
  totalDuplicatePatients: 0,
  totalEncountersPatched: 0,
  totalAppointmentsPatched: 0,
  totalStudiesPatched: 0,
  totalPatientsRemoved: 0,
  failedAppointmentsPatch: 0,
  failedEncountersPatch: 0,
  failedStudiesPatch: 0,
  failedPatientRemovals: 0,
  totalOrphanedPersonalDataRemoved: 0,
  totalOrphanedPatientPersonalDataRemoved: 0,
  failedOrphanedPatientPersonalDataRemovals: 0,
  failedOrphanedPersonalDataRemovals: 0,
};

// Add arrays to track specific items
const results = {
  patchedEncounters: [] as any[],
  patchedAppointments: [] as any[],
  patchedStudies: [] as any[],
  failedPatients: [] as any[],
  failedAppointments: [] as any[],
  failedEncounters: [] as any[],
  failedStudies: [] as any[],
};

// Initialize progress bars
const progressBars = new cliProgress.MultiBar({
  clearOnComplete: false,
  hideCursor: true,
  format: '{bar} {percentage}% | {value}/{total} | {task}'
}, cliProgress.Presets.shades_classic);

(async () => {
  try {
    console.log('Fetching all personal data...');
    const allPersonalData = await personalDataService.find({ paginate: false });
    console.log(`Fetched ${allPersonalData.length} personal data records.`);

    const groupedByDocumentValue = groupBy(allPersonalData, 'documentValue');
    console.log(`Grouped personal data by document value. Found ${Object.keys(groupedByDocumentValue).length} unique document values.`);

    const documentValueToUserIds: Record<string, string[]> = {};
    const documentProgress = progressBars.create(Object.keys(groupedByDocumentValue).length, 0, { task: 'Processing documents' });
    const updateProgress = progressBars.create(0, 0, { task: 'Updating records' });

    for (const documentValue of Object.keys(groupedByDocumentValue)) {
      documentProgress.increment();
      const pdsForDocumentValue = groupedByDocumentValue[documentValue];
      const ppds = await patientPersonalDataService.find({
        query: { personalDataId: { $in: pdsForDocumentValue.map((pd) => pd.id) } },
        paginate: false,
      });

      const ownerIds = ppds.map(ppd => ppd.ownerId);
      // @ts-expect-error wtf
      documentValueToUserIds[documentValue] = ownerIds;

      if (ownerIds.length > 1) {
        summary.totalDuplicatePatients += ownerIds.length - 1;
        const mainUserId = ownerIds[0];
        const otherPatientIds = ownerIds.slice(1);

        // Reset and set the total for updateProgress
        updateProgress.update(0);
        updateProgress.setTotal(otherPatientIds.length * 4);

        for (const otherPatientId of otherPatientIds) {
          try {
            // Update appointments
            try {
              const appointmentsPatched = await app.service('appointments').patch(null, { patientId: mainUserId }, { query: { patientId: otherPatientId } });
              summary.totalAppointmentsPatched += appointmentsPatched.length;
              results.patchedAppointments.push(...appointmentsPatched.map(a => ({ ...a, originalPatientId: otherPatientId })));
            } catch (error: any) {
              summary.failedAppointmentsPatch += 1;
              results.failedAppointments.push({
                patientId: otherPatientId,
                error: error.message,
                timestamp: new Date().toISOString()
              });
            }
            updateProgress.increment();

            // Update encounters
            try {
              const encountersPatched = await app.service('encounters').patch(null, { patientId: mainUserId }, { query: { patientId: otherPatientId } });
              summary.totalEncountersPatched += encountersPatched.length;
              results.patchedEncounters.push(...encountersPatched.map(e => ({ ...e, originalPatientId: otherPatientId })));
            } catch (error: any) {
              summary.failedEncountersPatch += 1;
              results.failedEncounters.push({
                patientId: otherPatientId,
                error: error.message,
                timestamp: new Date().toISOString()
              });
            }
            updateProgress.increment();

            // Update studies
            try {
              const studiesPatched = await app.service('studies').patch(null, { patientId: mainUserId }, { query: { patientId: otherPatientId } });
              summary.totalStudiesPatched += studiesPatched.length;
              results.patchedStudies.push(...studiesPatched.map(s => ({ ...s, originalPatientId: otherPatientId })));
            } catch (error: any) {
              summary.failedStudiesPatch += 1;
              results.failedStudies.push({
                patientId: otherPatientId,
                error: error.message,
                timestamp: new Date().toISOString()
              });
            }
            updateProgress.increment();

            // Remove the patient
            try {
              // Double check that the patient has no records
              let appointments = await app.service('appointments').find({ query: { patientId: otherPatientId }, paginate: false });
              let encounters = await app.service('encounters').find({ query: { patientId: otherPatientId }, paginate: false });
              let studies = await app.service('studies').find({ query: { patientId: otherPatientId }, paginate: false });

              if (appointments.length > 0) {
                await app.service('appointments').patch(null, { patientId: mainUserId }, { query: { id: { $in: appointments.map(a => a.id) } } });
              }

              if (encounters.length > 0) {
                await app.service('encounters').patch(null, { patientId: mainUserId }, { query: { id: { $in: encounters.map(e => e.id) } } });
              }

              if (studies.length > 0) {
                await app.service('studies').patch(null, { patientId: mainUserId }, { query: { id: { $in: studies.map(s => s.id) } } });
              }

              appointments = await app.service('appointments').find({ query: { patientId: otherPatientId }, paginate: false });
              encounters = await app.service('encounters').find({ query: { patientId: otherPatientId }, paginate: false });
              studies = await app.service('studies').find({ query: { patientId: otherPatientId }, paginate: false });

              if (appointments.length === 0 && encounters.length === 0 && studies.length === 0) {
                await patientsService.remove(otherPatientId);
                summary.totalPatientsRemoved += 1;
              }
            } catch (error: any) {
              summary.failedPatientRemovals += 1;
              results.failedPatients.push({
                patientId: otherPatientId,
                error: error.message,
                timestamp: new Date().toISOString()
              });
            }
            updateProgress.increment();
          } catch (error: any) {// eslint-disable-line @typescript-eslint/no-unused-vars
            // console.error(`Failed to update or remove records for user ID: ${otherUserId}`, error);
          }
        }
      }
    }

    progressBars.stop();

    console.time('Cleaning up');
    const spinner = ora('Cleaning up… this will take a few minutes').start();
    const sequelize = app.get('sequelizeClient');
    await sequelize.query(cleanUpQuery);
    await sequelize.query(restorePatientsQuery);
    spinner.succeed();
    console.timeEnd('Cleaning up');

    // Save results to JSON files
    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir);
    }

    // Write each result to its own file
    const files = {
      'patched-encounters.json': results.patchedEncounters,
      'patched-appointments.json': results.patchedAppointments,
      'patched-studies.json': results.patchedStudies,
      'failed-patients.json': results.failedPatients,
      'failed-appointments.json': results.failedAppointments,
      'failed-encounters.json': results.failedEncounters,
      'failed-studies.json': results.failedStudies,
    };

    for (const [filename, data] of Object.entries(files)) {
      fs.writeFileSync(
        path.join(resultsDir, filename),
        JSON.stringify(data, null, 2)
      );
    }

    // Output summary
    console.log('\nSummary of actions performed:');
    console.log(`Found ${summary.totalDuplicatePatients} patients with the same documentValue.`);
    console.log(`Patched ${summary.totalEncountersPatched} encounters.`);
    console.log(`Patched ${summary.totalAppointmentsPatched} appointments.`);
    console.log(`Patched ${summary.totalStudiesPatched} studies.`);
    console.log(`Removed ${summary.totalPatientsRemoved} patients.`);
    console.log(`Failed appointments patches: ${summary.failedAppointmentsPatch}`);
    console.log(`Failed encounters patches: ${summary.failedEncountersPatch}`);
    console.log(`Failed studies patches: ${summary.failedStudiesPatch}`);
    console.log(`Failed patient removals: ${summary.failedPatientRemovals}`);
  } catch (error: any) {
    console.error('Error during cleanup:', error);
  }
})();
