import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { FormContainer, FormCard, FieldRow, Label, StyledTextarea, StyledTitle } from '~/components/forms/styles';

interface EvolutionFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onSubmit: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function EvolutionForm({ initialData, onSubmit, readOnly }: EvolutionFormProps) {
  const { t } = useTranslation();

  const form = useForm({
    initialValues: {
      description: initialData?.values?.evo_descripcion || '',
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    onSubmit({
      type: 'general/evolucion_consulta_internacion',
      values: {
        evo_descripcion: values.description,
      },
    });
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <FormContainer>
        <StyledTitle order={1}>{t('forms.evolution_title')}</StyledTitle>
        <FormCard>
          <FieldRow>
            <Label>{t('forms.evolution_description_label')}:</Label>
            <StyledTextarea
              placeholder={t('forms.evolution_placeholder')}
              {...form.getInputProps('description')}
              readOnly={readOnly}
              autosize
              minRows={3}
            />
          </FieldRow>
        </FormCard>
      </FormContainer>
    </form>
  );
}
