import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@mantine/hooks';
import {
  Badge,
  Button,
  ActionIcon,
  Checkbox,
  Group,
  Modal,
  Popover,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { Plus, UserPlus, X } from 'lucide-react';

import { getAuthenticatedClient } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { media } from '~/media';
import { css } from '~/styled-system/css';

type MemberRow = {
  id: string;
  userId: string;
  user: {
    id: string;
    username: string;
    roleIds: string[];
    personalData?: { firstName?: string; lastName?: string } | null;
    contactData?: { email?: string } | null;
  } | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);

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

  return json({ members, roles, currentUserId: user.id });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');

  if (intent === 'invite') {
    const email = String(formData.get('email') || '');
    const role = String(formData.get('role') || 'receptionist');

    try {
      const result = await client.service('invites').create({ email, roleId: role } as any);
      return json({
        ok: true,
        intent,
        emailHtml: (result as any)?._emailHtml ?? null,
      });
    } catch (error: any) {
      return json({ ok: false, intent, error: error?.message || 'Failed to send invite' }, { status: 400 });
    }
  }

  if (intent === 'remove-member') {
    const membershipId = String(formData.get('membershipId') || '');
    try {
      await client.service('organization-users').remove(membershipId);
      return json({ ok: true, intent });
    } catch (error: any) {
      return json({ ok: false, intent, error: error?.message || 'Failed to remove member' }, { status: 400 });
    }
  }

  if (intent === 'update-roles') {
    const userId = String(formData.get('userId') || '');
    const newRoleIds: string[] = JSON.parse(String(formData.get('roleIds') || '[]'));

    if (newRoleIds.length === 0) {
      return json({ ok: false, intent, error: 'At least one role is required' }, { status: 400 });
    }

    try {
      const existingRoles = await client.service('user-roles').find({
        query: { userId, $limit: 50 },
      });
      const existing: { id: string; roleId: string }[] = Array.isArray(existingRoles)
        ? existingRoles
        : ((existingRoles as any)?.data ?? []);

      const currentRoleIds = existing.map(r => r.roleId);
      const toAdd = newRoleIds.filter(r => !currentRoleIds.includes(r));
      const toRemove = existing.filter(r => !newRoleIds.includes(r.roleId));

      if (toAdd.includes('owner') || toRemove.some(r => r.roleId === 'owner')) {
        return json({ ok: false, intent, error: 'The owner role cannot be changed from this interface' }, { status: 403 });
      }

      await Promise.all([
        ...toAdd.map(roleId => client.service('user-roles').create({ userId, roleId } as any)),
        ...toRemove.map(r => client.service('user-roles').remove(r.id)),
      ]);

      return json({ ok: true, intent });
    } catch (error: any) {
      return json({ ok: false, intent, error: error?.message || 'Failed to update roles' }, { status: 400 });
    }
  }

  return json({ ok: false, intent, error: 'Invalid action' }, { status: 400 });
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'yellow',
  admin: 'red',
  medic: 'blue',
  receptionist: 'green',
  'lab-tech': 'grape',
  'lab-owner': 'orange',
  accounting: 'teal',
};

