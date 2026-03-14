import { useCallback, useMemo, useState } from 'react';
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@mantine/hooks';
import { ActionIcon, Button, Group, Table, Text } from '@mantine/core';
import { PlusIcon, UserPlusIcon } from '@phosphor-icons/react';

import { getAuthenticatedClient } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { media } from '~/media';
import { styled } from '~/styled-system/jsx';
import { InviteModal, RemoveConfirmPopover, RoleMultiSelect, type MemberRow } from '~/components/users';

const CellText = styled('span', {
  base: {
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    display: 'block',
    padding: 'var(--mantine-spacing-xs)',
    fontSize: 'var(--mantine-font-size-sm)',
  },
});

const Container = styled('div', {
  base: {},
});

const HeaderContainer = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    // backgroundColor: '#FAFBFB',

    sm: {
      padding: '1em',
    },
    md: {
      padding: '2em 2em 1em',
    },
  },
});

const Title = styled('h1', {
  base: {
    fontSize: '1.5rem',
    lineHeight: 1,
    fontWeight: 700,
    flex: 1,
    margin: 0,

    md: {
      fontSize: '2rem',
    },

    lg: {
      fontSize: '2.25rem',
    },
  },
});

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
        return json(
          { ok: false, intent, error: 'The owner role cannot be changed from this interface' },
          { status: 403 }
        );
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

export default function UsersIndex() {
  const { members, roles, currentUserId } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const isDesktop = useMediaQuery(media.md);
  const [inviteOpen, setInviteOpen] = useState(false);

  const allRoleOptions = useMemo(
    () =>
      (roles as { id: string }[]).map(r => ({
        id: r.id,
        label: t(`users.role_${r.id}`, r.id),
      })),
    [roles, t]
  );

  const selectRoleOptions = useMemo(() => allRoleOptions.map(r => ({ value: r.id, label: r.label })), [allRoleOptions]);

  const handleOpenInvite = useCallback(() => {
    setInviteOpen(true);
  }, []);

  const handleCloseInvite = useCallback(() => {
    setInviteOpen(false);
  }, []);

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
    <Container>
      <Portal id="form-actions">
        <Group>
          {isDesktop && (
            <Button leftSection={<UserPlusIcon size={16} />} onClick={handleOpenInvite}>
              {t('users.invite_user')}
            </Button>
          )}
          {!isDesktop && (
            <ActionIcon onClick={handleOpenInvite}>
              <PlusIcon size={16} />
            </ActionIcon>
          )}
        </Group>
      </Portal>

      <HeaderContainer>
        <Title>{t('page_titles.users_roles')}</Title>
      </HeaderContainer>

      {members.length === 0 && (
        <Text c="dimmed" ta="center" mt="xl">
          {t('users.no_users')}
        </Text>
      )}

      {members.length > 0 && (
        <Table highlightOnHover layout="fixed" bg="white">
          <Table.Thead>
            <Table.Tr>
              <Table.Th
                style={{
                  border: '1px solid var(--mantine-primary-color-1)',
                  borderLeft: 'none',
                }}
                fw={500}
                fz="md"
                py="0.5em"
              >
                {t('users.col_username')}
              </Table.Th>
              {isDesktop && (
                <Table.Th style={{ border: '1px solid var(--mantine-primary-color-1)' }} fw={500} fz="md" py="0.5em">
                  {t('users.col_name')}
                </Table.Th>
              )}
              {isDesktop && (
                <Table.Th style={{ border: '1px solid var(--mantine-primary-color-1)' }} fw={500} fz="md" py="0.5em">
                  {t('users.col_email')}
                </Table.Th>
              )}
              <Table.Th style={{ border: '1px solid var(--mantine-primary-color-1)' }} fw={500} fz="md" py="0.5em">
                {t('users.col_role')}
              </Table.Th>
              <Table.Th
                w={60}
                style={{
                  border: '1px solid var(--mantine-primary-color-1)',
                  borderRight: 'none',
                }}
                fw={500}
                fz="md"
                py="0.5em"
              />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {members.map((member: MemberRow) => {
              const isSelf = member.userId === currentUserId;
              const isOwner = (member.user?.roleIds || []).includes('owner');
              const canRemove = !isSelf && !isOwner;
              return (
                <Table.Tr key={member.id} styles={{ tr: { borderColor: 'var(--mantine-color-gray-1)' } }}>
                  <Table.Td>
                    <CellText>{member.user?.username ?? '—'}</CellText>
                  </Table.Td>
                  {isDesktop && (
                    <Table.Td>
                      <CellText>{getName(member)}</CellText>
                    </Table.Td>
                  )}
                  {isDesktop && (
                    <Table.Td>
                      <CellText>{getEmail(member)}</CellText>
                    </Table.Td>
                  )}
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

      <InviteModal opened={inviteOpen} onClose={handleCloseInvite} roleOptions={selectRoleOptions} />
    </Container>
  );
}
