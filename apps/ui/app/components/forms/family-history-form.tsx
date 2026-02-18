import { ActionIcon, Button, Select, Table, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Plus, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { styled } from '~/styled-system/jsx';
import { Icd10Selector } from '~/components/icd10-selector';
import {
  FormContainer,
  StyledTitle,
  FormHeader,
  StyledTextInput,
  StyledSelect,
  TriStateCheckbox,
  FormCard,
  FieldRow,
  Label,
  ItemHeader,
} from './styles';

const MobileLayout = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',

    lg: {
      display: 'none',
    },
  },
});

const DesktopLayout = styled('div', {
  base: {
    display: 'none',

    lg: {
      display: 'block',
      marginLeft: '-2rem',
      width: 'calc(100% + 4rem)',
    },
  },
});

interface FamilyHistoryItem {
  relationship: string;
  isAlive: boolean | 'indeterminate';
  firstName: string;
  lastName: string;
  issueId: string;
}

interface FamilyHistoryFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onChange: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function FamilyHistoryForm({ initialData, onChange, readOnly }: FamilyHistoryFormProps) {
  const { t } = useTranslation();

  const relationshipOptions = [
    {
      group: t('forms.family_history_group_grandparents'),
      items: [
        { value: 'paternal_grandfather', label: t('forms.family_history_rel_paternal_grandfather') },
        { value: 'maternal_grandfather', label: t('forms.family_history_rel_maternal_grandfather') },
        { value: 'paternal_grandmother', label: t('forms.family_history_rel_paternal_grandmother') },
        { value: 'maternal_grandmother', label: t('forms.family_history_rel_maternal_grandmother') },
      ],
    },
    {
      group: t('forms.family_history_group_parents'),
      items: [
        { value: 'father', label: t('forms.family_history_rel_father') },
        { value: 'mother', label: t('forms.family_history_rel_mother') },
      ],
    },
    {
      group: t('forms.family_history_group_uncles'),
      items: [
        { value: 'uncle', label: t('forms.family_history_rel_uncle') },
        { value: 'aunt', label: t('forms.family_history_rel_aunt') },
      ],
    },
    {
      group: t('forms.family_history_group_siblings'),
      items: [
        { value: 'brother', label: t('forms.family_history_rel_brother') },
        { value: 'sister', label: t('forms.family_history_rel_sister') },
      ],
    },
    {
      group: t('forms.family_history_group_children'),
      items: [
        { value: 'son', label: t('forms.family_history_rel_son') },
        { value: 'daughter', label: t('forms.family_history_rel_daughter') },
      ],
    },
  ];

  const getRelationshipLabel = (value: string) => {
    for (const group of relationshipOptions) {
      const item = group.items.find(i => i.value === value);
      if (item) return item.label;
    }
    return value;
  };

  const parseInitialValues = () => {
    if (!initialData || !initialData.values) {
      return [{ relationship: '', isAlive: 'indeterminate', firstName: '', lastName: '', issueId: '' }];
    }

    const relationships = (initialData.values.fam_table_parentesco as unknown as string[]) || [];
    const firstNames = (initialData.values.fam_table_nombre as unknown as string[]) || [];
    const lastNames = (initialData.values.fam_table_apellido as unknown as string[]) || [];
    const aliveStatuses = (initialData.values.fam_table_vive as unknown as string[]) || [];
    const issuesJson = (initialData.values.fam_table_json_antecedentes as unknown as string[]) || [];

    const items: FamilyHistoryItem[] = relationships.map((rel, i) => {
      let relationshipValue = rel;
      for (const group of relationshipOptions) {
        const found = group.items.find(item => item.label === rel);
        if (found) {
          relationshipValue = found.value;
          break;
        }
      }

      let issueId = '';
      try {
        const parsedIssue = JSON.parse(issuesJson[i] || '[]');
        issueId = Array.isArray(parsedIssue) ? parsedIssue[0] || '' : '';
      } catch (e) {
        console.error('Error parsing ICD-10 JSON', e);
      }

      let isAlive: boolean | 'indeterminate' = 'indeterminate';
      if (
        aliveStatuses[i] === t('forms.family_history_yes') ||
        aliveStatuses[i] === 'Si' ||
        aliveStatuses[i] === 'si'
      ) {
        isAlive = true;
      } else if (
        aliveStatuses[i] === t('forms.family_history_no') ||
        aliveStatuses[i] === 'No' ||
        aliveStatuses[i] === 'no'
      ) {
        isAlive = false;
      }

      return {
        relationship: relationshipValue,
        isAlive,
        firstName: firstNames[i] || '',
        lastName: lastNames[i] || '',
        issueId,
      };
    });

    return items.length > 0
      ? items
      : [{ relationship: '', isAlive: 'indeterminate', firstName: '', lastName: '', issueId: '' }];
  };