function RoleMultiSelect({
  value,
  allRoles,
  userId,
  isCurrentUser,
}: {
  value: string[];
  allRoles: { id: string; label: string }[];
  userId: string;
  isCurrentUser: boolean;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const pending = fetcher.state !== 'idle';
  const latestValue = useRef(value);
  latestValue.current = value;

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.ok) {
        showNotification({ color: 'teal', message: t('users.roles_updated') });
      } else {
        showNotification({ color: 'red', message: fetcher.data.error || t('users.roles_update_error') });
      }
    }
  }, [fetcher.state, fetcher.data, t]);

  const handleToggle = useCallback(
    (roleId: string) => {
      if (roleId === 'owner') return;

      const current = latestValue.current;
      let next: string[];

      if (current.includes(roleId)) {
        next = current.filter(r => r !== roleId);
      } else {
        next = [...current, roleId];
      }

      if (next.length === 0) {
        showNotification({ color: 'orange', message: t('users.min_one_role') });
        return;
      }

      fetcher.submit(
        { intent: 'update-roles', userId, roleIds: JSON.stringify(next) },
        { method: 'post' }
      );
    },
    [userId, t, fetcher]
  );

  const badges = value.map(roleId => {
    const color = ROLE_COLORS[roleId] ?? 'gray';
    const label = allRoles.find(r => r.id === roleId)?.label ?? roleId;
    return (
      <Badge key={roleId} color={color} variant="light" size="sm">
        {label}
      </Badge>
    );
  });

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md" withinPortal>
      <Popover.Target>
        <UnstyledButton onClick={() => setOpened(o => !o)}>
          <Group gap={4} wrap="wrap">
            {badges.length > 0 ? badges : <Badge color="gray" variant="light" size="sm">—</Badge>}
          </Group>
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown p="xs">
        <Stack gap={6}>
          {allRoles.map(role => {
            const isSelected = value.includes(role.id);
            const isLastSelected = isSelected && value.length === 1;
            const isOwnerRole = role.id === 'owner';
            const locked = isOwnerRole || (isCurrentUser && isLastSelected);
            return (
              <Checkbox
                key={role.id}
                label={
                  <Badge color={ROLE_COLORS[role.id] ?? 'gray'} variant={isSelected ? 'filled' : 'light'} size="sm">
                    {role.label}
                  </Badge>
                }
                checked={isSelected}
                disabled={pending || locked || isLastSelected}
                onChange={() => handleToggle(role.id)}
                styles={{ body: { alignItems: 'center' } }}
              />
            );
          })}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function RemoveConfirmPopover({
  member,
  disabled,
}: {
  member: MemberRow;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.ok) {
        showNotification({ color: 'teal', message: t('users.remove_member_success') });
        setOpened(false);
      } else {
        showNotification({ color: 'red', message: fetcher.data.error || t('users.remove_member_error') });
      }
    }
  }, [fetcher.state, fetcher.data, t]);

  const handleConfirm = useCallback(() => {
    fetcher.submit(
      { intent: 'remove-member', membershipId: member.id },
      { method: 'post' }
    );
  }, [fetcher, member.id]);

  return (
    <Popover opened={opened} onChange={setOpened} position="left" shadow="md" withinPortal withArrow>
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          title={t('users.remove_member')}
          onClick={() => setOpened(o => !o)}
          disabled={disabled}
        >
          <X size={14} />
        </ActionIcon>
      </Popover.Target>

      <Popover.Dropdown p="sm">
        <Text size="sm" mb="sm">
          {t('users.remove_member_confirm', { username: member.user?.username ?? '—' })}
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button size="compact-sm" variant="default" onClick={() => setOpened(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="compact-sm" color="red" loading={fetcher.state !== 'idle'} onClick={handleConfirm}>
            {t('users.remove_member')}
          </Button>
        </Group>
      </Popover.Dropdown>
    </Popover>
  );
}

export default function UsersIndex() {
  const { members, roles, currentUserId } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const isDesktop = useMediaQuery(media.md);
  const [inviteOpen, setInviteOpen] = useState(false);

  const inviteFetcher = useFetcher<{ ok: boolean; intent: string; emailHtml?: string | null; error?: string }>();

  useEffect(() => {
    if (inviteFetcher.state === 'idle' && inviteFetcher.data) {
      if (inviteFetcher.data.ok) {
        setInviteOpen(false);
        showNotification({ color: 'teal', message: t('users.invite_sent') });
        if (inviteFetcher.data.emailHtml) {
          const blob = new Blob([inviteFetcher.data.emailHtml], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        }
      } else {
        showNotification({ color: 'red', message: inviteFetcher.data.error || t('users.invite_error') });
      }
    }
  }, [inviteFetcher.state, inviteFetcher.data, t]);

  const allRoleOptions = useMemo(
    () =>
      (roles as { id: string }[]).map(r => ({
        id: r.id,
        label: t(`users.role_${r.id}`, r.id),
      })),
    [roles, t]
  );

  const selectRoleOptions = useMemo(
    () => allRoleOptions.map(r => ({ value: r.id, label: r.label })),
    [allRoleOptions]
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

  const handleInviteSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const validation = inviteForm.validate();
      if (validation.hasErrors) return;

      inviteFetcher.submit(
        { intent: 'invite', email: inviteForm.values.email, role: inviteForm.values.role },
        { method: 'post' }
      );
    },
    [inviteForm, inviteFetcher]
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
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {members.map((member: MemberRow) => {
              const isSelf = member.userId === currentUserId;
              const isOwner = (member.user?.roleIds || []).includes('owner');
              const canRemove = !isSelf && !isOwner;
              return (
                <Table.Tr key={member.id}>
                  <Table.Td>{member.user?.username ?? '—'}</Table.Td>
                  {isDesktop && <Table.Td>{getName(member)}</Table.Td>}
                  {isDesktop && <Table.Td>{getEmail(member)}</Table.Td>}
                  <Table.Td>
                    <RoleMultiSelect
                      value={member.user?.roleIds || []}
                      allRoles={allRoleOptions}
                      userId={member.userId}
                      isCurrentUser={isSelf}
                    />
                  </Table.Td>
                  <Table.Td>
                    <RemoveConfirmPopover member={member} disabled={!canRemove} />
                  </Table.Td>
                </Table.Tr>
              );
            })}
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
          <Select label={t('users.role')} data={selectRoleOptions} mb="xl" {...inviteForm.getInputProps('role')} />
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
