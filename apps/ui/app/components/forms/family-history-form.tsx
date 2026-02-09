import { ActionIcon, Button, Checkbox, Select, Table, TextInput, Text, Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMediaQuery } from '@mantine/hooks';
import { Plus, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { styled, media } from '~/stitches';
import { Icd10Selector } from '~/components/icd10-selector';
import { StyledTitle, FormHeader, FormContainer } from '~/components/forms/styles';

const StyledTable = styled(Table, {
  backgroundColor: 'white',
  border: '1px solid var(--mantine-color-gray-2)',
  borderRadius: 'var(--mantine-radius-md)',

  '& thead tr th': {
    color: 'var(--mantine-color-gray-6)',
    fontWeight: 600,
    fontSize: 'var(--mantine-font-size-sm)',
    padding: '0.5rem 1rem',
  },

  '& tbody tr td': {
    padding: '0.25rem 1rem',
    verticalAlign: 'middle',
  },
});

const MobileCard = styled('div', {
  backgroundColor: 'white',
  border: '1px solid var(--mantine-color-gray-2)',
  borderRadius: 'var(--mantine-radius-md)',
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  position: 'relative',
});

const MobileField = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  flex: 1,
});

const MobileLabel = styled(Text, {
  fontSize: 'var(--mantine-font-size-xs)',
  fontWeight: 600,
  color: 'var(--mantine-color-gray-6)',
  textTransform: 'uppercase',
});

interface FamilyHistoryItem {
  relationship: string;
  isAlive: boolean;
  firstName: string;
  lastName: string;
  issueId: string;
}

