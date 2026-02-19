import { useEffect, useState } from 'react';
import { Alert, Button, Code, Group, Image, Modal, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { Form } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { InfoIcon } from 'lucide-react';

import Portal from '~/components/portal';
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
  showFormActions?: boolean;
};

export function ProfileSecurity({
  username,
  twoFactorEnabled,
  actionData,
  showFormActions = true,
}: ProfileSecurityProps) {
  const { t } = useTranslation();
  const [setupModalClosed, setSetupModalClosed] = useState(false);
  const [setupPayload, setSetupPayload] = useState<TwoFactorSetupPayload | null>(null);

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
