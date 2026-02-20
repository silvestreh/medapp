import { Text, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import type { Patient } from '~/declarations';
import { styled } from '~/styled-system/jsx';
import { StyledTitle, FormCard, FieldRow, FormHeader } from '~/components/forms/styles';

interface PatientOverviewProps {
  patient: Patient;
  encounters: any[];
}

const Section = styled('div', {
  base: {
    marginBottom: '1.5rem',
  },
});

function getAge(birthDate: string | Date | null | undefined): number | null {
  if (!birthDate) return null;
  const date = dayjs(birthDate);
  if (!date.isValid()) return null;
  return dayjs().diff(date, 'year');
}

function formatBirthDate(birthDate: string | Date | null | undefined): string | null {
  if (!birthDate) return null;
  const date = dayjs(birthDate);
  if (!date.isValid()) return null;
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

export function PatientOverview({ patient, encounters }: PatientOverviewProps) {
  const { t } = useTranslation();
  const birthDate = (patient.personalData as any).birthDate;
  const age = getAge(birthDate);
  const formattedBirth = formatBirthDate(birthDate);
  const lastEvolution = getLastEvolution(encounters);

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

          {patient.medicare && (
            <FieldRow label={`${t('overview.insurance')}:`}>
              {(() => {
                const parts = patient.medicare.split('/');
                if (parts.length >= 2) {
                  return (
                    <Stack gap={0}>
                      <Text size="sm">{parts[0].trim()}</Text>
                      <Text size="xs" c="dimmed">
                        {parts.slice(1).join('/').trim()}
                      </Text>
                    </Stack>
                  );
                }
                return <Text>{patient.medicare}</Text>;
              })()}
            </FieldRow>
          )}

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
              <Text>{patient.personalData.nationality}</Text>
            </FieldRow>
          )}

          {patient.personalData?.maritalStatus && (
            <FieldRow label={`${t('overview.marital_status')}:`}>
              <Text>{patient.personalData.maritalStatus}</Text>
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
    </Stack>
  );
}
