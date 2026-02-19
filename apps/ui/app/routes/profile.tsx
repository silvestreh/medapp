import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Code, Group, Image, Modal, Stack, Text, TextInput, Tooltip, Flex } from '@mantine/core';
import { useForm } from '@mantine/form';
import type { Application } from '@feathersjs/feathers';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Form, useActionData, useLoaderData, useNavigation, useRevalidator, useSubmit } from '@remix-run/react';
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
  StyledSelect,
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

type TwoFactorSetupPayload = {
  secret: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
};

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

function normalizeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && 'data' in value) {
    const data = (value as { data?: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }
  return [];
}

type MdSettingsProfile = {
  id: string;
  medicalSpecialty: string | null;
  nationalLicenseNumber: string | null;
  stateLicense: string | null;
  stateLicenseNumber: string | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { client, user } = await getAuthenticatedClient(request);
    const profile = await client.service('profile').get('me');
    const fullUser = await client.service('users').get(user.id);
    const isMedic = (fullUser as { roleId?: string }).roleId === 'medic';
    let mdSettingsRecord: MdSettingsProfile | null = null;
    if (isMedic) {
      const settings = (fullUser as { settings?: unknown }).settings;
      if (settings && typeof settings === 'object' && settings !== null && 'id' in settings) {
        const s = settings as {
          id: string;
          medicalSpecialty?: string | null;
          nationalLicenseNumber?: string | null;
          stateLicense?: string | null;
          stateLicenseNumber?: string | null;
        };
        mdSettingsRecord = {
          id: s.id,
          medicalSpecialty: s.medicalSpecialty ?? null,
          nationalLicenseNumber: s.nationalLicenseNumber ?? null,
          stateLicense: s.stateLicense ?? null,
          stateLicenseNumber: s.stateLicenseNumber ?? null,
        };
      } else {
        const mdResponse = await client.service('md-settings').find({
          query: { userId: user.id },
          paginate: false,
        });
        const list = normalizeArray<MdSettingsProfile>(mdResponse);
        const first = list[0];
        if (first) {
          mdSettingsRecord = {
            id: first.id,
            medicalSpecialty: first.medicalSpecialty ?? null,
            nationalLicenseNumber: first.nationalLicenseNumber ?? null,
            stateLicense: first.stateLicense ?? null,
            stateLicenseNumber: first.stateLicenseNumber ?? null,
          };
        }
      }
    }
    return json({
      username: user.username,
      twoFactorEnabled: Boolean(profile.twoFactorEnabled),
      user: fullUser,
      isMedic,
      mdSettings: mdSettingsRecord,
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

    if (intent === 'update-profile') {
      const payloadRaw = String(formData.get('payload') || '{}');
      const payload = JSON.parse(payloadRaw) as {
        personalData?: Record<string, unknown>;
        contactData?: Record<string, unknown>;
        mdSettings?: Record<string, unknown>;
      };
      await client.service('profile').create({
        action: 'update-profile',
        personalData: payload.personalData,
        contactData: payload.contactData,
        mdSettings: payload.mdSettings,
      });
      return json({ ok: true, intent });
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

type PersonalDataLike = { firstName?: string | null; lastName?: string | null } | undefined;
type ContactDataLike =
  | {
      email?: string | null;
      phoneNumber?: string | string[] | null;
      streetAddress?: string | null;
      city?: string | null;
      province?: string | null;
      country?: string | null;
    }
  | undefined;
type MdSettingsLike =
  | {
      medicalSpecialty?: string | null;
      nationalLicenseNumber?: string | null;
      stateLicense?: string | null;
      stateLicenseNumber?: string | null;
    }
  | undefined;

function buildSelectOptions(obj: Record<string, string>) {
  return Object.entries(obj).map(([value, label]) => ({ value, label }));
}

function getInitialProfileValues(
  user: { personalData?: PersonalDataLike; contactData?: ContactDataLike } | undefined,
  mdSettings: MdSettingsLike | null
) {
  const pd = user?.personalData;
  const cd = user?.contactData;
  const phone =
    cd?.phoneNumber == null ? '' : Array.isArray(cd.phoneNumber) ? cd.phoneNumber.join(', ') : String(cd.phoneNumber);
  return {
    firstName: pd?.firstName ?? '',
    lastName: pd?.lastName ?? '',
    email: cd?.email ?? '',
    phone,
    streetAddress: cd?.streetAddress ?? '',
    city: cd?.city ?? '',
    province: cd?.province ?? '',
    country: cd?.country ?? '',
    medicalSpecialty: mdSettings?.medicalSpecialty ?? '',
    nationalLicenseNumber: mdSettings?.nationalLicenseNumber ?? '',
    stateLicense: mdSettings?.stateLicense ?? '',
    stateLicenseNumber: mdSettings?.stateLicenseNumber ?? '',
  };
}

export default function Profile() {
  const { username, twoFactorEnabled, user, isMedic, mdSettings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const submit = useSubmit();
  const isSavingProfile = navigation.state === 'submitting' && navigation.formData?.get('intent') === 'update-profile';
  const { t } = useTranslation();
  const [setupModalClosed, setSetupModalClosed] = useState(false);
  const [setupPayload, setSetupPayload] = useState<TwoFactorSetupPayload | null>(null);

  const initialProfile = useMemo(
    () =>
      getInitialProfileValues(user as { personalData?: PersonalDataLike; contactData?: ContactDataLike }, mdSettings),
    [user, mdSettings]
  );
  const countryOptions = useMemo(
    () => buildSelectOptions(t('countries', { returnObjects: true }) as Record<string, string>),
    [t]
  );
  const provinceOptions = useMemo(
    () => buildSelectOptions(t('provinces', { returnObjects: true }) as Record<string, string>),
    [t]
  );
  const profileForm = useForm({
    initialValues: initialProfile,
  });
  useEffect(() => {
    profileForm.setValues(initialProfile);
  }, [user, mdSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasSetupResult = actionData?.ok && actionData.intent === 'setup-2fa';
  const setupResult: TwoFactorSetupPayload | null =
    hasSetupResult && actionData && 'result' in actionData ? (actionData.result as TwoFactorSetupPayload) : null;
  const setupSecret = setupResult?.secret ?? setupPayload?.secret ?? '';
  const setupUri = setupResult?.otpauthUri ?? setupPayload?.otpauthUri ?? '';
  const qrCodeDataUrl = setupResult?.qrCodeDataUrl ?? setupPayload?.qrCodeDataUrl ?? '';

  const hasEnableSuccess = actionData?.ok && actionData.intent === 'enable-2fa';
  const hasPasswordSuccess = actionData?.ok && actionData.intent === 'change-password';
  const hasProfileSuccess = actionData?.ok && actionData.intent === 'update-profile';
  const isProfileError = actionData?.ok === false && actionData.intent === 'update-profile';
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
      revalidator.revalidate();
    }
  }, [hasEnableSuccess, revalidator]);

  useEffect(() => {
    if (hasProfileSuccess) {
      revalidator.revalidate();
    }
  }, [hasProfileSuccess, revalidator]);

  const handleSaveProfile = useCallback(() => {
    const values = profileForm.values;
    const payload = {
      personalData: {
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined,
      },
      contactData: {
        email: values.email || undefined,
        phoneNumber: values.phone || undefined,
        streetAddress: values.streetAddress || undefined,
        city: values.city || undefined,
        province: values.province || undefined,
        country: values.country || undefined,
      },
      ...(isMedic
        ? {
            mdSettings: {
              medicalSpecialty: values.medicalSpecialty || undefined,
              nationalLicenseNumber: values.nationalLicenseNumber || undefined,
              stateLicense: values.stateLicense || undefined,
              stateLicenseNumber: values.stateLicenseNumber || undefined,
            },
          }
        : {}),
    };
    const formData = new FormData();
    formData.set('intent', 'update-profile');
    formData.set('payload', JSON.stringify(payload));
    submit(formData, { method: 'post' });
  }, [profileForm.values, isMedic, submit]);

  return (
    <FormContainer style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <StyledTitle>{t('profile.title')}</StyledTitle>
      <Flex direction="column" gap="1rem">
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
      </Flex>

      <StyledTitle style={{ marginTop: '1rem' }}>{t('profile.personal_data')}</StyledTitle>
      {hasProfileSuccess && <Alert color="teal">{t('profile.profile_saved')}</Alert>}
      {isProfileError && (
        <Alert color="red">{typeof errorMessage === 'string' ? errorMessage : t('profile.profile_save_error')}</Alert>
      )}
      <FormCard>
        <FieldRow>
          <Label>{t('profile.first_name')}:</Label>
          <StyledTextInput {...profileForm.getInputProps('firstName')} />
        </FieldRow>
        <FieldRow>
          <Label>{t('profile.last_name')}:</Label>
          <StyledTextInput {...profileForm.getInputProps('lastName')} />
        </FieldRow>
      </FormCard>

      <StyledTitle style={{ marginTop: '1rem' }}>{t('profile.contact_data')}</StyledTitle>
      <FormCard>
        <FieldRow>
          <Label>{t('profile.email')}:</Label>
          <StyledTextInput type="email" {...profileForm.getInputProps('email')} />
        </FieldRow>
        <FieldRow>
          <Label>{t('profile.phone')}:</Label>
          <StyledTextInput {...profileForm.getInputProps('phone')} />
        </FieldRow>
        <FieldRow>
          <Label>{t('profile.street_address')}:</Label>
          <StyledTextInput {...profileForm.getInputProps('streetAddress')} />
        </FieldRow>
        <FieldRow>
          <Label>{t('profile.city')}:</Label>
          <StyledTextInput {...profileForm.getInputProps('city')} />
        </FieldRow>
        <FieldRow>
          <Label>{t('profile.province')}:</Label>
          <StyledSelect data={provinceOptions} searchable {...profileForm.getInputProps('province')} />
        </FieldRow>
        <FieldRow>
          <Label>{t('profile.country')}:</Label>
          <StyledSelect data={countryOptions} searchable {...profileForm.getInputProps('country')} />
        </FieldRow>
      </FormCard>

      {isMedic && (
        <>
          <StyledTitle style={{ marginTop: '1rem' }}>{t('profile.professional_info')}</StyledTitle>
          <FormCard>
            <FieldRow>
              <Label>{t('profile.medical_specialty')}:</Label>
              <StyledTextInput {...profileForm.getInputProps('medicalSpecialty')} />
            </FieldRow>
            <FieldRow>
              <Label>{t('profile.national_license_number')}:</Label>
              <StyledTextInput {...profileForm.getInputProps('nationalLicenseNumber')} />
            </FieldRow>
            <FieldRow>
              <Label>{t('profile.state_license')}:</Label>
              <StyledSelect data={provinceOptions} searchable {...profileForm.getInputProps('stateLicense')} />
            </FieldRow>
            <FieldRow>
              <Label>{t('profile.state_license_number')}:</Label>
              <StyledTextInput {...profileForm.getInputProps('stateLicenseNumber')} />
            </FieldRow>
          </FormCard>
        </>
      )}

      <Button mt="xs" onClick={handleSaveProfile} loading={isSavingProfile} style={{ marginLeft: 'auto' }}>
        {t('profile.save_profile')}
      </Button>

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

      <StyledTitle style={{ marginTop: '1rem' }}>{t('profile.change_password')}</StyledTitle>

      {hasPasswordSuccess && <Alert color="teal">{t('profile.password_success')}</Alert>}
      {isPasswordError && (
        <Alert color="red">{typeof errorMessage === 'string' ? errorMessage : String(errorMessage)}</Alert>
      )}

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