  const form = useForm({
    initialValues: {
      items: parseInitialValues(),
    },
  });

  useEffect(() => {
    if (!readOnly) {
      const resultValues = {
        fam_table_parentesco: form.values.items.map(item => getRelationshipLabel(item.relationship)),
        fam_table_nombre: form.values.items.map(item => item.firstName),
        fam_table_apellido: form.values.items.map(item => item.lastName),
        fam_table_vive: form.values.items.map(item => {
          if (item.isAlive === true) return 'si';
          if (item.isAlive === false) return 'no';
          return '';
        }),
        fam_table_json_antecedentes: form.values.items.map(item => JSON.stringify(item.issueId ? [item.issueId] : [])),
      };

      const hasChanged = JSON.stringify(resultValues) !== JSON.stringify(initialData?.values);

      // If we don't have initial data, only trigger if we have something meaningful to report
      const hasData = form.values.items.some(
        item => item.relationship || item.firstName || item.lastName || item.issueId
      );

      if (hasChanged && (initialData || hasData)) {
        onChange({
          type: 'antecedentes/familiares',
          values: resultValues as any,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values, onChange, readOnly, t, initialData]);

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle>{t('forms.family_history_title')}</StyledTitle>
        {!readOnly && (
          <Button
            variant="light"
            leftSection={<Plus size={16} />}
            onClick={() =>
              form.insertListItem('items', {
                relationship: '',
                isAlive: 'indeterminate',
                firstName: '',
                lastName: '',
                issueId: '',
              })
            }
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
            {t('forms.family_history_add')}
          </Button>
        )}
      </FormHeader>

      <DesktopLayout>
        <Table verticalSpacing="xs" bg="white">
          <Table.Thead>
            <Table.Tr bg="blue.0">
              <Table.Th
                style={{
                  border: '1px solid var(--mantine-color-blue-1)',
                  borderLeft: 'none',
                  width: '180px',
                  paddingLeft: '1rem',
                }}
                fw={500}
                fz="md"
                py="0.5em"
              >
                {t('forms.family_history_relationship')}
              </Table.Th>
              <Table.Th
                style={{ border: '1px solid var(--mantine-color-blue-1)', width: '50px' }}
                fw={500}
                fz="md"
                py="0.5em"
              >
                {t('forms.family_history_alive')}
              </Table.Th>
              <Table.Th style={{ border: '1px solid var(--mantine-color-blue-1)' }} fw={500} fz="md" py="0.5em">
                {t('forms.family_history_first_name')}
              </Table.Th>
              <Table.Th style={{ border: '1px solid var(--mantine-color-blue-1)' }} fw={500} fz="md" py="0.5em">
                {t('forms.family_history_last_name')}
              </Table.Th>
              <Table.Th
                style={{ border: '1px solid var(--mantine-color-blue-1)', width: '300px' }}
                fw={500}
                fz="md"
                py="0.5em"
              >
                {t('forms.family_history_issue')}
              </Table.Th>
              {!readOnly && (
                <Table.Th
                  style={{ border: '1px solid var(--mantine-color-blue-1)', borderRight: 'none', width: '50px' }}
                  fw={500}
                  fz="md"
                  py="0.5em"
                />
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {form.values.items.map((item, index) => (
              <Table.Tr key={index}>
                <Table.Td pl="lg" style={{ verticalAlign: 'middle' }}>
                  {readOnly ? (
                    <Text size="sm">{getRelationshipLabel(item.relationship)}</Text>
                  ) : (
                    <Select
                      data={relationshipOptions}
                      placeholder={t('forms.family_history_relationship')}
                      {...form.getInputProps(`items.${index}.relationship`)}
                      variant="unstyled"
                      styles={{ input: { paddingLeft: 0 } }}
                    />
                  )}
                </Table.Td>
                <Table.Td ta={readOnly ? 'left' : 'center'} style={{ verticalAlign: 'middle' }}>
                  <TriStateCheckbox
                    {...form.getInputProps(`items.${index}.isAlive`)}
                    readOnly={readOnly}
                    disabled={readOnly}
                  />
                </Table.Td>
                <Table.Td style={{ verticalAlign: 'middle' }}>
                  <StyledTextInput
                    placeholder={t('forms.family_history_first_name')}
                    {...form.getInputProps(`items.${index}.firstName`)}
                    readOnly={readOnly}
                    styles={{ input: { paddingLeft: 0 } }}
                    autoComplete="off"
                    data-1p-ignore
                  />
                </Table.Td>
                <Table.Td style={{ verticalAlign: 'middle' }}>
                  <StyledTextInput
                    placeholder={t('forms.family_history_last_name')}
                    {...form.getInputProps(`items.${index}.lastName`)}
                    readOnly={readOnly}
                    styles={{ input: { paddingLeft: 0 } }}
                    autoComplete="off"
                    data-1p-ignore
                  />
                </Table.Td>
                <Table.Td style={{ verticalAlign: 'middle' }}>
                  <Icd10Selector
                    value={item.issueId}
                    onChange={val => form.setFieldValue(`items.${index}.issueId`, val as string)}
                    readOnly={readOnly}
                  />
                </Table.Td>
                {!readOnly && (
                  <Table.Td style={{ verticalAlign: 'middle' }}>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => form.removeListItem('items', index)}
                      disabled={form.values.items.length === 1}
                    >
                      <Trash size={16} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DesktopLayout>

      <MobileLayout>
        {form.values.items.map((item, index) => (
          <FormCard key={index}>
            <ItemHeader style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
              <Text fw={500} size="sm" c="gray.7">
                #{index + 1}
              </Text>
              {!readOnly && (
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={() => form.removeListItem('items', index)}
                  disabled={form.values.items.length === 1}
                >
                  <Trash size={16} />
                </ActionIcon>
              )}
            </ItemHeader>
            <FieldRow>
              <Label>{t('forms.family_history_relationship')}:</Label>
              {readOnly ? (
                <Text size="sm">{getRelationshipLabel(item.relationship)}</Text>
              ) : (
                <StyledSelect
                  data={relationshipOptions}
                  placeholder={t('forms.family_history_relationship')}
                  {...form.getInputProps(`items.${index}.relationship`)}
                />
              )}
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.family_history_alive')}:</Label>
              <TriStateCheckbox
                {...form.getInputProps(`items.${index}.isAlive`)}
                readOnly={readOnly}
                disabled={readOnly}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.family_history_first_name')}:</Label>
              <StyledTextInput
                placeholder={t('forms.family_history_first_name')}
                {...form.getInputProps(`items.${index}.firstName`)}
                readOnly={readOnly}
                autoComplete="off"
                data-1p-ignore
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.family_history_last_name')}:</Label>
              <StyledTextInput
                placeholder={t('forms.family_history_last_name')}
                {...form.getInputProps(`items.${index}.lastName`)}
                readOnly={readOnly}
                autoComplete="off"
                data-1p-ignore
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.family_history_issue')}:</Label>
              <Icd10Selector
                value={item.issueId}
                onChange={val => form.setFieldValue(`items.${index}.issueId`, val as string)}
                readOnly={readOnly}
              />
            </FieldRow>
          </FormCard>
        ))}
      </MobileLayout>
    </FormContainer>
  );
}
