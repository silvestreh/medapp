import { useEffect } from 'react';
import { useForm } from '@mantine/form';
import { Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import {
  FormContainer,
  FormCard,
  FieldRow,
  Label,
  StyledSelect,
  StyledTextInput,
  StyledTitle,
  FormHeader,
  IndentedSection,
  TriStateCheckbox,
} from './styles';

interface AsthmaFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onChange: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function AsthmaForm({ initialData, onChange, readOnly }: AsthmaFormProps) {
  const { t } = useTranslation();

  const parseTriState = (val?: string): boolean | 'indeterminate' => {
    if (val === 'si' || val === 'on') return true;
    if (val === 'no' || val === 'off') return false;
    return 'indeterminate';
  };

  const parseInitialValues = (data?: AsthmaFormProps['initialData']) => {
    const v = data?.values || {};
    return {
      severidad_clinica: v.severidad_clinica || '',
      toggle_sintomas: parseTriState(v.toggle_sintomas),
      frecuencia_anual: v.frecuencia_anual || '',
      tipo_exacerbaciones: v.tipo_exacerbaciones || '',
      toggle_sintoma_nocturno: parseTriState(v.toggle_sintoma_nocturno),
      frecuencia_nocturna: v.frecuencia_nocturna || '',
      pef_teorico: v.pef_teorico || '',
      pef_variabilidad: v.pef_variabilidad || '',
      fev_teorico: v.fev_teorico || '',
      fev_reversibilidad: v.fev_reversibilidad || '',
    };
  };

  const form = useForm({
    initialValues: parseInitialValues(initialData),
  });

  useEffect(() => {
    if (!readOnly) {
      const legacy: Record<string, string> = {};
      Object.entries(form.values).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          legacy[key] = value ? 'si' : 'no';
        } else if (value === 'indeterminate') {
          legacy[key] = '';
        } else if (typeof value === 'string' && value !== '') {
          legacy[key] = value;
        }
      });

      const hasChanged = JSON.stringify(legacy) !== JSON.stringify(initialData?.values);

      const hasData = Object.values(form.values).some(val => {
        if (typeof val === 'string') return val !== '' && val !== 'indeterminate';
        if (val === true || val === false) return true;
        return false;
      });

      if (hasChanged && (initialData || hasData)) {
        onChange({
          type: 'alergias/asma',
          values: legacy,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values, onChange, readOnly, initialData]);

  const hasSintomas = form.values.toggle_sintomas === true;
  const hasSintomaNoct = form.values.toggle_sintoma_nocturno === true;

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle order={1}>{t('forms.asthma_title')}</StyledTitle>
      </FormHeader>

      {/* General */}
      <Text fw={500} size="sm" c="gray.7" px="md">
        {t('forms.asthma_general')}
      </Text>
      <FormCard>
        <FieldRow>
          <Label>{t('forms.asthma_clinical_severity')}:</Label>
          <StyledSelect
            data={[
              { value: 'nhlbi', label: 'NHLBI' },
              { value: 'gina', label: 'GINA' },
            ]}
            placeholder={t('common.select')}
            {...form.getInputProps('severidad_clinica')}
            readOnly={readOnly}
            clearable
          />
        </FieldRow>

        <FieldRow checkbox>
          <TriStateCheckbox
            label={t('forms.asthma_has_symptoms')}
            {...form.getInputProps('toggle_sintomas')}
            readOnly={readOnly}
          />
        </FieldRow>
        {hasSintomas && (
          <IndentedSection>
            <FieldRow>
              <Label>{t('forms.asthma_annual_frequency')}:</Label>
              <StyledSelect
                data={[
                  { value: '1', label: '1' },
                  { value: '2a4', label: '2 a 4' },
                  { value: '4a8', label: '4 a 8' },
                  { value: '8+', label: t('forms.asthma_frequency_8_plus') },
                ]}
                placeholder={t('common.select')}
                {...form.getInputProps('frecuencia_anual')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.asthma_exacerbation_type')}:</Label>
              <StyledSelect
                data={[
                  { value: 'actividad_sueno', label: t('forms.asthma_exacerbation_activity_sleep') },
                  { value: 'pueden_actividad_sueno', label: t('forms.asthma_exacerbation_may_activity_sleep') },
                  { value: 'breves', label: t('forms.asthma_exacerbation_brief') },
                  { value: 'prolongadas', label: t('forms.asthma_exacerbation_prolonged') },
                ]}
                placeholder={t('common.select')}
                {...form.getInputProps('tipo_exacerbaciones')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
          </IndentedSection>
        )}

        <FieldRow checkbox>
          <TriStateCheckbox
            label={t('forms.asthma_nocturnal_symptoms')}
            {...form.getInputProps('toggle_sintoma_nocturno')}
            readOnly={readOnly}
          />
        </FieldRow>
        {hasSintomaNoct && (
          <IndentedSection>
            <FieldRow>
              <Label>{t('forms.asthma_nocturnal_frequency')}:</Label>
              <StyledTextInput type="number" {...form.getInputProps('frecuencia_nocturna')} readOnly={readOnly} />
            </FieldRow>
          </IndentedSection>
        )}
      </FormCard>

      {/* PEF */}
      <Text fw={500} size="sm" c="gray.7" px="md" mt="md">
        {t('forms.asthma_pef_title')}
      </Text>
      <FormCard>
        <FieldRow>
          <Label>{t('forms.asthma_theoretical')}:</Label>
          <StyledSelect
            data={[
              { value: '60-', label: '≤ 60%' },
              { value: '60a80', label: '60-80%' },
              { value: '80+', label: '≥ 80%' },
            ]}
            placeholder={t('common.select')}
            {...form.getInputProps('pef_teorico')}
            readOnly={readOnly}
            clearable
          />
        </FieldRow>
        <FieldRow>
          <Label>{t('forms.asthma_variability')}:</Label>
          <StyledSelect
            data={[
              { value: '20-', label: '< 20%' },
              { value: '20a30', label: '20-30%' },
              { value: '30+', label: '> 30%' },
            ]}
            placeholder={t('common.select')}
            {...form.getInputProps('pef_variabilidad')}
            readOnly={readOnly}
            clearable
          />
        </FieldRow>
      </FormCard>

      {/* FEV1 */}
      <Text fw={500} size="sm" c="gray.7" px="md" mt="md">
        {t('forms.asthma_fev1_title')}
      </Text>
      <FormCard>
        <FieldRow>
          <Label>{t('forms.asthma_theoretical')}:</Label>
          <StyledSelect
            data={[
              { value: '60-', label: '≤ 60%' },
              { value: '60a80', label: '60-80%' },
              { value: '80+', label: '≥ 80%' },
            ]}
            placeholder={t('common.select')}
            {...form.getInputProps('fev_teorico')}
            readOnly={readOnly}
            clearable
          />
        </FieldRow>
        <FieldRow>
          <Label>{t('forms.asthma_reversibility')}:</Label>
          <StyledSelect
            data={[
              { value: 'no', label: t('common.no') },
              { value: '12+', label: '> 12%' },
              { value: '20+', label: '> 20%' },
            ]}
            placeholder={t('common.select')}
            {...form.getInputProps('fev_reversibilidad')}
            readOnly={readOnly}
            clearable
          />
        </FieldRow>
      </FormCard>
    </FormContainer>
  );
}
