import { ActionIcon, Button, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Plus, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  FormContainer,
  FormCard,
  FieldRow,
  Label,
  StyledTextInput,
  StyledTextarea,
  StyledTitle,
  FormHeader,
  ItemHeader,
} from '~/components/forms/styles';

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
            <div key={index}>
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
              <FormCard>
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
              </FormCard>
            </div>
          ))}
        </Stack>
      </FormContainer>
    </form>
  );
}
