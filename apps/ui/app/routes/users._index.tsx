import { useCallback, useMemo, useState } from 'react';
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useActionData, useLoaderData } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@mantine/hooks';
import { Badge, Button, ActionIcon, Group, Modal, Select, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { Plus, UserPlus } from 'lucide-react';

import { getAuthenticatedClient } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { media } from '~/media';
import { css } from '~/styled-system/css';

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    username: string;
    roleId: string;
    personalData?: { firstName?: string; lastName?: string } | null;
    contactData?: { email?: string } | null;
  } | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);

  const [membersResponse, rolesResponse] = await Promise.all([
    client.service('organization-users').find({
      query: { $populate: true, $limit: 200 },
    }),
    client.service('roles').find({ query: { $limit: 50 } }),
  ]);

  const members: MemberRow[] = Array.isArray(membersResponse)
    ? membersResponse
    : ((membersResponse as any)?.data ?? []);

  const roles = Array.isArray(rolesResponse) ? rolesResponse : ((rolesResponse as any)?.data ?? []);

  return json({ members, roles });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');

  if (intent === 'invite') {
    const email = String(formData.get('email') || '');
    const role = String(formData.get('role') || 'receptionist');

    try {
      const result = await client.service('invites').create({ email, role } as any);
      return json({
        ok: true,
        intent,
        emailHtml: (result as any)?._emailHtml ?? null,
      });
    } catch (error: any) {
      return json({ ok: false, intent, error: error?.message || 'Failed to send invite' }, { status: 400 });
    }
  }

  return json({ ok: false, intent, error: 'Invalid action' }, { status: 400 });
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'red',
  medic: 'blue',
  receptionist: 'green',
  'lab-tech': 'grape',
  'lab-owner': 'orange',
};

const ORG_ROLE_COLORS: Record<string, string> = {
  owner: 'yellow',
  admin: 'red',
  member: 'gray',
};

export default function UsersIndex() {
  const { members, roles } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation();
  const isDesktop = useMediaQuery(media.md);
  const [inviteOpen, setInviteOpen] = useState(false);

  const roleOptions = useMemo(
    () =>
      (roles as { id: string }[]).map(r => ({
        value: r.id,
        label: t(`users.role_${r.id}`, r.id),
      })),
    [roles, t]
  );

  const inviteForm = useForm({
    initialValues: { email: '', role: 'receptionist' },
    validate: {
      email: v => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : t('users.invalid_email')),
    },
  });

  const handleOpenInvite = useCallback(() => {
    inviteForm.reset();
    setInviteOpen(true);
  }, [inviteForm]);

  const handleCloseInvite = useCallback(() => {
    setInviteOpen(false);
  }, []);

  const handleInviteSuccess = useCallback(
    (data: { emailHtml?: string | null }) => {
      setInviteOpen(false);
      showNotification({ color: 'teal', message: t('users.invite_sent') });

      if (data.emailHtml) {
        const blob = new Blob([data.emailHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    },
    [t]
  );

  const handleInviteError = useCallback(
    (error: string) => {
      showNotification({ color: 'red', message: error || t('users.invite_error') });
    },
    [t]
  );

  const handleInviteSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const validation = inviteForm.validate();
      if (validation.hasErrors) return;

      const formData = new FormData();
      formData.set('intent', 'invite');
      formData.set('email', inviteForm.values.email);
      formData.set('role', inviteForm.values.role);

      try {
        const response = await fetch(window.location.href, {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();

        if (result.ok) {
          handleInviteSuccess(result);
        } else {
          handleInviteError(result.error);
        }
      } catch {
        handleInviteError(t('users.invite_error'));
      }
    },
    [inviteForm, handleInviteSuccess, handleInviteError, t]
  );

  const containerClass = css({
    padding: '1rem',
    md: { padding: '1.5rem' },
  });

  const getName = useCallback((member: MemberRow) => {
    const pd = member.user?.personalData;
    if (pd?.firstName || pd?.lastName) {
      return [pd.firstName, pd.lastName].filter(Boolean).join(' ');
    }
    return '—';
  }, []);

  const getEmail = useCallback((member: MemberRow) => {
    return member.user?.contactData?.email || '—';
  }, []);

  return (
    <div className={containerClass}>
      <Portal id="form-actions">
        <Group>
          {isDesktop && (
            <Button leftSection={<UserPlus size={16} />} onClick={handleOpenInvite}>
              {t('users.invite_user')}
            </Button>
          )}
          {!isDesktop && (
            <ActionIcon onClick={handleOpenInvite}>
              <Plus size={16} />
            </ActionIcon>
          )}
        </Group>
      </Portal>

      {members.length === 0 && (
        <Text c="dimmed" ta="center" mt="xl">
          {t('users.no_users')}
        </Text>
      )}

      {members.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('users.col_username')}</Table.Th>
              {isDesktop && <Table.Th>{t('users.col_name')}</Table.Th>}
              {isDesktop && <Table.Th>{t('users.col_email')}</Table.Th>}
              <Table.Th>{t('users.col_role')}</Table.Th>
              {isDesktop && <Table.Th>{t('users.col_org_role')}</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {members.map((member: MemberRow) => (
              <Table.Tr key={member.id}>
                <Table.Td>{member.user?.username ?? '—'}</Table.Td>
                {isDesktop && <Table.Td>{getName(member)}</Table.Td>}
                {isDesktop && <Table.Td>{getEmail(member)}</Table.Td>}
                <Table.Td>
                  <Badge color={ROLE_COLORS[member.user?.roleId ?? ''] ?? 'gray'} variant="light" size="sm">
                    {t(`users.role_${member.user?.roleId}`, member.user?.roleId ?? '—')}
                  </Badge>
                </Table.Td>
                {isDesktop && (
                  <Table.Td>
                    <Badge color={ORG_ROLE_COLORS[member.role] ?? 'gray'} variant="light" size="sm">
                      {t(`users.org_role_${member.role}`, member.role)}
                    </Badge>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={inviteOpen} onClose={handleCloseInvite} title={t('users.invite_user')} centered>
        <form onSubmit={handleInviteSubmit}>
          <TextInput
            label={t('users.email')}
            placeholder="user@example.com"
            required
            mb="md"
            {...inviteForm.getInputProps('email')}
          />
          <Select label={t('users.role')} data={roleOptions} mb="xl" {...inviteForm.getInputProps('role')} />
          <Group justify="flex-end">
            <Button variant="default" onClick={handleCloseInvite}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" leftSection={<UserPlus size={16} />}>
              {t('users.send_invite')}
            </Button>
          </Group>
        </form>
      </Modal>
    </div>
  );
}
