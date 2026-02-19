import { json, redirect, type ActionFunction, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Form, useActionData } from '@remix-run/react';
import { TextInput, PasswordInput, Button, Paper, Title, Text, Container } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import createFeathersClient from '~/feathers';
import { getSession, commitSession, destroySession } from '~/session';
import { getPageTitle } from '~/utils/meta';
import { styled } from '~/styled-system/jsx';

const ErrorMessage = styled('div', {
  base: {
    color: 'var(--mantine-color-red-6)',
    bgColor: 'var(--mantine-color-red-0)',
    padding: 'var(--mantine-spacing-md)',
    marginBottom: 'var(--mantine-spacing-md)',
  },
});

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'login') }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const token = session.get('feathers-jwt');

  if (token) {
    try {
      const client = createFeathersClient(process.env.API_URL ?? 'http://localhost:3030');
      await client.authenticate({
        strategy: 'jwt',
        accessToken: token,
      });
      return redirect('/');
    } catch {
      await destroySession(session);
    }
  }

  return json(null);
}

export const action: ActionFunction = async ({ request }) => {
  const session = await getSession(request.headers.get('Cookie'));
  const formData = await request.formData();
  const username = String(formData.get('username') || '');
  const password = String(formData.get('password') || '');
  const twoFactorCode = String(formData.get('twoFactorCode') || '');
  const client = createFeathersClient(process.env.API_URL ?? 'http://localhost:3030');
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirect') || '/';

  try {
    const { accessToken } = await client.authenticate({
      strategy: 'local',
      username,
      password,
      twoFactorCode: twoFactorCode || undefined,
    });

    session.set('feathers-jwt', accessToken);

    return redirect(redirectTo, {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    });
  } catch (error: any) {
    const errorData = error?.response?.data || error?.data || error || {};
    const errorReason = errorData?.reason || '';
    const rawMessage = errorData?.message || error?.message || '';
    const message = String(rawMessage).toLowerCase();

    const isTwoFactorRequired =
      errorReason === '2fa_required' || message.includes('2fa_required') || message.includes('2fa code is required');
    const isInvalidTwoFactorCode =
      errorReason === 'invalid_2fa_code' ||
      message.includes('invalid_2fa_code') ||
      message.includes('invalid 2fa code');

    if (isTwoFactorRequired) {
      return json({ requireTwoFactor: true, error: null });
    }

    if (isInvalidTwoFactorCode) {
      return json({ requireTwoFactor: true, errorKey: 'auth.otp_invalid' });
    }

    return json({ requireTwoFactor: false, errorKey: 'auth.invalid_credentials' });
  }
};

export default function Login() {
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation();

  const requireTwoFactor = actionData?.requireTwoFactor ?? false;
  const errorKey = actionData?.errorKey;

  return (
    <Container size={420} my={40}>
      <Title ta="center" order={1}>
        {t('auth.welcome_back')}
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Form method="post">
          <div style={{ display: requireTwoFactor ? 'none' : undefined }}>
            <TextInput
              label={t('auth.username')}
              name="username"
              placeholder={t('auth.username_placeholder')}
              required={!requireTwoFactor}
              mb="md"
            />
            <PasswordInput
              label={t('auth.password')}
              name="password"
              placeholder={t('auth.password_placeholder')}
              required={!requireTwoFactor}
              mb={errorKey ? 'md' : 'xl'}
            />
          </div>

          {requireTwoFactor && (
            <>
              <Text size="sm" ta="center" mb="lg" fz="h5">
                {t('auth.otp_prompt')}
              </Text>
              <TextInput
                label={t('auth.otp_label')}
                name="twoFactorCode"
                placeholder="123456"
                autoComplete="one-time-code"
                autoFocus
                required
                mb="xl"
              />
            </>
          )}

          {errorKey && (
            <ErrorMessage>
              <Text c="red" size="sm">
                {t(errorKey)}
              </Text>
            </ErrorMessage>
          )}

          <Button type="submit" fullWidth>
            {t('auth.sign_in')}
          </Button>
        </Form>
      </Paper>
    </Container>
  );
}
