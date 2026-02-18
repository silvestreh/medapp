import fs from 'fs/promises';
import path from 'path';
import type { DumpData } from './types';

const DUMPS_DIR = path.join(__dirname, '../dumps');

export async function loadDumps(): Promise<DumpData> {
  const [users, patients, encounters, appointments, studies, studyResults, licenses] =
    await Promise.all([
      fs.readFile(path.join(DUMPS_DIR, 'user.json'), 'utf-8').then(JSON.parse),
      fs.readFile(path.join(DUMPS_DIR, 'patient.json'), 'utf-8').then(JSON.parse),
      fs.readFile(path.join(DUMPS_DIR, 'encounter.json'), 'utf-8').then(JSON.parse),
      fs.readFile(path.join(DUMPS_DIR, 'appointment.json'), 'utf-8').then(JSON.parse),
      fs.readFile(path.join(DUMPS_DIR, 'studies.json'), 'utf-8').then(JSON.parse),
      fs.readFile(path.join(DUMPS_DIR, 'results.json'), 'utf-8').then(JSON.parse),
      fs.readFile(path.join(DUMPS_DIR, 'licenses.json'), 'utf-8').then(JSON.parse),
    ]);

  return { users, patients, encounters, appointments, studies, studyResults, licenses };
}