interface FamilyHistoryFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onSubmit: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function FamilyHistoryForm({ initialData, onSubmit, readOnly }: FamilyHistoryFormProps) {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery(media.lg);

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
      return [{ relationship: '', isAlive: true, firstName: '', lastName: '', issueId: '' }];
    }

    const relationships = (initialData.values.fam_table_parentesco as unknown as string[]) || [];
    const firstNames = (initialData.values.fam_table_nombre as unknown as string[]) || [];
    const lastNames = (initialData.values.fam_table_apellido as unknown as string[]) || [];
    const aliveStatuses = (initialData.values.fam_table_vive as unknown as string[]) || [];
    const issuesJson = (initialData.values.fam_table_json_antecedentes as unknown as string[]) || [];

    const items: FamilyHistoryItem[] = relationships.map((rel, i) => {
      // Find the value for the relationship label
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

      return {
        relationship: relationshipValue,
        isAlive: aliveStatuses[i] === t('forms.family_history_yes') || aliveStatuses[i] === 'Si',
        firstName: firstNames[i] || '',
        lastName: lastNames[i] || '',
        issueId,
      };
    });

    return items.length > 0 ? items : [{ relationship: '', isAlive: true, firstName: '', lastName: '', issueId: '' }];
  };

  const form = useForm({
    initialValues: {
      items: parseInitialValues(),
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    const resultValues: Record<string, string[]> = {
      fam_table_parentesco: values.items.map(item => getRelationshipLabel(item.relationship)),
      fam_table_nombre: values.items.map(item => item.firstName),
      fam_table_apellido: values.items.map(item => item.lastName),
      fam_table_vive: values.items.map(item =>
        item.isAlive ? t('forms.family_history_yes') : t('forms.family_history_no')
      ),
      fam_table_json_antecedentes: values.items.map(item => JSON.stringify(item.issueId ? [item.issueId] : [])),
    };

    onSubmit({
      type: 'antecedentes/familiares',
      values: resultValues as any,
    });
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <FormContainer>
        <FormHeader>
          <StyledTitle order={1}>{t('forms.family_history_title')}</StyledTitle>
          {!readOnly && (
            <Button
              variant="light"
              leftSection={<Plus size={16} />}
              onClick={() =>
                form.insertListItem('items', {
                  relationship: '',
                  isAlive: true,
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

        {isDesktop ? (
          <StyledTable verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: '200px' }}>{t('forms.family_history_relationship')}</Table.Th>
                <Table.Th style={{ width: '80px' }}>{t('forms.family_history_alive')}</Table.Th>
                <Table.Th>{t('forms.family_history_first_name')}</Table.Th>
                <Table.Th>{t('forms.family_history_last_name')}</Table.Th>
                <Table.Th style={{ width: '300px' }}>{t('forms.family_history_issue')}</Table.Th>
                {!readOnly && <Table.Th style={{ width: '50px' }}></Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {form.values.items.map((item, index) => (
                <Table.Tr key={index}>
                  <Table.Td>
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
                  <Table.Td>
                    {readOnly ? (
                      <Text size="sm">
                        {item.isAlive ? t('forms.family_history_yes') : t('forms.family_history_no')}
                      </Text>
                    ) : (
                      <Checkbox
                        {...form.getInputProps(`items.${index}.isAlive`, { type: 'checkbox' })}
                        styles={{ input: { cursor: 'pointer' } }}
                      />
                    )}
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      placeholder={t('forms.family_history_first_name')}
                      {...form.getInputProps(`items.${index}.firstName`)}
                      variant="unstyled"
                      readOnly={readOnly}
                      styles={{ input: { paddingLeft: 0 } }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      placeholder={t('forms.family_history_last_name')}
                      {...form.getInputProps(`items.${index}.lastName`)}
                      variant="unstyled"
                      readOnly={readOnly}
                      styles={{ input: { paddingLeft: 0 } }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Icd10Selector
                      value={item.issueId}
                      onChange={val => form.setFieldValue(`items.${index}.issueId`, val)}
                      readOnly={readOnly}
                    />
                  </Table.Td>
                  {!readOnly && (
                    <Table.Td>
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
          </StyledTable>
        ) : (
          <Stack gap="md">
            {form.values.items.map((item, index) => (
              <MobileCard key={index}>
                {!readOnly && (
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => form.removeListItem('items', index)}
                    disabled={form.values.items.length === 1}
                    style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}
                  >
                    <Trash size={16} />
                  </ActionIcon>
                )}

                <MobileField>
                  <MobileLabel>{t('forms.family_history_relationship')}</MobileLabel>
                  {readOnly ? (
                    <Text size="sm">{getRelationshipLabel(item.relationship)}</Text>
                  ) : (
                    <Select
                      data={relationshipOptions}
                      placeholder={t('forms.family_history_relationship')}
                      {...form.getInputProps(`items.${index}.relationship`)}
                      variant="filled"
                    />
                  )}
                </MobileField>

                <MobileField>
                  <MobileLabel>{t('forms.family_history_alive')}</MobileLabel>
                  {readOnly ? (
                    <Text size="sm">{item.isAlive ? t('forms.family_history_yes') : t('forms.family_history_no')}</Text>
                  ) : (
                    <Checkbox
                      label={t('forms.family_history_alive')}
                      {...form.getInputProps(`items.${index}.isAlive`, { type: 'checkbox' })}
                      styles={{ input: { cursor: 'pointer' } }}
                    />
                  )}
                </MobileField>

                <Group grow>
                  <MobileField>
                    <MobileLabel>{t('forms.family_history_first_name')}</MobileLabel>
                    <TextInput
                      placeholder={t('forms.family_history_first_name')}
                      {...form.getInputProps(`items.${index}.firstName`)}
                      variant={readOnly ? 'unstyled' : 'filled'}
                      readOnly={readOnly}
                    />
                  </MobileField>
                  <MobileField>
                    <MobileLabel>{t('forms.family_history_last_name')}</MobileLabel>
                    <TextInput
                      placeholder={t('forms.family_history_last_name')}
                      {...form.getInputProps(`items.${index}.lastName`)}
                      variant={readOnly ? 'unstyled' : 'filled'}
                      readOnly={readOnly}
                    />
                  </MobileField>
                </Group>

                <MobileField>
                  <MobileLabel>{t('forms.family_history_issue')}</MobileLabel>
                  <Icd10Selector
                    value={item.issueId}
                    onChange={val => form.setFieldValue(`items.${index}.issueId`, val)}
                    readOnly={readOnly}
                  />
                </MobileField>
              </MobileCard>
            ))}
          </Stack>
        )}
      </FormContainer>
    </form>
  );
}
