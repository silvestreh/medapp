import { useCallback, useEffect, useRef, useState } from 'react';
import { json, redirect, type ActionFunction, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Form, useActionData, useRouteLoaderData } from '@remix-run/react';
import { TextInput, PasswordInput, Button, Paper, Title, Text, Container, Divider } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { KeyRound } from 'lucide-react';
import axios from 'axios';

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
  const intent = String(formData.get('intent') || 'login');
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirect') || '/';

  if (intent === 'passkey') {
    const accessToken = String(formData.get('accessToken') || '');

    if (!accessToken) {
      return json({ requireTwoFactor: false, errorKey: 'auth.passkey_error' });
    }

    session.set('feathers-jwt', accessToken);

    return redirect(redirectTo, {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    });
  }

  const username = String(formData.get('username') || '');
  const password = String(formData.get('password') || '');
  const twoFactorCode = String(formData.get('twoFactorCode') || '');
  const client = createFeathersClient(process.env.API_URL ?? 'http://localhost:3030');

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
  const rootData = useRouteLoaderData<{ apiUrl?: string }>('root');
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  const requireTwoFactor = actionData?.requireTwoFactor ?? false;
  const errorKey = actionData?.errorKey;

  const handlePasskeyLogin = useCallback(async () => {
    setPasskeyError(null);
    setIsPasskeyLoading(true);

    try {
      const apiUrl = rootData?.apiUrl || 'http://localhost:3030';
      console.log('[passkey:login] starting passkey authentication, apiUrl=%s', apiUrl);

      const optionsRes = await axios.post(`${apiUrl}/webauthn`, {
        action: 'generate-authentication-options',
      });
      const { options, action: _action } = optionsRes.data;
      console.log('[passkey:login] received authentication options, challenge=%s rpId=%s', options.challenge?.slice(0, 16) + '...', options.rpId);

      console.log('[passkey:login] calling startAuthentication (browser prompt)...');
      const credential = await startAuthentication({ optionsJSON: options });
      console.log('[passkey:login] browser returned credential, id=%s type=%s', credential.id?.slice(0, 16) + '...', credential.type);

      console.log('[passkey:login] sending verification request...');
      const verifyRes = await axios.post(`${apiUrl}/webauthn`, {
        action: 'verify-authentication',
        credential,
        challenge: options.challenge,
      });
      console.log('[passkey:login] verification response: verified=%s hasToken=%s', verifyRes.data.verified, Boolean(verifyRes.data.accessToken));

      if (verifyRes.data.verified && verifyRes.data.accessToken) {
        const form = formRef.current;
        if (form) {
          const intentInput = form.querySelector<HTMLInputElement>('input[name="intent"]');
          const tokenInput = form.querySelector<HTMLInputElement>('input[name="accessToken"]');
          if (intentInput) intentInput.value = 'passkey';
          if (tokenInput) tokenInput.value = verifyRes.data.accessToken;
          console.log('[passkey:login] submitting form with JWT to set session cookie');
          form.submit();
          return;
        }
        console.error('[passkey:login] form ref is null, cannot submit');
      }

      console.warn('[passkey:login] verification did not return expected data', verifyRes.data);
      setPasskeyError(t('auth.passkey_error'));
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.log('[passkey:login] user cancelled the passkey prompt');
      } else {
        console.error('[passkey:login] error during passkey login:', error?.message || error, error?.response?.data);
        setPasskeyError(t('auth.passkey_error'));
      }
    } finally {
      setIsPasskeyLoading(false);
    }
  }, [t, rootData?.apiUrl]);

  const [supportsPasskeys, setSupportsPasskeys] = useState(false);

  useEffect(() => {
    setSupportsPasskeys(browserSupportsWebAuthn());
  }, []);

  return (
    <Container size={420} my={40}>
      <Title ta="center" order={1}>
        {t('auth.welcome_back')}
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Form method="post" ref={formRef}>
          <input type="hidden" name="intent" value="login" />
          <input type="hidden" name="accessToken" value="" />

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

          {passkeyError && (
            <ErrorMessage>
              <Text c="red" size="sm">
                {passkeyError}
              </Text>
            </ErrorMessage>
          )}

          <Button type="submit" fullWidth>
            {t('auth.sign_in')}
          </Button>
        </Form>

        {!requireTwoFactor && supportsPasskeys && (
          <>
            <Divider label="or" labelPosition="center" my="lg" />
            <Button
              fullWidth
              variant="light"
              leftSection={<KeyRound size={18} />}
              onClick={handlePasskeyLogin}
              loading={isPasskeyLoading}
            >
              {t('auth.sign_in_passkey')}
            </Button>
          </>
        )}
      </Paper>
    </Container>
  );
}
