import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Code, Group, Image, Modal, Popover, Stack, Text, TextInput, Tooltip, ActionIcon } from '@mantine/core';
import { useClickOutside } from '@mantine/hooks';
import { Form, useFetcher } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Check, InfoIcon, KeyRound, Pencil, Trash2, X } from 'lucide-react';
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

function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return '';

  const ua = navigator.userAgent;

  let browser = 'Browser';
  if ((navigator as any).userAgentData?.brands) {
    const brands = (navigator as any).userAgentData.brands as { brand: string; version: string }[];
    const preferred = brands.find(
      (b) => !b.brand.includes('Not') && b.brand !== 'Chromium'
    );
    if (preferred) browser = preferred.brand;
  } else if (ua.includes('Firefox/')) {
    browser = 'Firefox';
  } else if (ua.includes('Edg/')) {
    browser = 'Edge';
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    browser = 'Opera';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Safari';
  } else if (ua.includes('Chrome/')) {
    browser = 'Chrome';
  }

  let os = '';
  const platform = ((navigator as any).userAgentData?.platform || '').toLowerCase();
  if (platform === 'macos' || /Mac OS X/.test(ua)) {
    os = 'macOS';
  } else if (platform === 'windows' || /Windows/.test(ua)) {
    os = 'Windows';
  } else if (platform === 'ios' || /iPhone|iPad|iPod/.test(ua)) {
    os = 'iOS';
  } else if (platform === 'android' || /Android/.test(ua)) {
    os = 'Android';
  } else if (platform === 'linux' || /Linux/.test(ua)) {
    os = 'Linux';
  } else if (platform === 'chromeos' || /CrOS/.test(ua)) {
    os = 'ChromeOS';
  }

  return os ? `${browser} on ${os}` : browser;
}

type PasskeyRowProps = {
  passkey: PasskeyCredentialItem;
  onRemove: (id: string) => void;
  onRename: (id: string, newName: string) => void;
};

function PasskeyRow({ passkey, onRemove, onRename }: PasskeyRowProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useClickOutside(() => setConfirmOpen(false));

  const displayName = passkey.deviceName || 'Passkey';

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleStartEditing = useCallback(() => {
    setEditing(true);
  }, []);

  const handleConfirm = useCallback(() => {
    const newName = inputRef.current?.value?.trim() || '';
    if (newName && newName !== displayName) {
      onRename(passkey.id, newName);
    }
    setEditing(false);
  }, [displayName, onRename, passkey.id]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    },
    [handleConfirm, handleCancel]
  );

  const handleOpenConfirm = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const handleCloseConfirm = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  const handleRemove = useCallback(() => {
    setConfirmOpen(false);
    onRemove(passkey.id);
  }, [onRemove, passkey.id]);

  return (
    <FieldRow>
      <Group gap="sm" wrap="nowrap" className={css({ flex: 1, justifyContent: 'space-between' })}>
        <Group gap="sm" wrap="nowrap" className={css({ flex: 1, minWidth: 0 })}>
          <KeyRound size={18} style={{ flexShrink: 0 }} />
          <div className={css({ flex: 1, minWidth: 0 })}>
            {!editing && (
              <Group gap={4} wrap="nowrap">
                <Text size="sm" fw={500} truncate>
                  {displayName}
                </Text>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={handleStartEditing}
                  aria-label={t('common.edit')}
                >
                  <Pencil size={14} />
                </ActionIcon>
              </Group>
            )}
            {editing && (
              <Group gap={4} wrap="nowrap">
                <TextInput
                  ref={inputRef}
                  size="xs"
                  defaultValue={displayName}
                  onKeyDown={handleKeyDown}
                  className={css({ flex: 1 })}
                />
                <ActionIcon variant="subtle" color="teal" size="sm" onClick={handleConfirm}>
                  <Check size={16} />
                </ActionIcon>
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleCancel}>
                  <X size={16} />
                </ActionIcon>
              </Group>
            )}
            <Text size="xs" c="dimmed">
              {t('profile.passkeys_registered')}: {new Date(passkey.createdAt).toLocaleDateString()}
            </Text>
          </div>
        </Group>
        <Popover
          position="left"
          withArrow
          arrowSize={12}
          opened={confirmOpen}
          shadow="xs"
        >
          <Popover.Target>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={handleOpenConfirm}
              aria-label={t('profile.passkeys_remove')}
            >
              <Trash2 size={16} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown ref={popoverRef}>
            <Stack align="flex-end">
              <Text size="sm">{t('profile.passkeys_remove_confirm')}</Text>
              <Group>
                <Button size="compact-sm" color="red" onClick={handleRemove}>
                  {t('common.delete')}
                </Button>
                <Button size="compact-sm" variant="outline" onClick={handleCloseConfirm}>
                  {t('common.cancel')}
                </Button>
              </Group>
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>
    </FieldRow>
  );
}

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
      const optionsData = await feathersClient.service('webauthn').create({
        action: 'generate-registration-options',
      });

      const regOptions = optionsData.options;
      if (!regOptions) {
        throw new Error('No registration options received');
      }

      const credential = await startRegistration({ optionsJSON: regOptions });

      const deviceName = getDeviceLabel();

      await feathersClient.service('webauthn').create({
        action: 'verify-registration',
        credential,
        deviceName,
      });

      setPasskeyAlert({ type: 'success', message: t('profile.passkeys_add_success') });

      const revalidateForm = new FormData();
      revalidateForm.set('intent', 'passkey-register-verify');
      fetcher.submit(revalidateForm, { method: 'post' });
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        setPasskeyAlert({ type: 'error', message: t('profile.passkeys_add_error') });
      }
    } finally {
      setIsRegisteringPasskey(false);
    }
  }, [t, feathersClient, fetcher]);

  const handleRemovePasskey = useCallback(
    async (id: string) => {
      try {
        await feathersClient.service('passkey-credentials').remove(id);

        const form = new FormData();
        form.set('intent', 'passkey-remove');
        form.set('passkeyId', id);
        fetcher.submit(form, { method: 'post' });
      } catch (_error) {
        // passkey remove failed
      }
    },
    [fetcher, feathersClient]
  );

  const handleRenamePasskey = useCallback(
    async (id: string, newName: string) => {
      try {
        await feathersClient.service('passkey-credentials').patch(id, { deviceName: newName });
        const revalidateForm = new FormData();
        revalidateForm.set('intent', 'passkey-register-verify');
        fetcher.submit(revalidateForm, { method: 'post' });
      } catch (_error) {
        setPasskeyAlert({ type: 'error', message: t('profile.passkeys_add_error') });
      }
    },
    [feathersClient, fetcher, t]
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
        <Alert
          color={passkeyAlert.type === 'success' ? 'teal' : 'red'}
          withCloseButton
          onClose={() => setPasskeyAlert(null)}
        >
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
        {passkeys.map(passkey => (
          <PasskeyRow
            key={passkey.id}
            passkey={passkey}
            onRemove={handleRemovePasskey}
            onRename={handleRenamePasskey}
          />
        ))}
      </PasswordFormContainer>

      <div style={{ marginLeft: 'auto' }}>
        <Button leftSection={<KeyRound size={16} />} onClick={handleAddPasskey} loading={isRegisteringPasskey}>
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
