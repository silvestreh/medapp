import { Text, Tooltip, Group } from '@mantine/core';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useGet } from '~/components/provider';
import type { Patient, Prepaga } from '~/declarations';

interface MedicareDisplayProps {
  patient: Pick<Patient, 'medicareId' | 'medicare' | 'prepaga'>;
  size?: 'sm' | 'xs';
  fallback?: string;
}

export function MedicareDisplay({ patient, size = 'sm', fallback }: MedicareDisplayProps) {
  const { t } = useTranslation();
  const { medicareId, medicare, prepaga: preloaded } = patient;

  const { data: fetched } = useGet('prepagas', medicareId!, {
    enabled: !!medicareId && !preloaded,
  });

  const prepaga = (preloaded ?? fetched) as Prepaga | undefined;

  if (medicareId && prepaga) {
    return (
      <Text size={size}>
        {prepaga.shortName}
      </Text>
    );
  }

  if (medicareId && !prepaga) {
    return <Text size={size} c="dimmed">…</Text>;
  }

  if (!medicareId && medicare) {
    return (
      <Tooltip label={t('overview.unresolved_insurer')} withArrow>
        <Group gap={4} wrap="nowrap" style={{ cursor: 'default' }}>
          <TriangleAlert size={14} color="var(--mantine-color-yellow-6)" />
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

export function getMedicareLabel(patient: Pick<Patient, 'medicareId' | 'medicare' | 'prepaga'>): string {
  const { medicareId, medicare, prepaga } = patient;

  if (medicareId && prepaga) {
    return prepaga.shortName;
  }

  if (medicare) {
    return medicare;
  }

  return '';
}
