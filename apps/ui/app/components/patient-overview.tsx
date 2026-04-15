import { useMemo, useCallback } from 'react';
import { Text, Stack, SimpleGrid, Indicator } from '@mantine/core';
import { Calendar } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import type { Patient } from '~/declarations';
import { styled } from '~/styled-system/jsx';
import { StyledTitle, FormCard, FieldRow, FormHeader } from '~/components/forms/styles';
import { MedicareDisplay } from '~/components/medicare-display';

interface SireData {
  treatment: {
    id: string;
    medication: string;
    tabletDoseMg: number;
    targetInrMin: number;
    targetInrMax: number;
    startDate: string;
    nextControlDate: string | null;
  };
  schedule: {
    startDate: string;
    endDate: string | null;
    schedule: Record<string, number | null>;
  } | null;
  doseLogs: Array<{
    date: string;
    taken: boolean | null;
    expectedDose: number | null;
  }>;
}

interface PatientOverviewProps {
  patient: Patient;
  encounters: any[];
  sireData?: SireData | null;
}

const Section = styled('div', {
  base: {
    marginBottom: '1.5rem',
  },
});

const DayCell = styled('div', {
  base: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1.25rem',
  },
});

const SireLayout = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',

    lg: {
      flexDirection: 'row',
    },
  },
});

const CalendarContainer = styled('div', {
  base: {
    padding: '1rem',
    borderRight: '1px solid var(--mantine-color-gray-2)',
  },
});

const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const WEEKDAY_I18N_KEYS = ['day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat', 'day_sun'] as const;

