import type cliProgress from 'cli-progress';
import app from '../../src/app';
import type { SeedAppointment } from '../create-seeds/types';

interface ImportAppointmentsOptions {
  appointments: SeedAppointment[];
  validUserIds: Set<string>;
  mongoToRealPatientId: Map<string, string>;
  bar: cliProgress.SingleBar;
}

export interface ImportAppointmentsResult {
  importedCount: number;
  skippedCount: number;
  skipped: Array<{ item: SeedAppointment; reason: string }>;
}

export async function importAppointments({
  appointments,
  validUserIds,
  mongoToRealPatientId,
  bar,
}: ImportAppointmentsOptions): Promise<ImportAppointmentsResult> {
  const appointmentsService = app.service('appointments');
  let importedCount = 0;
  let skippedCount = 0;
  const skipped: ImportAppointmentsResult['skipped'] = [];

  for (const appointment of appointments) {
    const realPatientId = mongoToRealPatientId.get(appointment.patientId);

    if (!validUserIds.has(appointment.medicId)) {
      skipped.push({ item: appointment, reason: `medicId "${appointment.medicId}" not found in imported users` });
      skippedCount++;
      bar.increment();
      continue;
    }

    if (!realPatientId) {
      skipped.push({ item: appointment, reason: `patientId "${appointment.patientId}" not found in imported patients` });
      skippedCount++;
      bar.increment();
      continue;
    }

    try {
      await appointmentsService.create({
        ...appointment,
        startDate: new Date(appointment.startDate),
        patientId: realPatientId,
      } as any);
      importedCount++;
    } catch (error: any) {
      skipped.push({ item: appointment, reason: `create failed: ${error?.message || String(error)}` });
      skippedCount++;
    }

    bar.increment();
  }

  return { importedCount, skippedCount, skipped };
}
