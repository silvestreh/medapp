import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { FormContainer, FormCard, FormHeader, FieldRow, Label, StyledTextarea, StyledTitle } from './styles';

interface EvolutionFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onChange: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function EvolutionForm({ initialData, onChange, readOnly }: EvolutionFormProps) {
  const { t } = useTranslation();

  const form = useForm({
    initialValues: {
      description: initialData?.values?.evo_descripcion || '',
    },
  });

  useEffect(() => {
    if (!readOnly) {
      const resultValues = {
        evo_descripcion: form.values.description,
      };

      const hasChanged = JSON.stringify(resultValues) !== JSON.stringify(initialData?.values);

      // If we don't have initial data, only trigger if we have something meaningful to report
      const hasData = !!form.values.description;

      if (hasChanged && (initialData || hasData)) {
        onChange({
          type: 'general/evolucion_consulta_internacion',
          values: resultValues,
        });
      }
    }
  }, [form.values, onChange, readOnly, initialData]);

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle order={1}>{t('forms.evolution_title')}</StyledTitle>
      </FormHeader>
      <FormCard>
        <FieldRow>
          <Label>{t('forms.evolution_description_label')}:</Label>
          <StyledTextarea
            placeholder={t('forms.evolution_placeholder')}
            {...form.getInputProps('description')}
            readOnly={readOnly}
            autosize
          />
        </FieldRow>
      </FormCard>
    </FormContainer>
  );
}
