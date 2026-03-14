import { Text, Tooltip, Group } from '@mantine/core';
import { WarningIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import type { Patient } from '~/declarations';

interface MedicareDisplayProps {
  patient: Pick<Patient, 'medicareId' | 'medicare' | 'insurer'>;
  size?: 'sm' | 'xs';
  fallback?: string;
}

export function MedicareDisplay({ patient, size = 'sm', fallback }: MedicareDisplayProps) {
  const { t } = useTranslation();
  const { medicareId, medicare, insurer } = patient;

  if (medicareId && insurer) {
    return <Text size={size}>{insurer.shortName}</Text>;
  }

  if (medicareId && !insurer) {
    return (
      <Text size={size} c="dimmed">
        …
      </Text>
    );
  }

  if (!medicareId && medicare) {
    return (
      <Tooltip label={t('overview.unresolved_insurer')} withArrow>
        <Group gap={4} wrap="nowrap" style={{ cursor: 'default' }}>
          <WarningIcon size={14} color="var(--mantine-color-yellow-6)" />
          <Text size={size} c="dimmed">
            {medicare}
          </Text>
        </Group>
      </Tooltip>
    );
  }

  return (
    <Text size={size} c="dimmed">
      {fallback ?? t('overview.private')}
    </Text>
  );
}

export function getMedicareLabel(patient: Pick<Patient, 'medicareId' | 'medicare' | 'insurer'>): string {
  const { medicareId, medicare, insurer } = patient;

  if (medicareId && insurer) {
    return insurer.shortName;
  }

  if (medicare) {
    return medicare;
  }

  return '';
}
