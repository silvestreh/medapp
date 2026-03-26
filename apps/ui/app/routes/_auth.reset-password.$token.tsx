import { useState, useCallback } from 'react';
import { json, redirect, type ActionFunction, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useLoaderData, Link } from '@remix-run/react';
import { PasswordInput, Button, Paper, Title, Text, TextInput, Container, Anchor } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { styled } from '~/styled-system/jsx';

import createFeathersClient from '~/feathers';
import { getSession, commitSession } from '~/session';
import { PasswordChecklist } from '~/components/password-checklist';

const ErrorMessage = styled('div', {
  base: {
    color: 'var(--mantine-color-red-6)',
    bgColor: 'var(--mantine-color-red-0)',
    padding: 'var(--mantine-spacing-md)',
    marginBottom: 'var(--mantine-spacing-md)',
  },
});

export async function loader({ params }: LoaderFunctionArgs) {
  const token = params.token;
  if (!token) {
    return json({ valid: false, error: 'missing_token' });
  }

  return json({ valid: true, token });
}

export const action: ActionFunction = async ({ request, params }) => {
  const token = params.token;
  const formData = await request.formData();
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');
  const twoFactorCode = String(formData.get('twoFactorCode') || '');
  const apiUrl = process.env.API_URL ?? 'http://localhost:3030';
  const client = createFeathersClient(apiUrl);

  if (password !== confirmPassword) {
    return json({ errorKey: 'auth.passwords_mismatch', requireTwoFactor: false });
  }

  try {
    // We need to find the reset record by token to get its id
    // The service uses id-based patch, so we query internally
    // Instead, we'll use a custom approach: pass token in the data
    await client.service('password-resets').patch(null, {
      action: 'reset',
      token,
      password,
      twoFactorCode: twoFactorCode || undefined,
    });

    return json({ success: true, requireTwoFactor: false });
  } catch (error: any) {
    const errorData = error?.response?.data || error?.data || error || {};
    const errorReason = errorData?.reason || '';
    const rawMessage = errorData?.message || error?.message || '';

    if (errorReason === '2fa_required') {
      return json({ requireTwoFactor: true, errorKey: null });
    }

    if (rawMessage.includes('2FA code')) {
      return json({ requireTwoFactor: true, errorKey: 'auth.otp_invalid' });
    }

    if (rawMessage.includes('expired')) {
      return json({ errorKey: 'auth.reset_link_expired', requireTwoFactor: false });
    }

    if (rawMessage.includes('invalid') || rawMessage.includes('already been used')) {
      return json({ errorKey: 'auth.reset_link_invalid', requireTwoFactor: false });
    }

    return json({ errorKey: 'auth.reset_failed', requireTwoFactor: false });
  }
};

export default function ResetPassword() {
  const { valid } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  const requireTwoFactor = actionData?.requireTwoFactor ?? false;
  const errorKey = actionData?.errorKey;
  const success = actionData?.success ?? false;

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.currentTarget.value);
  }, []);

  if (!valid) {
    return (
      <Container size={420} my={40}>
        <Title ta="center" order={1}>
          {t('auth.reset_password_title')}
        </Title>
        <Paper withBorder shadow="md" p={30} mt={30} radius="md">
          <Text ta="center">{t('auth.reset_link_invalid')}</Text>
        </Paper>
      </Container>
    );
  }

  if (success) {
    return (
      <Container size={420} my={40}>
        <Title ta="center" order={1}>
          {t('auth.reset_password_title')}
        </Title>
        <Paper withBorder shadow="md" p={30} mt={30} radius="md">
          <Text ta="center" mb="lg">{t('auth.password_reset_success')}</Text>
          <Button component={Link} to="/login" fullWidth>
            {t('auth.sign_in')}
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center" order={1}>
        {t('auth.reset_password_title')}
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Form method="post">
          <div style={{ display: requireTwoFactor ? 'none' : undefined }}>
            <PasswordInput
              label={t('auth.new_password')}
              name="password"
              placeholder={t('auth.password_placeholder')}
              required={!requireTwoFactor}
              value={password}
              onChange={handlePasswordChange}
              mb="xs"
            />
            <PasswordChecklist password={password} onValidityChange={setIsPasswordValid} />
            <PasswordInput
              label={t('auth.confirm_password')}
              name="confirmPassword"
              placeholder={t('auth.confirm_password_placeholder')}
              required={!requireTwoFactor}
              mt="md"
              mb="xl"
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

          <Button type="submit" fullWidth disabled={!requireTwoFactor && !isPasswordValid}>
            {t('auth.reset_password_button')}
          </Button>
        </Form>
      </Paper>

      <Text c="dimmed" size="sm" ta="center" mt="md">
        <Anchor component={Link} to="/login" fw={600}>
          {t('auth.back_to_login')}
        </Anchor>
      </Text>
    </Container>
  );
}
