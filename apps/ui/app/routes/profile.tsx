import { Alert, Button, Code, Group, Image, Text, Tooltip } from '@mantine/core';
import type { Application } from '@feathersjs/feathers';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Form, useActionData, useLoaderData } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { InfoIcon } from 'lucide-react';

import { getAuthenticatedClient } from '~/utils/auth.server';
import { styled } from '~/styled-system/jsx';
import { css } from '~/styled-system/css';
import {
  FormContainer,
  FormCard,
  FieldRow,
  Label,
  StyledTextInput,
  StyledPasswordInput,
  StyledTitle,
} from '~/components/forms/styles';

const PasswordFormContainer = styled('div', {
  base: {
    background: 'white',
    border: '1px solid var(--mantine-color-gray-2)',
    borderRadius: 'var(--mantine-radius-md)',
  },
});

const buildTwoFactorSetupPayload = async (result: { secret: string; otpauthUri: string }) => {
  const qrCodeDataUrl = await QRCode.toDataURL(result.otpauthUri, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
  });

  return {
    secret: result.secret,
    otpauthUri: result.otpauthUri,
    qrCodeDataUrl,
  };
};

export const meta: MetaFunction = () => {
  return [{ title: 'Profile | MedApp' }];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { client, user } = await getAuthenticatedClient(request);
    const profile = await client.service('profile').get('me');

    return json({
      username: user.username,
      twoFactorEnabled: Boolean(profile.twoFactorEnabled),
    });
  } catch (error) {
    throw redirect('/login');
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');
  let client: Application;
  try {
    const authenticated = await getAuthenticatedClient(request);
    client = authenticated.client;
  } catch (error) {
    throw redirect('/login');
  }

  try {
    if (intent === 'setup-2fa') {
      const result = await client.service('profile').create({ action: 'setup-2fa' });
      const setup = await buildTwoFactorSetupPayload(result);
      return json({ ok: true, intent, result: setup });
    }

    if (intent === 'enable-2fa') {
      const twoFactorCode = String(formData.get('twoFactorCode') || '');
      const result = await client.service('profile').create({ action: 'enable-2fa', twoFactorCode });
      return json({ ok: true, intent, result });
    }

    if (intent === 'change-password') {
      const currentPassword = String(formData.get('currentPassword') || '');
      const newPassword = String(formData.get('newPassword') || '');
      const twoFactorCode = String(formData.get('twoFactorCode') || '');

      const result = await client.service('profile').create({
        action: 'change-password',
        currentPassword,
        newPassword,
        twoFactorCode,
      });

      return json({ ok: true, intent, result });
    }

    return json({ ok: false, intent, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return json(
      {
        ok: false,
        intent,
        error: error?.message || 'Operation failed',
      },
      { status: 400 }
    );
  }
};

export default function Profile() {
  const { username, twoFactorEnabled } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation();

  const hasSetupResult = actionData?.ok && actionData.intent === 'setup-2fa';
  const setupSecret = hasSetupResult && actionData && 'result' in actionData ? actionData.result?.secret || '' : '';
  const setupUri = hasSetupResult && actionData && 'result' in actionData ? actionData.result?.otpauthUri || '' : '';
  const qrCodeDataUrl =
    hasSetupResult && actionData && 'result' in actionData ? actionData.result?.qrCodeDataUrl || '' : '';

  const hasEnableSuccess = actionData?.ok && actionData.intent === 'enable-2fa';
  const hasPasswordSuccess = actionData?.ok && actionData.intent === 'change-password';
  const isPasswordError = actionData?.ok === false && actionData.intent === 'change-password';
  const isEnableError = actionData?.ok === false && actionData.intent === 'enable-2fa';
  const errorMessage = actionData?.ok === false && actionData && 'error' in actionData ? actionData.error : '';

  return (
    <FormContainer style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <StyledTitle>{t('profile.title')}</StyledTitle>
      <FormCard>
        <FieldRow>
          <Label>{t('profile.username')}:</Label>
          <StyledTextInput value={username} readOnly />
        </FieldRow>
        <FieldRow>
          <Label>{t('profile.two_factor_status')}:</Label>
          <Text c={twoFactorEnabled ? 'teal' : 'gray'}>
            <strong>{twoFactorEnabled ? t('profile.two_factor_enabled') : t('profile.two_factor_disabled')}</strong>{' '}
            <Tooltip label={t('profile.two_factor_enabled_notice')}>
              <InfoIcon size={16} />
            </Tooltip>
          </Text>
        </FieldRow>

        {!twoFactorEnabled && !hasSetupResult && (
          <FieldRow>
            <Form method="post">
              <input type="hidden" name="intent" value="setup-2fa" />
              <Button type="submit" variant="light">
                {t('profile.setup_2fa')}
              </Button>
            </Form>
          </FieldRow>
        )}
      </FormCard>

      {hasSetupResult && !twoFactorEnabled && (
        <>
          <FormCard>
            <FieldRow stacked>
              <Alert color="blue" mb="sm">
                {t('profile.setup_2fa_instructions')}
              </Alert>
            </FieldRow>
            <FieldRow>
              <Label>{t('profile.setup_key')}:</Label>
              <Code block style={{ flex: 1 }}>
                {setupSecret}
              </Code>
            </FieldRow>
            <FieldRow>
              <Label>{t('profile.scan_qr')}:</Label>
              <Image
                src={qrCodeDataUrl}
                alt={t('profile.scan_qr')}
                width={220}
                height={220}
                fit="contain"
                radius="sm"
                style={{ border: '1px solid var(--mantine-color-gray-3)' }}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('profile.otp_auth_uri')}:</Label>
              <Code block style={{ flex: 1 }}>
                {setupUri}
              </Code>
            </FieldRow>
            <FieldRow>
              <Form method="post">
                <input type="hidden" name="intent" value="enable-2fa" />
                {isEnableError && (
                  <Alert color="red" mb="sm">
                    {errorMessage}
                  </Alert>
                )}
                <Group align="end">
                  <StyledTextInput name="twoFactorCode" placeholder="123456" required style={{ width: 180 }} />
                  <Button type="submit" variant="light">
                    {t('profile.enable_2fa')}
                  </Button>
                </Group>
              </Form>
            </FieldRow>
          </FormCard>
        </>
      )}

      {hasEnableSuccess && <Alert color="teal">{t('profile.enable_2fa_success')}</Alert>}

      <StyledTitle style={{ marginTop: '1rem' }}>{t('profile.change_password')}</StyledTitle>

      {hasPasswordSuccess && <Alert color="teal">{t('profile.password_success')}</Alert>}
      {isPasswordError && <Alert color="red">{errorMessage}</Alert>}

      <Form
        method="post"
        key={hasPasswordSuccess ? 'reset' : 'form'}
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        })}
      >
        <PasswordFormContainer>
          <input type="hidden" name="intent" value="change-password" />
          <FieldRow>
            <Label>{t('profile.current_password')}:</Label>
            <StyledPasswordInput name="currentPassword" required placeholder={t('profile.current_password')} />
          </FieldRow>
          <FieldRow>
            <Label>{t('profile.new_password')}:</Label>
            <StyledPasswordInput name="newPassword" required placeholder={t('profile.new_password')} />
          </FieldRow>
          {twoFactorEnabled && (
            <FieldRow>
              <Label>{t('profile.two_factor_code')}:</Label>
              <StyledTextInput name="twoFactorCode" placeholder="123456" required />
            </FieldRow>
          )}
        </PasswordFormContainer>
        <Button ml="auto" type="submit">
          {t('profile.update_password')}
        </Button>
      </Form>
    </FormContainer>
  );
}
