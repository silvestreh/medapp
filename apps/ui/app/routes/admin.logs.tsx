import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams } from '@remix-run/react';
import { Badge, Group, Select, Stack, Table, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { getAuthenticatedClient } from '~/utils/auth.server';

interface LogEntry {
  id: string;
  userId: string;
  resource: string;
  action: string;
  ip: string | null;
  createdAt: string;
  user?: { id: string; username: string };
  patient?: { id: string };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const url = new URL(request.url);
  const resource = url.searchParams.get('resource') || undefined;
  const action = url.searchParams.get('action') || undefined;

  const query: Record<string, unknown> = {
    $sort: { createdAt: -1 },
    $limit: 100,
  };
  if (resource) query.resource = resource;
  if (action) query.action = action;

  const response = await client.service('access-logs' as any).find({ query });
  const logs = Array.isArray(response) ? response : (response as any)?.data || [];

  return json({ logs });
};

const actionColors: Record<string, string> = {
  read: 'blue',
  write: 'green',
  export: 'orange',
};

export default function AdminLogs() {
  const { logs } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleFilterChange = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <Stack gap="lg">
      <Title order={3}>{t('admin.access_logs_title')}</Title>

      <Group gap="sm">
        <Select
          placeholder={t('admin.filter_resource')}
          data={[
            { value: 'encounters', label: t('admin.resource_encounters') },
            { value: 'studies', label: t('admin.resource_studies') },
            { value: 'prescriptions', label: t('admin.resource_prescriptions') },
          ]}
          value={searchParams.get('resource')}
          onChange={(v) => handleFilterChange('resource', v)}
          clearable
          size="xs"
        />
        <Select
          placeholder={t('admin.filter_action')}
          data={[
            { value: 'read', label: t('admin.action_read') },
            { value: 'write', label: t('admin.action_write') },
            { value: 'export', label: t('admin.action_export') },
          ]}
          value={searchParams.get('action')}
          onChange={(v) => handleFilterChange('action', v)}
          clearable
          size="xs"
        />
      </Group>

      {logs.length === 0 && (
        <Text c="dimmed" ta="center" py="xl">
          {t('admin.no_logs')}
        </Text>
      )}

      {logs.length > 0 && (
        <Table striped highlightOnHover style={{ fontSize: '0.875rem' }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('admin.col_date')}</Table.Th>
              <Table.Th>{t('admin.col_user')}</Table.Th>
              <Table.Th>{t('admin.col_resource')}</Table.Th>
              <Table.Th>{t('admin.col_action')}</Table.Th>
              <Table.Th>{t('admin.col_ip')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {logs.map((log: LogEntry) => (
              <Table.Tr key={log.id}>
                <Table.Td>{new Date(log.createdAt).toLocaleString()}</Table.Td>
                <Table.Td>{(log as any).user?.username || log.userId}</Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm">
                    {log.resource}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={actionColors[log.action] || 'gray'} variant="light" size="sm">
                    {log.action}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {log.ip || '-'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
