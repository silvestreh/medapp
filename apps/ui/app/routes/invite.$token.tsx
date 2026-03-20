import { useCallback, useState } from 'react';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useLoaderData } from '@remix-run/react';
import { Alert, Button, Container, Paper, PasswordInput, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { WarningCircleIcon, CheckIcon } from '@phosphor-icons/react';

import createFeathersClient from '~/feathers';
import { getSession, commitSession } from '~/session';
import { PasswordChecklist } from '~/components/password-checklist';

type InviteData = {
  id: string;
  organizationId: string;
  status: string;
  expiresAt: string;
  userId: string | null;
  token: string;
  isNewUser: boolean;
  organizationName?: string;
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { token } = params;
  if (!token) throw redirect('/login');

  const apiUrl = process.env.API_URL ?? 'http://localhost:3030';
  const client = createFeathersClient(apiUrl);

  try {
    const result = await client.service('invites').find({
      query: { token },
    });

    const invites = Array.isArray(result) ? result : ((result as any)?.data ?? []);
    const invite = invites[0] as InviteData | undefined;

    if (!invite) {
      return json({ invite: null, error: 'not_found' });
    }

    let organizationName = '';
    try {
      const session = await getSession(request.headers.get('Cookie'));
      const jwt = session.get('feathers-jwt');
      if (jwt) {
        const authedClient = createFeathersClient(apiUrl);
        await authedClient.authenticate({ strategy: 'jwt', accessToken: jwt });
        const org = await authedClient.service('organizations').get(invite.organizationId);
        organizationName = (org as any)?.name ?? '';
      }
    } catch {
      // not authenticated or org not accessible
    }

    const isExpired = new Date(invite.expiresAt) < new Date();

    return json({
      invite: {
        ...invite,
        organizationName,
      },
      error: isExpired ? 'expired' : invite.status !== 'pending' ? invite.status : null,
    });
  } catch {
    return json({ invite: null, error: 'not_found' });
  }
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { token } = params;
  if (!token) throw redirect('/login');

  const formData = await request.formData();
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (password && password !== confirmPassword) {
    return json({ ok: false, error: 'passwords_mismatch' }, { status: 400 });
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3030';
  const client = createFeathersClient(apiUrl);

  try {
    const result = await client.service('invites').find({
      query: { token },
    });

    const invites = Array.isArray(result) ? result : ((result as any)?.data ?? []);
    const invite = invites[0] as InviteData | undefined;

    if (!invite) {
      return json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    await client.service('invites').patch(invite.id, {
      action: 'accept',
      ...(password ? { password } : {}),
    } as any);

    const session = await getSession(request.headers.get('Cookie'));

    if (password) {
      return redirect('/login', {
        headers: { 'Set-Cookie': await commitSession(session) },
      });
    }

    const jwt = session.get('feathers-jwt');
    if (jwt) {
      session.set('currentOrganizationId', invite.organizationId);
      return redirect('/', {
        headers: { 'Set-Cookie': await commitSession(session) },
      });
    }

    return redirect('/login', {
      headers: { 'Set-Cookie': await commitSession(session) },
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'accept_failed' }, { status: 400 });
  }
};

export default function InviteAcceptPage() {
  const { invite, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  const handleSubmit = useCallback(() => {
    setSubmitting(true);
  }, []);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.currentTarget.value);
  }, []);

  if (!invite || error === 'not_found') {
    return (
      <Container size={420} my={40}>
        <Paper withBorder shadow="md" p={30} mt={30} radius="md">
          <Alert icon={<WarningCircleIcon size={16} />} color="red" title={t('invite.invalid_title')}>
            {t('invite.not_found')}
          </Alert>
        </Paper>
      </Container>
    );
  }

  if (error === 'expired') {
    return (
      <Container size={420} my={40}>
        <Paper withBorder shadow="md" p={30} mt={30} radius="md">
          <Alert icon={<WarningCircleIcon size={16} />} color="orange" title={t('invite.expired_title')}>
            {t('invite.expired')}
          </Alert>
        </Paper>
      </Container>
    );
  }

  if (error === 'accepted') {
    return (
      <Container size={420} my={40}>
        <Paper withBorder shadow="md" p={30} mt={30} radius="md">
          <Alert icon={<CheckIcon size={16} />} color="teal" title={t('invite.already_accepted_title')}>
            {t('invite.already_accepted')}
          </Alert>
        </Paper>
      </Container>
    );
  }

  const showPasswordForm = invite?.isNewUser;

  return (
    <Container size={420} my={40}>
      <Title ta="center" order={1}>
        {t('invite.title')}
      </Title>

      {invite.organizationName && (
        <Text ta="center" c="dimmed" mt="sm">
          {t('invite.join_org', { org: invite.organizationName })}
        </Text>
      )}

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        {actionData && !actionData.ok && (
          <Alert icon={<WarningCircleIcon size={16} />} color="red" mb="md">
            {actionData.error === 'passwords_mismatch' ? t('invite.passwords_mismatch') : actionData.error}
          </Alert>
        )}

        <Form method="post" onSubmit={handleSubmit}>
          {showPasswordForm && (
            <>
              <Text mb="md">{t('invite.set_password_description')}</Text>
              <PasswordInput
                label={t('invite.password')}
                name="password"
                placeholder={t('invite.password_placeholder')}
                required
                value={password}
                onChange={handlePasswordChange}
                mb="xs"
              />
              <PasswordChecklist password={password} onValidityChange={setIsPasswordValid} />
              <PasswordInput
                label={t('invite.confirm_password')}
                name="confirmPassword"
                placeholder={t('invite.confirm_password_placeholder')}
                required
                mb="xl"
                mt="md"
              />
            </>
          )}

          {!showPasswordForm && <Text mb="xl">{t('invite.accept_description')}</Text>}

          <Button type="submit" fullWidth loading={submitting} disabled={showPasswordForm ? !isPasswordValid : false}>
            {showPasswordForm ? t('invite.set_password_and_join') : t('invite.accept')}
          </Button>
        </Form>
      </Paper>
    </Container>
  );
}
