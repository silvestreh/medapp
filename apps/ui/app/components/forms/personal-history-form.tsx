import { ActionIcon, Button, Stack, Text, Textarea, Title } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { Plus, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { styled } from '~/stitches';
import { Icd10Selector } from '~/components/icd10-selector';

const FormContainer = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
  width: '100%',
});

const HistoryItem = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

const HistoryCard = styled('div', {
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

const StyledDateInput = styled(DateInput, {
  flex: 1,
  '& .mantine-DateInput-input': {
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

const StyledTitle = styled(Title, {
  color: 'var(--mantine-color-blue-4)',
  fontWeight: 400,
});

const FormHeader = styled('div', {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
});

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
  onSubmit: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function PersonalHistoryForm({ initialData, onSubmit, readOnly }: PersonalHistoryFormProps) {
  const { t } = useTranslation();

  const parseInitialValues = () => {
    if (!initialData || !initialData.values) {
      return [{ issueId: '', date: null, description: '' }];
    }

    const count = parseInt(initialData.values.antecedente_count || '0', 10);
    const items: PersonalHistoryItem[] = [];

    for (let i = 0; i < count; i++) {
      const dateStr = initialData.values[`fecha_antecedente_${i}`];
      items.push({
        issueId: initialData.values[`antecedente_${i}`] || '',
        date: dateStr ? dayjs(dateStr).toDate() : null,
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

  const handleSubmit = (values: typeof form.values) => {
    const resultValues: Record<string, string> = {
      antecedente_count: values.items.length.toString(),
    };

    values.items.forEach((item, index) => {
      resultValues[`antecedente_${index}`] = item.issueId;
      resultValues[`fecha_antecedente_${index}`] = item.date ? dayjs(item.date).format('YYYY-MM-DD') : '';
      resultValues[`antecedente_descripcion_${index}`] = item.description;
    });

    onSubmit({
      type: 'antecedentes/personales',
      values: resultValues,
    });
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <FormContainer>
        <FormHeader>
          <StyledTitle order={1}>{t('forms.personal_history_title')}</StyledTitle>
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
            <HistoryItem key={index}>
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
              <HistoryCard>
                <FieldRow>
                  <Label>{t('forms.personal_history_label')}:</Label>
                  <Icd10Selector
                    value={form.values.items[index].issueId}
                    onChange={val => form.setFieldValue(`items.${index}.issueId`, val)}
                    placeholder={t('forms.personal_history_placeholder_search')}
                    readOnly={readOnly}
                  />
                </FieldRow>
                <FieldRow>
                  <Label>{t('forms.personal_history_date')}:</Label>
                  <StyledDateInput
                    placeholder={t('forms.personal_history_placeholder_date')}
                    {...form.getInputProps(`items.${index}.date`)}
                    readOnly={readOnly}
                    valueFormat="DD/MM/YYYY"
                    clearable={!readOnly}
                  />
                </FieldRow>
                <FieldRow>
                  <Label>{t('forms.personal_history_description')}:</Label>
                  <StyledTextarea
                    placeholder={t('forms.personal_history_placeholder_description')}
                    {...form.getInputProps(`items.${index}.description`)}
                    readOnly={readOnly}
                    autosize
                    minRows={1}
                  />
                </FieldRow>
              </HistoryCard>
            </HistoryItem>
          ))}
        </Stack>
      </FormContainer>
    </form>
  );
}
