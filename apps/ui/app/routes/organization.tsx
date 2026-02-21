import { useCallback, useMemo, useState } from 'react';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useActionData, useLoaderData, useSubmit } from '@remix-run/react';
import { TextInput, Button, Table, Text, Group, Badge, Select, Tabs } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { Trash2, UserPlus } from 'lucide-react';

import { getAuthenticatedClient } from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import { FormContainer } from '~/components/forms/styles';
import Portal from '~/components/portal';
import { css } from '~/styled-system/css';
import { getPageTitle } from '~/utils/meta';

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'organization') }];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { client } = await getAuthenticatedClient(request);
    const organizationId = await getCurrentOrganizationId(request);

    if (!organizationId) {
      return json({ organization: null, members: [] });
    }

    const organization = await client.service('organizations').get(organizationId);

    const memberships: any[] = await client.service('organization-users').find({
      query: { organizationId },
      paginate: false
    } as any);

    const members = await Promise.all(
      memberships.map(async (m: any) => {
        try {
          const user = await client.service('users').get(m.userId);
          return {
            membershipId: m.id,
            userId: m.userId,
            role: m.role,
            username: user.username,
            firstName: user.personalData?.firstName ?? '',
            lastName: user.personalData?.lastName ?? '',
          };
        } catch {
          return {
            membershipId: m.id,
            userId: m.userId,
            role: m.role,
            username: 'Unknown',
            firstName: '',
            lastName: '',
          };
        }
      })
    );

    return json({ organization, members });
  } catch {
    throw redirect('/login');
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');
  const organizationId = await getCurrentOrganizationId(request);

  let client;
  try {
    const authenticated = await getAuthenticatedClient(request);
    client = authenticated.client;
  } catch {
    throw redirect('/login');
  }

  try {
    if (intent === 'update-org' && organizationId) {
      const name = String(formData.get('name') || '');
      await client.service('organizations').patch(organizationId, { name });
      return json({ ok: true, intent });
    }

    if (intent === 'add-member' && organizationId) {
      const username = String(formData.get('username') || '');
      const role = String(formData.get('role') || 'member');

      const users: any = await client.service('users').find({
        query: { username, $limit: 1 }
      });

      const userList = users.data || users;
      if (!userList.length) {
        return json({ ok: false, intent, error: 'User not found' }, { status: 400 });
      }

      await client.service('organization-users').create({
        organizationId,
        userId: userList[0].id,
        role
      });

      return json({ ok: true, intent });
    }

    if (intent === 'remove-member') {
      const membershipId = String(formData.get('membershipId') || '');
      await client.service('organization-users').remove(membershipId);
      return json({ ok: true, intent });
    }

    return json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return json(
      { ok: false, intent, error: error?.message || 'Operation failed' },
      { status: 400 }
    );
  }
};

