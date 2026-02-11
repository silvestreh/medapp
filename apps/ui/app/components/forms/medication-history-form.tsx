import { useEffect } from 'react';
import { useForm } from '@mantine/form';
import { useDebouncedValue } from '@mantine/hooks';
import { Button, ActionIcon, Stack, Text as MantineText } from '@mantine/core';
import { Plus, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  FormContainer,
  FormCard,
  FieldRow,
  Label,
  StyledTextarea,
  StyledTitle,
  FormHeader,
  ItemHeader,
  StyledDateInput,
  StyledSelect,
  TriStateCheckbox,
} from './styles';
import { MedicationSelector } from '~/components/medication-selector';

interface MedicationHistoryEntry {
  droga: string;
  ant_fecha: Date | null;
  efectivo: boolean | 'indeterminate';
  efecto_adverso: string;
  ant_comments: string;
}

interface MedicationHistoryFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onChange: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function MedicationHistoryForm({ initialData, onChange, readOnly }: MedicationHistoryFormProps) {
  const { t } = useTranslation();

  const parseInitialValues = () => {
    const values = initialData?.values || {};
    const count = parseInt(values.ant_med_count || '0', 10);
    const medications: MedicationHistoryEntry[] = [];

    const parseTriState = (val?: string): boolean | 'indeterminate' => {
      if (val === 'si' || val === 'on') return true;
      if (val === 'no' || val === 'off') return false;
      return 'indeterminate';
    };

    for (let i = 0; i < count; i++) {
      const dateStr = values[`ant_fecha_${i}`];
      medications.push({
        droga: values[`droga_${i}`] || '',
        ant_fecha: dateStr ? new Date(dateStr) : null,
        efectivo: parseTriState(values[`efectivo_${i}`]),
        efecto_adverso: values[`efecto_adverso_${i}`] || '',
        ant_comments: values[`ant_comments_${i}`] || '',
      });
    }

    return {
      medications: medications.length > 0 ? medications : [],
    };
  };

  const form = useForm({
    initialValues: parseInitialValues(),
  });

  const [debouncedValues] = useDebouncedValue(form.values, 500);

  useEffect(() => {
    if (!readOnly) {
      const resultValues: Record<string, string> = {
        ant_med_count: debouncedValues.medications.length.toString(),
      };

      debouncedValues.medications.forEach((med, i) => {
        resultValues[`droga_${i}`] = med.droga;
        resultValues[`ant_fecha_${i}`] = med.ant_fecha ? med.ant_fecha.toISOString() : '';
        if (med.efectivo === true) resultValues[`efectivo_${i}`] = 'si';
        else if (med.efectivo === false) resultValues[`efectivo_${i}`] = 'no';
        else resultValues[`efectivo_${i}`] = '';
        resultValues[`efecto_adverso_${i}`] = med.efecto_adverso;
        resultValues[`ant_comments_${i}`] = med.ant_comments;
      });

      const hasChanged = JSON.stringify(resultValues) !== JSON.stringify(initialData?.values);
      const hasData = debouncedValues.medications.length > 0;

      if (hasChanged && (initialData || hasData)) {
        onChange({
          type: 'antecedentes/medicamentosos',
          values: resultValues,
        });
      }
    }
  }, [debouncedValues, onChange, readOnly, initialData]);

  const addMedication = () => {
    form.insertListItem('medications', {
      droga: '',
      ant_fecha: null,
      efectivo: 'indeterminate',
      efecto_adverso: '',
      ant_comments: '',
    });
  };

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle>{t('forms.medication_history_title')}</StyledTitle>
        {!readOnly && (
          <Button
            variant="light"
            leftSection={<Plus size={16} />}
            onClick={addMedication}
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
            {t('forms.medication_history_add')}
          </Button>
        )}
      </FormHeader>

      <Stack gap="md">
        {form.values.medications.map((_, index) => (
          <>
            <ItemHeader>
              <MantineText c="gray.6">{t('forms.medication_history_item_number', { number: index + 1 })}</MantineText>
              {!readOnly && (
                <ActionIcon color="red" variant="subtle" onClick={() => form.removeListItem('medications', index)}>
                  <Trash size={16} />
                </ActionIcon>
              )}
            </ItemHeader>
            <FormCard key={index}>
              <FieldRow>
                <Label>{t('forms.medication_history_drug')}:</Label>
                <MedicationSelector
                  value={form.values.medications[index].droga}
                  onChange={val => form.setFieldValue(`medications.${index}.droga`, val)}
                  readOnly={readOnly}
                  placeholder={t('forms.medication_history_drug_placeholder')}
                />
              </FieldRow>

              <FieldRow>
                <Label>{t('forms.medication_history_date')}:</Label>
                <StyledDateInput
                  readOnly={readOnly}
                  placeholder={t('forms.medication_history_date_placeholder')}
                  {...form.getInputProps(`medications.${index}.ant_fecha`)}
                  clearable
                />
              </FieldRow>

              <FieldRow>
                <Label>{t('forms.medication_history_effective')}:</Label>
                <TriStateCheckbox readOnly={readOnly} {...form.getInputProps(`medications.${index}.efectivo`)} />
              </FieldRow>

              <FieldRow>
                <Label>{t('forms.medication_history_adverse_effect')}:</Label>
                <StyledSelect
                  readOnly={readOnly}
                  placeholder={t('common.select')}
                  data={[
                    { value: 'no', label: t('common.no') },
                    { value: 'si', label: t('common.yes') },
                    { value: 'sospechado', label: t('forms.medication_history_adverse_effect_suspected') },
                  ]}
                  {...form.getInputProps(`medications.${index}.efecto_adverso`)}
                  variant="unstyled"
                  flex={1}
                  styles={{
                    input: {
                      fontSize: 'var(--mantine-font-size-sm)',
                      cursor: readOnly ? 'default' : 'pointer',
                    },
                  }}
                />
              </FieldRow>

              <FieldRow>
                <Label>{t('forms.medication_history_comments')}:</Label>
                <StyledTextarea
                  readOnly={readOnly}
                  placeholder={t('forms.medication_history_comments_placeholder')}
                  {...form.getInputProps(`medications.${index}.ant_comments`)}
                  autosize
                  minRows={1}
                />
              </FieldRow>
            </FormCard>
          </>
        ))}
      </Stack>
    </FormContainer>
  );
}
