import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Code, Group, Image, Modal, Stack, Text, TextInput, Tooltip, ActionIcon } from '@mantine/core';
import { Form, useFetcher } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { InfoIcon, KeyRound, Trash2 } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';

import Portal from '~/components/portal';
import { useFeathers } from '~/components/provider';
import { css } from '~/styled-system/css';
import {
  FieldRow,
  Label,
  StyledPasswordInput,
  StyledTextInput,
  StyledTitle,
  FormHeader,
} from '~/components/forms/styles';
import { styled } from '~/styled-system/jsx';

const PasswordFormContainer = styled('div', {
  base: {
    background: 'white',
    border: '1px solid var(--mantine-color-gray-2)',
    borderRadius: 'var(--mantine-radius-md)',
  },
});

export type TwoFactorSetupPayload = {
  secret: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
};

export type PasskeyCredentialItem = {
  id: string;
  deviceName: string | null;
  createdAt: string;
};

export type ProfileSecurityActionData = {
  ok: boolean;
  intent: string;
  result?: TwoFactorSetupPayload;
  error?: string;
};

type ProfileSecurityProps = {
  username: string;
  twoFactorEnabled: boolean;
  actionData: ProfileSecurityActionData | undefined;
  passkeys: PasskeyCredentialItem[];
  showFormActions?: boolean;
};

