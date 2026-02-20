import { Button, Stack, ActionIcon } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Plus, Trash } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icd10Selector } from '~/components/icd10-selector';
import { FormContainer, FormCard, FieldRow, StyledTextarea, StyledTitle, FormHeader } from './styles';

interface EnfermedadActualFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onChange: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function CurrentIllnessForm({ initialData, onChange, readOnly }: EnfermedadActualFormProps) {
  const { t } = useTranslation();

  const parseInitialValues = () => {
    const values = initialData?.values || {};
    const symptoms: string[] = [];
    const count = parseInt(values.sintoma_count || '0', 10);
    for (let i = 0; i < count; i++) {
      symptoms.push(values[`sintoma_${i}`] || '');
    }

    return {
      symptoms: symptoms.length > 0 ? symptoms : [],
      notas_ap_resp: values.notas_ap_resp || '',
      notas_ap_cardio: values.notas_ap_cardio || '',
      notas_ap_digest: values.notas_ap_digest || '',
      notas_ap_uro: values.notas_ap_uro || '',
      notas_ap_loco: values.notas_ap_loco || '',
      notas_piel: values.notas_piel || '',
      notas_otro: values.notas_otro || '',
    };
  };

  const form = useForm({
    initialValues: parseInitialValues(),
  });

  useEffect(() => {
    if (!readOnly) {
      const resultValues: Record<string, string> = {
        sintoma_count: form.values.symptoms.length.toString(),
        notas_ap_resp: form.values.notas_ap_resp,
        notas_ap_cardio: form.values.notas_ap_cardio,
        notas_ap_digest: form.values.notas_ap_digest,
        notas_ap_uro: form.values.notas_ap_uro,
        notas_ap_loco: form.values.notas_ap_loco,
        notas_piel: form.values.notas_piel,
        notas_otro: form.values.notas_otro,
      };

      form.values.symptoms.forEach((s, i) => {
        resultValues[`sintoma_${i}`] = s;
      });

      // The user specifically asked for "sintoma": "" in the output.
      // I'll include it as the first symptom or empty string to match their requirement exactly,
      // while also keeping the indexed ones for legacy compatibility if needed.
      resultValues['sintoma'] = form.values.symptoms[0] || '';

      const hasChanged = JSON.stringify(resultValues) !== JSON.stringify(initialData?.values);
      const hasData =
        form.values.symptoms.some(s => s) || Object.values(form.values).some(v => typeof v === 'string' && v);

      if (hasChanged && (initialData || hasData)) {
        onChange({
          type: 'general/enfermedad_actual',
          values: resultValues,
        });
      }
    }
  }, [form.values, onChange, readOnly, initialData]);

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle>{t('forms.enfermedad_actual_title')}</StyledTitle>
        {!readOnly && (
          <Button
            variant="light"
            leftSection={<Plus size={16} />}
            onClick={() => form.insertListItem('symptoms', '')}
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
            {t('forms.enfermedad_actual_add_symptom')}
          </Button>
        )}
      </FormHeader>

      <Stack gap="md">
        {form.values.symptoms.length > 0 && (
          <FormCard>
            {form.values.symptoms.map((_, index) => (
              <FieldRow key={index} label={`${t('forms.enfermedad_actual_symptom')}:`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icd10Selector
                    value={form.values.symptoms[index]}
                    onChange={val => form.setFieldValue(`symptoms.${index}`, val as string)}
                    placeholder={t('forms.enfermedad_actual_symptom_placeholder')}
                    readOnly={readOnly}
                  />
                  {!readOnly && (
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => form.removeListItem('symptoms', index)}
                    >
                      <Trash size={16} />
                    </ActionIcon>
                  )}
                </div>
              </FieldRow>
            ))}
          </FormCard>
        )}

        <FormHeader>
          <StyledTitle c="gray">{t('forms.enfermedad_actual_notes_title')}</StyledTitle>
        </FormHeader>

        <FormCard>
          <FieldRow label={`${t('forms.enfermedad_actual_resp')}:`}>
            <StyledTextarea
              placeholder={t('forms.enfermedad_actual_notes_placeholder')}
              {...form.getInputProps('notas_ap_resp')}
              readOnly={readOnly}
              autosize
              minRows={1}
            />
          </FieldRow>
          <FieldRow label={`${t('forms.enfermedad_actual_cardio')}:`}>
            <StyledTextarea
              placeholder={t('forms.enfermedad_actual_notes_placeholder')}
              {...form.getInputProps('notas_ap_cardio')}
              readOnly={readOnly}
              autosize
              minRows={1}
            />
          </FieldRow>
          <FieldRow label={`${t('forms.enfermedad_actual_digest')}:`}>
            <StyledTextarea
              placeholder={t('forms.enfermedad_actual_notes_placeholder')}
              {...form.getInputProps('notas_ap_digest')}
              readOnly={readOnly}
              autosize
              minRows={1}
            />
          </FieldRow>
          <FieldRow label={`${t('forms.enfermedad_actual_uro')}:`}>
            <StyledTextarea
              placeholder={t('forms.enfermedad_actual_notes_placeholder')}
              {...form.getInputProps('notas_ap_uro')}
              readOnly={readOnly}
              autosize
              minRows={1}
            />
          </FieldRow>
          <FieldRow label={`${t('forms.enfermedad_actual_loco')}:`}>
            <StyledTextarea
              placeholder={t('forms.enfermedad_actual_notes_placeholder')}
              {...form.getInputProps('notas_ap_loco')}
              readOnly={readOnly}
              autosize
              minRows={1}
            />
          </FieldRow>
          <FieldRow label={`${t('forms.enfermedad_actual_piel')}:`}>
            <StyledTextarea
              placeholder={t('forms.enfermedad_actual_notes_placeholder')}
              {...form.getInputProps('notas_piel')}
              readOnly={readOnly}
              autosize
              minRows={1}
            />
          </FieldRow>
          <FieldRow label={`${t('forms.enfermedad_actual_otro')}:`}>
            <StyledTextarea
              placeholder={t('forms.enfermedad_actual_notes_placeholder')}
              {...form.getInputProps('notas_otro')}
              readOnly={readOnly}
              autosize
              minRows={1}
            />
          </FieldRow>
        </FormCard>
      </Stack>
    </FormContainer>
  );
}
