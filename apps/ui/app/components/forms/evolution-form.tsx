import { Text, Textarea, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { styled } from '~/stitches';

const FormContainer = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
  width: '100%',
});

const EvolutionCard = styled('div', {
  background: 'White',
  border: '1px solid var(--mantine-color-gray-2)',
  borderRadius: 'var(--mantine-radius-md)',
  overflow: 'hidden',
});

const FieldRow = styled('div', {
  display: 'flex',
  alignItems: 'flex-start',
  padding: '1rem',
  borderBottom: '1px solid var(--mantine-color-gray-2)',
  '&:last-child': {
    borderBottom: 'none',
  },
});

const Label = styled(Text, {
  width: '25%',
  color: 'var(--mantine-color-gray-6)',
  textAlign: 'right',
  marginRight: '1rem',
});

const StyledTextarea = styled(Textarea, {
  flex: 1,
  '& .mantine-Textarea-input': {
    border: 'none',
    padding: 0,
    height: 'auto',
    minHeight: '1.5rem',
    lineHeight: 1.75,
    '&:focus': {
      boxShadow: 'none',
    },
  },
});

const StyledTitle = styled(Title, {
  color: 'var(--mantine-color-blue-4)',
  fontWeight: 400,
});

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
        <EvolutionCard>
          <FieldRow>
            <Label>{t('forms.evolution_description_label')}:</Label>
            <StyledTextarea
              placeholder={t('forms.evolution_placeholder')}
              {...form.getInputProps('description')}
              readOnly={readOnly}
              autosize
            />
          </FieldRow>
        </EvolutionCard>
      </FormContainer>
    </form>
  );
}
