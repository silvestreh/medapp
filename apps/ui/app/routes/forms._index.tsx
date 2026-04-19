import { useCallback } from 'react';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useNavigate } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Table, Badge, Button, Group, Text, ActionIcon, Menu } from '@mantine/core';
import {
  PlusIcon,
  PencilSimpleIcon,
  TrashIcon,
  DotsThreeVerticalIcon,
  RocketLaunchIcon,
  ArchiveIcon,
  StethoscopeIcon,
  FlaskIcon,
} from '@phosphor-icons/react';
import { styled } from '~/styled-system/jsx';
import { getAuthenticatedClient } from '~/utils/auth.server';
import { useFeathers } from '~/components/provider';
import { FormContainer } from '~/components/forms/styles';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);

  const result = await client.service('form-templates' as any).find({
    query: { $sort: { updatedAt: -1 } },
  });

  const templates = Array.isArray(result) ? result : (result as any)?.data || [];

  return json({ templates });
};

const PageHeader = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--mantine-spacing-lg)',
    flexWrap: 'wrap',
    gap: 'var(--mantine-spacing-sm)',
  },
});

const EmptyState = styled('div', {
  base: {
    padding: 'var(--mantine-spacing-xl)',
    textAlign: 'center',
    color: 'var(--mantine-color-gray-5)',
  },
});

const statusColors: Record<string, string> = {
  draft: 'gray',
  published: 'green',
  archived: 'orange',
};

export default function FormsListPage() {
  const { templates } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = useFeathers();

  const handleCreate = useCallback(
    (formType: string) => {
      navigate(`/forms/${formType}/new`);
    },
    [navigate]
  );

  const handleEdit = useCallback(
    (id: string) => {
      navigate(`/forms/${id}/edit`);
    },
    [navigate]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await client.service('form-templates' as any).remove(id);
      window.location.reload();
    },
    [client]
  );

  const handleStatusChange = useCallback(
    async (id: string, status: string) => {
      await client.service('form-templates' as any).patch(id, { status });
      window.location.reload();
    },
    [client]
  );

  return (
    <FormContainer style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--mantine-spacing-lg)' }}>
      <PageHeader>
        <div>
          <Text size="xl" fw={700}>
            {t('form_builder.title')}
          </Text>
          <Text size="sm" c="dimmed">
            {t('form_builder.subtitle')}
          </Text>
        </div>
        <Menu position="bottom-end" shadow="md">
          <Menu.Target>
            <Button leftSection={<PlusIcon size={16} />}>{t('form_builder.create_form')}</Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<StethoscopeIcon size={14} />} onClick={() => handleCreate('encounter')}>
              {t('form_builder.type_encounter')}
            </Menu.Item>
            <Menu.Item leftSection={<FlaskIcon size={14} />} onClick={() => handleCreate('study')}>
              {t('form_builder.type_study')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </PageHeader>

      {templates.length === 0 && (
        <EmptyState>
          <Text size="lg" fw={600} mb="xs">
            {t('form_builder.no_forms')}
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            {t('form_builder.no_forms_cta')}
          </Text>
          <Menu position="bottom" shadow="md">
            <Menu.Target>
              <Button leftSection={<PlusIcon size={16} />}>{t('form_builder.create_form')}</Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<StethoscopeIcon size={14} />} onClick={() => handleCreate('encounter')}>
                {t('form_builder.type_encounter')}
              </Menu.Item>
              <Menu.Item leftSection={<FlaskIcon size={14} />} onClick={() => handleCreate('study')}>
                {t('form_builder.type_study')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </EmptyState>
      )}

      {templates.length > 0 && (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('form_builder.col_name')}</Table.Th>
              <Table.Th>{t('form_builder.col_type')}</Table.Th>
              <Table.Th>{t('form_builder.col_status')}</Table.Th>
              <Table.Th>{t('form_builder.col_updated')}</Table.Th>
              <Table.Th style={{ width: 50 }} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {templates.map((tmpl: any) => (
              <Table.Tr key={tmpl.id} style={{ cursor: 'pointer' }} onClick={() => handleEdit(tmpl.id)}>
                <Table.Td>
                  <Text fw={500}>{tmpl.label || tmpl.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm">
                    {t(`form_builder.type_${tmpl.type}` as any)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={statusColors[tmpl.status] || 'gray'} variant="light" size="sm">
                    {t(`form_builder.status_${tmpl.status}` as any)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {tmpl.updatedAt ? new Date(tmpl.updatedAt).toLocaleDateString() : '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="dark" onClick={e => e.stopPropagation()}>
                        <DotsThreeVerticalIcon size={16} weight="bold" />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<PencilSimpleIcon size={14} />}
                        onClick={e => {
                          e.stopPropagation();
                          handleEdit(tmpl.id);
                        }}
                      >
                        {t('form_builder.edit')}
                      </Menu.Item>
                      {tmpl.status === 'draft' && (
                        <Menu.Item
                          leftSection={<RocketLaunchIcon size={14} />}
                          onClick={e => {
                            e.stopPropagation();
                            handleStatusChange(tmpl.id, 'published');
                          }}
                        >
                          {t('form_builder.publish')}
                        </Menu.Item>
                      )}
                      {tmpl.status === 'published' && (
                        <Menu.Item
                          leftSection={<ArchiveIcon size={14} />}
                          onClick={e => {
                            e.stopPropagation();
                            handleStatusChange(tmpl.id, 'archived');
                          }}
                        >
                          {t('form_builder.archive')}
                        </Menu.Item>
                      )}
                      {tmpl.status === 'draft' && (
                        <>
                          <Menu.Divider />
                          <Menu.Item
                            color="red"
                            leftSection={<TrashIcon size={14} />}
                            onClick={e => {
                              e.stopPropagation();
                              handleDelete(tmpl.id);
                            }}
                          >
                            {t('form_builder.delete')}
                          </Menu.Item>
                        </>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </FormContainer>
  );
}