/** Parse a birth date string to dayjs, forcing local interpretation of YYYY-MM-DD. */
function parseBirthDate(birthDate: string | Date | null | undefined): dayjs.Dayjs | null {
  if (!birthDate) return null;
  if (birthDate instanceof Date) return dayjs(birthDate);
  const match = String(birthDate).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    // Build from local components — avoids new Date("YYYY-MM-DD") treating it as UTC
    return dayjs(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  const date = dayjs(birthDate);
  return date.isValid() ? date : null;
}

function getAge(birthDate: string | Date | null | undefined): number | null {
  const date = parseBirthDate(birthDate);
  if (!date) return null;
  return dayjs().diff(date, 'year');
}

function formatBirthDate(birthDate: string | Date | null | undefined): string | null {
  const date = parseBirthDate(birthDate);
  if (!date) return null;
  return date.format('DD/MM/YYYY');
}

function getLastEvolution(encounters: any[]): string | null {
  // Encounters are already sorted by date desc from the loader
  for (const encounter of encounters) {
    if (!encounter.data || typeof encounter.data === 'string') continue;
    const evolution = encounter.data['general/evolucion_consulta_internacion'];
    if (evolution?.values?.evo_descripcion) {
      return evolution.values.evo_descripcion;
    }
  }
  return null;
}

function formatDose(dose: number | null): string {
  if (dose == null) return '—';
  if (dose === 0) return '0';
  if (dose === 0.25) return '¼';
  if (dose === 0.5) return '½';
  if (dose === 0.75) return '¾';
  if (dose === 1) return '1';
  if (dose === 1.5) return '1½';
  return String(dose);
}

export function PatientOverview({ patient, encounters, sireData }: PatientOverviewProps) {
  const { t } = useTranslation();
  const birthDate = (patient.personalData as any).birthDate;
  const age = getAge(birthDate);
  const formattedBirth = formatBirthDate(birthDate);
  const lastEvolution = getLastEvolution(encounters);

  const doseLogMap = useMemo(() => {
    if (!sireData?.doseLogs) return new Map<string, boolean | null>();
    const map = new Map<string, boolean | null>();
    for (const log of sireData.doseLogs) {
      map.set(log.date, log.taken);
    }
    return map;
  }, [sireData?.doseLogs]);

  const calendarMinDate = sireData?.treatment.startDate;
  const calendarMaxDate = sireData?.treatment.nextControlDate ?? dayjs().format('YYYY-MM-DD');
  const today = dayjs().format('YYYY-MM-DD');

  const renderDay = useCallback(
    (dateStr: string) => {
      const day = dayjs(dateStr).date();

      // Only show indicators within the treatment window and up to today
      const inRange = calendarMinDate && dateStr >= calendarMinDate && dateStr <= today && dateStr <= calendarMaxDate;
      if (!inRange) {
        return <DayCell>{day}</DayCell>;
      }

      const taken = doseLogMap.get(dateStr);
      const isTaken = taken === true;

      return (
        <Indicator color={isTaken ? 'green' : 'red'} size={8} offset={-2}>
          <DayCell>{day}</DayCell>
        </Indicator>
      );
    },
    [doseLogMap, calendarMinDate, calendarMaxDate, today]
  );

  return (
    <Stack gap="xl">
      <Section>
        <FormHeader>
          <StyledTitle order={1} mb="md">
            {t('overview.basic_info')}
          </StyledTitle>
        </FormHeader>
        <FormCard>
          {formattedBirth && (
            <FieldRow label={`${t('overview.birth_date')}:`}>
              <Text>
                {formattedBirth}
                {age !== null && ` (${t('overview.years_old', { age })})`}
              </Text>
            </FieldRow>
          )}

          <FieldRow label={`${t('overview.insurance')}:`}>
            <MedicareDisplay patient={patient} />
          </FieldRow>

          {patient.personalData?.gender && (
            <FieldRow label={`${t('overview.gender')}:`}>
              <Text>
                {patient.personalData.gender === 'M'
                  ? t('overview.gender_male')
                  : patient.personalData.gender === 'F'
                    ? t('overview.gender_female')
                    : t('overview.gender_other')}
              </Text>
            </FieldRow>
          )}

          {patient.personalData?.documentValue && (
            <FieldRow label={`${t('overview.document')}:`}>
              <Text>
                {patient.personalData.documentType && `${patient.personalData.documentType} `}
                {patient.personalData.documentValue}
              </Text>
            </FieldRow>
          )}

          {patient.personalData?.nationality && (
            <FieldRow label={`${t('overview.nationality')}:`}>
              <Text>
                {(t('countries', { returnObjects: true }) as Record<string, string>)[
                  patient.personalData.nationality
                ] ?? patient.personalData.nationality}
              </Text>
            </FieldRow>
          )}

          {patient.personalData?.maritalStatus && (
            <FieldRow label={`${t('overview.marital_status')}:`}>
              <Text>
                {(t('patients.marital_statuses', { returnObjects: true }) as Record<string, string>)[
                  patient.personalData.maritalStatus
                ] ?? patient.personalData.maritalStatus}
              </Text>
            </FieldRow>
          )}
        </FormCard>
      </Section>

      <Section>
        <FormHeader>
          <StyledTitle order={1} mb="md">
            {t('overview.last_evolution')}
          </StyledTitle>
        </FormHeader>
        <FormCard>
          <FieldRow>
            {lastEvolution ? (
              <Text style={{ whiteSpace: 'pre-wrap' }}>{lastEvolution}</Text>
            ) : (
              <Text c="dimmed">{t('overview.no_evolutions')}</Text>
            )}
          </FieldRow>
        </FormCard>
      </Section>

      {sireData && (
        <Section>
          <FormHeader>
            <StyledTitle order={1} mb="md">
              {t('sire.anticoagulation')}
            </StyledTitle>
          </FormHeader>

          <FormCard>
            <SireLayout>
              <CalendarContainer>
                <Calendar
                  defaultDate={calendarMaxDate ?? new Date()}
                  minDate={calendarMinDate}
                  maxDate={calendarMaxDate ?? dayjs().format('YYYY-MM-DD')}
                  renderDay={renderDay}
                  highlightToday
                  size="sm"
                  weekendDays={[]}
                  static
                  styles={{
                    day: { position: 'relative', cursor: 'default' },
                  }}
                />
              </CalendarContainer>

              <Stack gap={0} style={{ flex: 1 }}>
                <FieldRow label={t('sire.medication')} variant="stacked">
                  <Text>
                    {sireData.treatment.medication} ({sireData.treatment.tabletDoseMg} mg)
                  </Text>
                </FieldRow>
                <FieldRow label={t('sire.target_inr')} variant="stacked">
                  <Text>
                    Min: {sireData.treatment.targetInrMin} / Max: {sireData.treatment.targetInrMax}
                  </Text>
                </FieldRow>
                <FieldRow label={t('sire.start')} variant="stacked">
                  <Text>{dayjs(sireData.treatment.startDate).format('DD/MM/YYYY')}</Text>
                </FieldRow>

                {sireData.schedule && (
                  <FieldRow style={{ marginTop: 'auto' }}>
                    <SimpleGrid cols={7} spacing="xs" style={{ width: '100%' }}>
                      {WEEKDAY_KEYS.map((key, i) => (
                        <Stack key={key} gap={2} align="center">
                          <Text size="xs" c="dimmed" fw={500}>
                            {t(`sire.${WEEKDAY_I18N_KEYS[i]}`)}
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatDose(sireData.schedule!.schedule[key] ?? null)}
                          </Text>
                        </Stack>
                      ))}
                    </SimpleGrid>
                  </FieldRow>
                )}
              </Stack>
            </SireLayout>
          </FormCard>
        </Section>
      )}
    </Stack>
  );
}