export default function OrganizationPage() {
  const { organization, members } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation();
  const submit = useSubmit();
  const [activeTab, setActiveTab] = useState<string | null>('settings');

  const orgForm = useForm({
    initialValues: {
      name: organization?.name ?? '',
    },
  });

  const memberForm = useForm({
    initialValues: {
      username: '',
      role: 'member',
    },
  });

  const handleUpdateOrg = useCallback(() => {
    const formData = new FormData();
    formData.set('intent', 'update-org');
    formData.set('name', orgForm.values.name);
    submit(formData, { method: 'post' });
  }, [orgForm.values.name, submit]);

  const handleAddMember = useCallback(() => {
    const formData = new FormData();
    formData.set('intent', 'add-member');
    formData.set('username', memberForm.values.username);
    formData.set('role', memberForm.values.role);
    submit(formData, { method: 'post' });
    memberForm.reset();
  }, [memberForm, submit]);

  const handleRemoveMember = useCallback((membershipId: string) => () => {
    if (!confirm(t('organizations.remove_member_confirm'))) return;
    const formData = new FormData();
    formData.set('intent', 'remove-member');
    formData.set('membershipId', membershipId);
    submit(formData, { method: 'post' });
  }, [submit, t]);

  const tabListClass = css({
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--mantine-spacing-xl)',
  });

  const tabClass = css({
    padding: '0.5em 0',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'transparent',
    color: 'var(--mantine-color-gray-6)',
    cursor: 'pointer',
    fontSize: 'inherit',
    fontWeight: 500,
    transition: 'color 0.15s ease, border-color 0.15s ease',
    position: 'relative',

    '&:not([data-active]):hover': {
      color: 'var(--mantine-color-gray-8)',
    },

    '&::before': {
      content: '""',
      position: 'absolute',
      top: '-1.5em',
      bottom: 0,
      left: 0,
      width: '100%',
      height: 'calc(100% + 3em)',
      backgroundColor: 'transparent',
    },

    '&[data-active]': {
      color: 'var(--mantine-color-blue-6)',

      '&::after': {
        content: '""',
        position: 'absolute',
        top: 'calc(100% + 1.5em)',
        left: 0,
        width: '100%',
        height: '2px',
        backgroundColor: 'var(--mantine-color-blue-6)',
      },
    },
  });

  const roleOptions = useMemo(() => [
    { value: 'admin', label: t('organizations.admin') },
    { value: 'member', label: t('organizations.member') },
  ], [t]);

  if (!organization) {
    return (
      <FormContainer style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
        <Text c="dimmed">{t('organizations.select_organization')}</Text>
      </FormContainer>
    );
  }

  return (
    <FormContainer style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        variant="unstyled"
        classNames={{ list: tabListClass, tab: tabClass }}
      >
        <Portal id="toolbar">
          <Tabs.List>
            <Tabs.Tab value="settings">{t('organizations.settings')}</Tabs.Tab>
            <Tabs.Tab value="members">{t('organizations.members')}</Tabs.Tab>
          </Tabs.List>
        </Portal>

        <Tabs.Panel value="settings" pt="md">
          <TextInput
            label={t('organizations.name')}
            {...orgForm.getInputProps('name')}
            mb="md"
          />
          <Button onClick={handleUpdateOrg}>
            {t('common.save')}
          </Button>
          {actionData?.ok && actionData.intent === 'update-org' && (
            <Text c="green" size="sm" mt="sm">{t('organizations.save_success')}</Text>
          )}
          {actionData?.ok === false && actionData.intent === 'update-org' && (
            <Text c="red" size="sm" mt="sm">{actionData.error}</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="members" pt="md">
          <Group mb="lg" align="flex-end">
            <TextInput
              label={t('organizations.add_member')}
              placeholder={t('auth.username_placeholder')}
              {...memberForm.getInputProps('username')}
              style={{ flex: 1 }}
            />
            <Select
              label={t('organizations.role')}
              data={roleOptions}
              {...memberForm.getInputProps('role')}
              style={{ width: 140 }}
            />
            <Button onClick={handleAddMember} leftSection={<UserPlus size={16} />}>
              {t('common.add')}
            </Button>
          </Group>

          {actionData?.ok === false && actionData.intent === 'add-member' && (
            <Text c="red" size="sm" mb="md">{actionData.error}</Text>
          )}

          {members.length === 0 && (
            <Text c="dimmed">{t('organizations.no_members')}</Text>
          )}

          {members.length > 0 && (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('auth.username')}</Table.Th>
                  <Table.Th>{t('organizations.role')}</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {members.map((member: any) => (
                  <Table.Tr key={member.membershipId}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {member.firstName && member.lastName
                          ? `${member.firstName} ${member.lastName}`
                          : member.username}
                      </Text>
                      {member.firstName && (
                        <Text size="xs" c="dimmed">{member.username}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={member.role === 'admin' ? 'blue' : 'gray'}>
                        {member.role}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        variant="subtle"
                        color="red"
                        size="xs"
                        onClick={handleRemoveMember(member.membershipId)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>
      </Tabs>
    </FormContainer>
  );
}
