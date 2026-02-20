import { useEffect } from 'react';
import { useForm } from '@mantine/form';
import { Button, ActionIcon, Stack, Text as MantineText } from '@mantine/core';
import { Plus, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  FormContainer,
  FormCard,
  FieldRow,
  StyledSelect,
  StyledTitle,
  FormHeader,
  ItemHeader,
} from './styles';
import { MedicationSelector } from '~/components/medication-selector';

interface DrugAllergyEntry {
  drug: string;
  status: string;
}

interface DrugAllergyFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onChange: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function DrugAllergyForm({ initialData, onChange, readOnly }: DrugAllergyFormProps) {
  const { t } = useTranslation();

  const parseInitialValues = () => {
    const values = initialData?.values || {};
    const count = parseInt(values.al_m_count || '0', 10);
    const entries: DrugAllergyEntry[] = [];

    for (let i = 0; i < count; i++) {
      entries.push({
        drug: values[`al_m_droga_${i}`] || '',
        status: values[`al_m_estado_${i}`] || '',
      });
    }

    if (entries.length === 0 && !readOnly) {
      entries.push({ drug: '', status: '' });
    }

    return { entries };
  };

  const form = useForm({
    initialValues: parseInitialValues(),
  });

  useEffect(() => {
    if (!readOnly) {
      const resultValues: Record<string, string> = {
        al_m_count: form.values.entries.length.toString(),
      };

      form.values.entries.forEach((entry, i) => {
        resultValues[`al_m_droga_${i}`] = entry.drug;
        resultValues[`al_m_estado_${i}`] = entry.status;
      });

      const hasChanged = JSON.stringify(resultValues) !== JSON.stringify(initialData?.values);

      const isBlank =
        form.values.entries.length === 1 &&
        !form.values.entries[0].drug &&
        !form.values.entries[0].status;

      if (hasChanged && (initialData || !isBlank)) {
        onChange({
          type: 'alergias/medicamentos',
          values: resultValues,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values, onChange, readOnly, initialData]);

  const addEntry = () => {
    form.insertListItem('entries', { drug: '', status: '' });
  };

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle>{t('forms.drug_allergy_title')}</StyledTitle>
        {!readOnly && (
          <Button
            variant="light"
            leftSection={<Plus size={16} />}
            onClick={addEntry}
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
            {t('forms.drug_allergy_add')}
          </Button>
        )}
      </FormHeader>

      <Stack gap="md">
        {form.values.entries.map((_, index) => (
          <div key={index}>
            <ItemHeader>
              <MantineText c="gray.6">
                {t('forms.drug_allergy_item_title', { index: index + 1 })}
              </MantineText>
              {!readOnly && (
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={() => form.removeListItem('entries', index)}
                  disabled={form.values.entries.length === 1}
                >
                  <Trash size={16} />
                </ActionIcon>
              )}
            </ItemHeader>
            <FormCard>
              <FieldRow label={`${t('forms.drug_allergy_drug')}:`}>
                <MedicationSelector
                  value={form.values.entries[index].drug}
                  onChange={val => form.setFieldValue(`entries.${index}.drug`, val)}
                  readOnly={readOnly}
                  placeholder={t('forms.drug_allergy_drug_placeholder')}
                />
              </FieldRow>
              <FieldRow label={`${t('forms.drug_allergy_status')}:`}>
                <StyledSelect
                  data={[
                    { value: 'sospechado', label: t('forms.drug_allergy_suspected') },
                    { value: 'confirmado', label: t('forms.drug_allergy_confirmed') },
                  ]}
                  placeholder={t('common.select')}
                  {...form.getInputProps(`entries.${index}.status`)}
                  readOnly={readOnly}
                  clearable
                />
              </FieldRow>
            </FormCard>
          </div>
        ))}
      </Stack>
    </FormContainer>
  );
}