export function ProfileSecurity({
  username,
  twoFactorEnabled,
  actionData,
  passkeys,
  showFormActions = true,
}: ProfileSecurityProps) {
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const feathersClient = useFeathers();
  const [setupModalClosed, setSetupModalClosed] = useState(false);
  const [setupPayload, setSetupPayload] = useState<TwoFactorSetupPayload | null>(null);
  const [passkeyAlert, setPasskeyAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);

  const hasSetupResult = actionData?.ok && actionData.intent === 'setup-2fa';
  const setupResult: TwoFactorSetupPayload | null =
    hasSetupResult && actionData && 'result' in actionData && actionData.result
      ? (actionData.result as TwoFactorSetupPayload)
      : null;
  const setupSecret = setupResult?.secret ?? setupPayload?.secret ?? '';
  const setupUri = setupResult?.otpauthUri ?? setupPayload?.otpauthUri ?? '';
  const qrCodeDataUrl = setupResult?.qrCodeDataUrl ?? setupPayload?.qrCodeDataUrl ?? '';

  const hasEnableSuccess = actionData?.ok && actionData.intent === 'enable-2fa';
  const hasPasswordSuccess = actionData?.ok && actionData.intent === 'change-password';
  const isPasswordError = actionData?.ok === false && actionData.intent === 'change-password';
  const isEnableError = actionData?.ok === false && actionData.intent === 'enable-2fa';
  const errorMessage = actionData?.ok === false && actionData && 'error' in actionData ? actionData.error : '';

  const hasSetupData = Boolean(setupSecret || setupPayload);
  const setupModalOpen = Boolean(hasSetupData && !twoFactorEnabled && !setupModalClosed);

  useEffect(() => {
    if (hasSetupResult && setupResult && !twoFactorEnabled) {
      setSetupPayload(setupResult);
      setSetupModalClosed(false);
    }
  }, [hasSetupResult, setupResult, twoFactorEnabled]);

  useEffect(() => {
    if (hasEnableSuccess) {
      setSetupPayload(null);
    }
  }, [hasEnableSuccess]);

  const handleAddPasskey = useCallback(async () => {
    setPasskeyAlert(null);
    setIsRegisteringPasskey(true);

    try {
      console.log('[passkey:register] requesting registration options via feathers client...');
      const optionsData = await feathersClient.service('webauthn').create({
        action: 'generate-registration-options',
      });
      console.log('[passkey:register] got options, action=%s', optionsData.action);

      const regOptions = optionsData.options;
      if (!regOptions) {
        console.error('[passkey:register] no options in response:', optionsData);
        throw new Error('No registration options received');
      }

      console.log('[passkey:register] registration options: rp.id=%s rp.name=%s challenge=%s', regOptions.rp?.id, regOptions.rp?.name, regOptions.challenge?.slice(0, 16) + '...');

      console.log('[passkey:register] calling startRegistration (browser prompt)...');
      const credential = await startRegistration({ optionsJSON: regOptions });
      console.log('[passkey:register] browser returned credential, id=%s type=%s', credential.id?.slice(0, 16) + '...', credential.type);

      const deviceName = prompt(t('profile.passkeys_device_name_placeholder')) || '';
      console.log('[passkey:register] verifying registration with deviceName=%s', deviceName || '(none)');

      const verifyResult = await feathersClient.service('webauthn').create({
        action: 'verify-registration',
        credential,
        deviceName,
      });
      console.log('[passkey:register] verification result: verified=%s backedUp=%s', verifyResult.verified, verifyResult.backedUp);

      setPasskeyAlert({ type: 'success', message: t('profile.passkeys_add_success') });

      // Trigger a revalidation so the passkey list refreshes
      const revalidateForm = new FormData();
      revalidateForm.set('intent', 'passkey-register-verify');
      fetcher.submit(revalidateForm, { method: 'post' });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.log('[passkey:register] user cancelled the passkey prompt');
      } else {
        console.error('[passkey:register] error during registration:', error?.message || error, error);
        setPasskeyAlert({ type: 'error', message: t('profile.passkeys_add_error') });
      }
    } finally {
      setIsRegisteringPasskey(false);
    }
  }, [t, fetcher, feathersClient]);

  const handleRemovePasskey = useCallback(
    async (id: string) => {
      if (!confirm(t('profile.passkeys_remove_confirm'))) return;

      try {
        console.log('[passkey:remove] removing passkey id=%s', id);
        await feathersClient.service('passkey-credentials').remove(id);
        console.log('[passkey:remove] passkey removed');

        // Trigger revalidation
        const form = new FormData();
        form.set('intent', 'passkey-remove');
        form.set('passkeyId', id);
        fetcher.submit(form, { method: 'post' });
      } catch (error: any) {
        console.error('[passkey:remove] error:', error?.message || error);
      }
    },
    [t, fetcher, feathersClient]
  );

  return (
    <>
      <FormHeader>
        <StyledTitle>{t('profile.setup_2fa_title')}</StyledTitle>
      </FormHeader>
      <PasswordFormContainer>
        <FieldRow>
          <Label>{t('profile.username')}:</Label>
          <StyledTextInput value={username} readOnly />
        </FieldRow>
        <FieldRow>
          <Label>{t('profile.two_factor_status')}:</Label>
          <Text c={twoFactorEnabled ? 'teal' : 'gray'}>
            <strong>{twoFactorEnabled ? t('profile.two_factor_enabled') : t('profile.two_factor_disabled')}</strong>{' '}
            {twoFactorEnabled && (
              <Tooltip label={t('profile.two_factor_enabled_notice')}>
                <InfoIcon size={16} />
              </Tooltip>
            )}
          </Text>
        </FieldRow>
      </PasswordFormContainer>

      {!twoFactorEnabled && (
        <Form method="post" style={{ marginLeft: 'auto' }}>
          <input type="hidden" name="intent" value="setup-2fa" />
          <Button type="submit">{t('profile.setup_2fa')}</Button>
        </Form>
      )}

      <Modal title={t('profile.setup_2fa')} opened={setupModalOpen} onClose={() => setSetupModalClosed(true)} size="sm">
        <Stack gap="md">
          <Alert color="blue">{t('profile.setup_2fa_instructions')}</Alert>
          <div>
            <Text size="sm" c="dimmed" mb={4}>
              {t('profile.setup_key')}
            </Text>
            <Code block>{setupSecret}</Code>
          </div>
          <div>
            <Text size="sm" c="dimmed" mb={4}>
              {t('profile.scan_qr')}
            </Text>
            <Image
              src={qrCodeDataUrl}
              alt={t('profile.scan_qr')}
              width={220}
              height={220}
              fit="contain"
              radius="sm"
              style={{ border: '1px solid var(--mantine-color-gray-3)' }}
            />
          </div>
          <div>
            <Text size="sm" c="dimmed" mb={4}>
              {t('profile.otp_auth_uri')}
            </Text>
            <Code block>{setupUri}</Code>
          </div>
          <Form method="post">
            <input type="hidden" name="intent" value="enable-2fa" />
            {isEnableError && (
              <Alert color="red">{typeof errorMessage === 'string' ? errorMessage : String(errorMessage)}</Alert>
            )}
            <Group align="end" mt="sm">
              <TextInput
                name="twoFactorCode"
                label={t('profile.two_factor_code')}
                placeholder="123456"
                required
                style={{ flex: 1 }}
              />
              <Button type="submit" variant="filled" color="teal">
                {t('profile.enable_2fa')}
              </Button>
            </Group>
          </Form>
        </Stack>
      </Modal>

      {hasEnableSuccess && <Alert color="teal">{t('profile.enable_2fa_success')}</Alert>}

      <FormHeader>
        <StyledTitle style={{ marginTop: '2rem' }}>{t('profile.passkeys_title')}</StyledTitle>
      </FormHeader>

      <Text size="sm" c="dimmed">
        {t('profile.passkeys_description')}
      </Text>

      {passkeyAlert && (
        <Alert color={passkeyAlert.type === 'success' ? 'teal' : 'red'} withCloseButton onClose={() => setPasskeyAlert(null)}>
          {passkeyAlert.message}
        </Alert>
      )}

      <PasswordFormContainer>
        {passkeys.length === 0 && (
          <FieldRow>
            <Text c="dimmed" size="sm">
              {t('profile.passkeys_empty')}
            </Text>
          </FieldRow>
        )}
        {passkeys.map((passkey) => (
          <FieldRow key={passkey.id}>
            <Group
              gap="sm"
              wrap="nowrap"
              className={css({ flex: 1, justifyContent: 'space-between' })}
            >
              <Group gap="sm" wrap="nowrap">
                <KeyRound size={18} />
                <div>
                  <Text size="sm" fw={500}>
                    {passkey.deviceName || 'Passkey'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t('profile.passkeys_registered')}: {new Date(passkey.createdAt).toLocaleDateString()}
                  </Text>
                </div>
              </Group>
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => handleRemovePasskey(passkey.id)}
                aria-label={t('profile.passkeys_remove')}
              >
                <Trash2 size={16} />
              </ActionIcon>
            </Group>
          </FieldRow>
        ))}
      </PasswordFormContainer>

      <div style={{ marginLeft: 'auto' }}>
        <Button
          leftSection={<KeyRound size={16} />}
          onClick={handleAddPasskey}
          loading={isRegisteringPasskey}
        >
          {t('profile.passkeys_add')}
        </Button>
      </div>

      <FormHeader>
        <StyledTitle style={{ marginTop: '2rem' }}>{t('profile.change_password')}</StyledTitle>
      </FormHeader>

      {hasPasswordSuccess && <Alert color="teal">{t('profile.password_success')}</Alert>}
      {isPasswordError && (
        <Alert color="red">{typeof errorMessage === 'string' ? errorMessage : String(errorMessage)}</Alert>
      )}

      <Form
        id="profile-change-password-form"
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
        {showFormActions && (
          <Portal id="form-actions">
            <Button type="submit" form="profile-change-password-form">
              {t('profile.update_password')}
            </Button>
          </Portal>
        )}
      </Form>
    </>
  );
}
