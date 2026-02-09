import { ActionIcon, Button, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Plus, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { styled } from '~/stitches';

const FormContainer = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
  width: '100%',
});

const ReasonItem = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

const ReasonCard = styled('div', {
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

const StyledTextInput = styled(TextInput, {
  flex: 1,

  '& .mantine-TextInput-input': {
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

const ItemHeader = styled('div', {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.5rem',
});

const FormHeader = styled('div', {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
});

interface ReasonValue {
  reason: string;
  description: string;
}

interface ReasonForConsultationFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onSubmit: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function ReasonForConsultationForm({ initialData, onSubmit, readOnly }: ReasonForConsultationFormProps) {
  const { t } = useTranslation();

  // Parse initial data if provided
  const parseInitialValues = () => {
    if (!initialData || !initialData.values) {
      return [{ reason: '', description: '' }];
    }

    const count = parseInt(initialData.values.consulta_intern_count || '0', 10);
    const reasons: ReasonValue[] = [];

    for (let i = 0; i < count; i++) {
      reasons.push({
        reason: initialData.values[`motivo_text_${i}`] || '',
        description: initialData.values[`motivo_descripcion_${i}`] || '',
      });
    }

    return reasons.length > 0 ? reasons : [{ reason: '', description: '' }];
  };

  const form = useForm({
    initialValues: {
      reasons: parseInitialValues(),
    },
    validate: {
      reasons: {
        reason: value => (value.trim().length === 0 ? t('common.required') : null),
      },
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    const resultValues: Record<string, string> = {
      consulta_intern_count: values.reasons.length.toString(),
    };

    values.reasons.forEach((item, index) => {
      resultValues[`motivo_text_${index}`] = item.reason;
      resultValues[`motivo_descripcion_${index}`] = item.description;
    });

    onSubmit({
      type: 'general/consulta_internacion',
      values: resultValues,
    });
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <FormContainer>
        <FormHeader>
          <StyledTitle order={1}>{t('forms.general/consulta_internacion')}</StyledTitle>
          {!readOnly && (
            <Button
              variant="light"
              leftSection={<Plus size={16} />}
              onClick={() => form.insertListItem('reasons', { reason: '', description: '' })}
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
              {t('forms.consulta_internacion_add')}
            </Button>
          )}
        </FormHeader>

        <Stack gap="lg">
          {form.values.reasons.map((_, index) => (
            <ReasonItem key={index}>
              <ItemHeader>
                <Text size="xl" c="dimmed" fw={500}>
                  {t('forms.consulta_internacion_title_item', { index: index + 1 })}
                </Text>
                {!readOnly && form.values.reasons.length > 1 && (
                  <ActionIcon color="red" variant="subtle" onClick={() => form.removeListItem('reasons', index)}>
                    <Trash size={16} />
                  </ActionIcon>
                )}
              </ItemHeader>
              <ReasonCard>
                <FieldRow>
                  <Label>{t('forms.consulta_internacion_reason')}:</Label>
                  <StyledTextInput
                    placeholder={t('forms.consulta_internacion_placeholder_reason')}
                    {...form.getInputProps(`reasons.${index}.reason`)}
                    readOnly={readOnly}
                  />
                </FieldRow>
                <FieldRow>
                  <Label>{t('forms.consulta_internacion_description')}:</Label>
                  <StyledTextarea
                    placeholder={t('forms.consulta_internacion_placeholder_description')}
                    {...form.getInputProps(`reasons.${index}.description`)}
                    readOnly={readOnly}
                    autosize
                    minRows={1}
                  />
                </FieldRow>
              </ReasonCard>
            </ReasonItem>
          ))}
        </Stack>
      </FormContainer>
    </form>
  );
}
