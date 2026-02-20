import { ActionIcon, Button, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Plus, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Icd10Selector } from '~/components/icd10-selector';
import {
  FormContainer,
  FormCard,
  FieldRow,
  StyledTextarea,
  StyledDateInput,
  StyledTitle,
  FormHeader,
  ItemHeader,
} from './styles';

dayjs.extend(customParseFormat);

interface PersonalHistoryItem {
  issueId: string;
  date: Date | null;
  description: string;
}

interface PersonalHistoryFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onChange: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function PersonalHistoryForm({ initialData, onChange, readOnly }: PersonalHistoryFormProps) {
  const { t } = useTranslation();

  const parseInitialValues = () => {
    if (!initialData || !initialData.values) {
      return [{ issueId: '', date: null, description: '' }];
    }

    const count = parseInt(initialData.values.antecedente_count || '0', 10);
    const items: PersonalHistoryItem[] = [];

    for (let i = 0; i < count; i++) {
      const dateStr = initialData.values[`fecha_antecedente_${i}`];
      const parsed = dateStr ? dayjs(dateStr, 'DD/MM/YYYY') : null;
      items.push({
        issueId: initialData.values[`antecedente_${i}`] || '',
        date: parsed?.isValid() ? parsed.toDate() : null,
        description: initialData.values[`antecedente_descripcion_${i}`] || '',
      });
    }

    return items.length > 0 ? items : [{ issueId: '', date: null, description: '' }];
  };

  const form = useForm({
    initialValues: {
      items: parseInitialValues(),
    },
  });

  useEffect(() => {
    if (!readOnly) {
      const resultValues: Record<string, string> = {
        antecedente_count: form.values.items.length.toString(),
      };

      form.values.items.forEach((item, index) => {
        resultValues[`antecedente_${index}`] = item.issueId;
        resultValues[`fecha_antecedente_${index}`] = item.date ? dayjs(item.date).format('DD/MM/YYYY') : '';
        resultValues[`antecedente_descripcion_${index}`] = item.description;
      });

      const hasChanged = JSON.stringify(resultValues) !== JSON.stringify(initialData?.values);

      // If we don't have initial data, only trigger if we have something meaningful to report
      const hasData = form.values.items.some(item => item.issueId || item.date || item.description);

      if (hasChanged && (initialData || hasData)) {
        onChange({
          type: 'antecedentes/personales',
          values: resultValues,
        });
      }
    }
  }, [form.values, onChange, readOnly, initialData]);

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle>{t('forms.personal_history_title')}</StyledTitle>
        {!readOnly && (
          <Button
            variant="light"
            leftSection={<Plus size={16} />}
            onClick={() => form.insertListItem('items', { issueId: '', date: null, description: '' })}
            radius="xl"
            color="gray"
            styles={{
              root: {
                backgroundColor: 'var(--mantine-color-gray-1)',
                color: 'var(--mantine-color-gray-7)',
                border: '1px solid var(--mantine-color-gray-2)',
              },
            }}
          >
            {t('forms.personal_history_add')}
          </Button>
        )}
      </FormHeader>

      <Stack gap="lg">
        {form.values.items.map((_, index) => (
          <div key={index}>
            <ItemHeader>
              <Text size="xl" c="dimmed" fw={500}>
                {t('forms.personal_history_item_title', { index: index + 1 })}
              </Text>
              {!readOnly && form.values.items.length > 1 && (
                <ActionIcon color="red" variant="subtle" onClick={() => form.removeListItem('items', index)}>
                  <Trash size={16} />
                </ActionIcon>
              )}
            </ItemHeader>
            <FormCard>
              <FieldRow label={`${t('forms.personal_history_label')}:`}>
                <Icd10Selector
                  value={form.values.items[index].issueId}
                  onChange={val => form.setFieldValue(`items.${index}.issueId`, val as string)}
                  placeholder={t('forms.personal_history_placeholder_search')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow label={`${t('forms.personal_history_date')}:`}>
                <StyledDateInput
                  placeholder={t('forms.personal_history_placeholder_date')}
                  {...form.getInputProps(`items.${index}.date`)}
                  readOnly={readOnly}
                  rawValue={initialData?.values?.[`fecha_antecedente_${index}`]}
                  valueFormat="DD/MM/YYYY"
                  clearable={!readOnly}
                />
              </FieldRow>
              <FieldRow label={`${t('forms.personal_history_description')}:`}>
                <StyledTextarea
                  placeholder={t('forms.personal_history_placeholder_description')}
                  {...form.getInputProps(`items.${index}.description`)}
                  readOnly={readOnly}
                  autosize
                  minRows={1}
                />
              </FieldRow>
            </FormCard>
          </div>
        ))}
      </Stack>
    </FormContainer>
  );
}
