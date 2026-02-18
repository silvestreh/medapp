import type cliProgress from 'cli-progress';
import dayjs from 'dayjs';
import type { MongoAppointment, ProcessingStats, SeedAppointment } from './types';

interface ProcessAppointmentsOptions {
  appointments: MongoAppointment[];
  keptUserIds: Set<string>;
  keptPatientIds: Set<string>;
  bar: cliProgress.SingleBar;
}

interface ProcessAppointmentsResult {
  appointments: SeedAppointment[];
  stats: ProcessingStats;
}

export function processAppointments({
  appointments,
  keptUserIds,
  keptPatientIds,
  bar,
}: ProcessAppointmentsOptions): ProcessAppointmentsResult {
  const stats: ProcessingStats = {
    total: appointments.length,
    kept: 0,
    discarded: 0,
    reasons: {},
  };

  const sixMonthsAgo = dayjs().subtract(6, 'months');
  const kept: SeedAppointment[] = [];

  for (const appointment of appointments) {
    if (!keptUserIds.has(appointment.medic_id)) {
      stats.discarded++;
      stats.reasons['missing_medic_reference'] = (stats.reasons['missing_medic_reference'] || 0) + 1;
      bar.increment();
      continue;
    }

    if (!keptPatientIds.has(appointment.patient_id)) {
      stats.discarded++;
      stats.reasons['missing_patient_reference'] = (stats.reasons['missing_patient_reference'] || 0) + 1;
      bar.increment();
      continue;
    }

    const timestamp = appointment.start_timestamp.$numberLong
      ? Number(appointment.start_timestamp.$numberLong)
      : Number(appointment.start_timestamp);

    if (isNaN(timestamp)) {
      stats.discarded++;
      stats.reasons['invalid_timestamp'] = (stats.reasons['invalid_timestamp'] || 0) + 1;
      bar.increment();
      continue;
    }

    const startDate = dayjs.unix(timestamp);

    if (startDate.isBefore(sixMonthsAgo)) {
      stats.discarded++;
      stats.reasons['older_than_6_months'] = (stats.reasons['older_than_6_months'] || 0) + 1;
      bar.increment();
      continue;
    }

    kept.push({
      patientId: appointment.patient_id,
      medicId: appointment.medic_id,
      startDate: startDate.toISOString(),
      extra: Boolean(appointment.extra),
    });

    bar.increment();
  }

  stats.kept = kept.length;

  return { appointments: kept, stats };
}
