import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useNavigation, Form } from '@remix-run/react';
import { Badge, Button, Group, Stack, Switch, Table, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { getAuthenticatedClient } from '~/utils/auth.server';

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);

  const response = await client.service('organizations').find({
    query: {
      $sort: { createdAt: -1 },
      $limit: 100,
    },
  });

  const organizations = Array.isArray(response) ? response : (response as any)?.data || [];

  return json({ organizations });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');
  const orgId = String(formData.get('orgId') || '');

  try {
    if (intent === 'toggle-active') {
      const currentlyActive = formData.get('currentlyActive') === 'true';
      await client.service('organizations').patch(orgId, {
        isActive: !currentlyActive,
      });
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Operation failed' }, { status: 400 });
  }
};

export default function AdminOrganizations() {
  const { organizations } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const { t } = useTranslation();

  const isSubmitting = navigation.state === 'submitting';

  return (
    <Stack gap="lg">
      <Title order={3}>{t('admin.organizations_title')}</Title>

      {organizations.length === 0 && (
        <Text c="dimmed" ta="center" py="xl">
          {t('admin.no_organizations')}
        </Text>
      )}

      {organizations.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('admin.col_name')}</Table.Th>
              <Table.Th>{t('admin.col_slug')}</Table.Th>
              <Table.Th>{t('admin.col_status')}</Table.Th>
              <Table.Th>{t('admin.col_actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {organizations.map((org: OrgItem) => (
              <Table.Tr key={org.id}>
                <Table.Td>
                  <Text fw={500}>{org.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {org.slug}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={org.isActive ? 'green' : 'gray'} variant="light">
                    {org.isActive ? t('admin.active') : t('admin.inactive')}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Form method="post">
                    <input type="hidden" name="intent" value="toggle-active" />
                    <input type="hidden" name="orgId" value={org.id} />
                    <input type="hidden" name="currentlyActive" value={String(org.isActive)} />
                    <Button
                      type="submit"
                      variant="subtle"
                      size="xs"
                      color={org.isActive ? 'red' : 'green'}
                      loading={isSubmitting}
                    >
                      {org.isActive ? t('admin.deactivate') : t('admin.activate')}
                    </Button>
                  </Form>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
