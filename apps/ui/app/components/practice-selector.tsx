import { useCallback, useMemo } from 'react';
import { Checkbox, Group, Stack, Text, Badge, Tooltip } from '@mantine/core';
import { WarningIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

export interface Practice {
  id: string;
  title: string;
  description: string;
  isSystem: boolean;
  systemKey: string | null;
}

export interface PracticeCodeRecord {
  id: string;
  practiceId: string;
  userId: string;
  insurerId: string;
  code: string;
}

interface SelectedPractice {
  practice: Practice;
  code: string | null;
}

interface PracticeSelectorProps {
  practices: Practice[];
  codes: PracticeCodeRecord[];
  insurerId: string | undefined;
  selectedPracticeIds: string[];
  onChange: (selectedIds: string[]) => void;
  max?: number;
}

function getCodeForPractice(
  practiceId: string,
  codes: PracticeCodeRecord[],
  insurerId: string | undefined
): string | null {
  if (!insurerId) return null;
  const match = codes.find(c => c.practiceId === practiceId && c.insurerId === insurerId);
  return match?.code || null;
}

export function usePracticeSelection(
  practices: Practice[],
  codes: PracticeCodeRecord[],
  insurerId: string | undefined,
  selectedPracticeIds: string[]
): SelectedPractice[] {
  return useMemo(() => {
    return selectedPracticeIds
      .map(id => {
        const practice = practices.find(p => p.id === id);
        if (!practice) return null;
        const code = getCodeForPractice(practice.id, codes, insurerId);
        return { practice, code };
      })
      .filter((sp): sp is SelectedPractice => sp !== null);
  }, [practices, codes, insurerId, selectedPracticeIds]);
}

export function formatPracticesForOrder(selectedPractices: SelectedPractice[]): string {
  return selectedPractices
    .map(({ practice, code }) => {
      if (code) {
        return `${practice.description} – ${code}`;
      }
      return `${practice.description} (sin código)`;
    })
    .join('\n');
}

export function PracticeSelector({
  practices,
  codes,
  insurerId,
  selectedPracticeIds,
  onChange,
  max = 3,
}: PracticeSelectorProps) {
  const { t } = useTranslation();

  const practicesWithCodes = useMemo(() => {
    return practices.map(practice => ({
      practice,
      code: getCodeForPractice(practice.id, codes, insurerId),
    }));
  }, [practices, codes, insurerId]);

  const handleToggle = useCallback(
    (practiceId: string) => {
      if (selectedPracticeIds.includes(practiceId)) {
        onChange(selectedPracticeIds.filter(id => id !== practiceId));
      } else if (selectedPracticeIds.length < max) {
        onChange([...selectedPracticeIds, practiceId]);
      }
    },
    [selectedPracticeIds, onChange, max]
  );

  if (practices.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('recetario.no_practices', 'No hay prácticas configuradas.')}
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        {t('recetario.select_practices', 'Prácticas')}
        <Text span size="xs" c="dimmed" ml={4}>
          ({t('recetario.practices_max', { count: max, defaultValue: `máx. ${max}` })})
        </Text>
      </Text>
      {practicesWithCodes.map(({ practice, code }) => {
        const isSelected = selectedPracticeIds.includes(practice.id);
        const isDisabled = !isSelected && selectedPracticeIds.length >= max;
        const hasNoCode = !code;

        return (
          <Group
            key={practice.id}
            gap="sm"
            p="xs"
            style={{
              borderRadius: 'var(--mantine-radius-sm)',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              backgroundColor: isSelected ? 'var(--mantine-primary-color-0)' : undefined,
            }}
            onClick={() => !isDisabled && handleToggle(practice.id)}
          >
            <Checkbox
              checked={isSelected}
              onChange={() => handleToggle(practice.id)}
              disabled={isDisabled}
              styles={{ input: { cursor: isDisabled ? 'not-allowed' : 'pointer' } }}
            />
            <Stack gap={0} style={{ flex: 1 }}>
              <Text size="sm" fw={500}>
                {practice.title}
              </Text>
              <Text size="xs" c="dimmed">
                {practice.description}
              </Text>
            </Stack>
            {code && (
              <Badge variant="light" size="sm">
                {code}
              </Badge>
            )}
            {isSelected && hasNoCode && (
              <Tooltip label={t('recetario.practice_no_code', 'Sin código para esta prepaga')}>
                <WarningIcon size={16} color="var(--mantine-color-orange-6)" />
              </Tooltip>
            )}
          </Group>
        );
      })}
    </Stack>
  );
}
