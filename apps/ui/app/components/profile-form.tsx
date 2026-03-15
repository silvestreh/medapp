import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Button } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { useHotkeys } from '@mantine/hooks';
import { Form } from '@remix-run/react';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { UserIcon, EnvelopeIcon, StethoscopeIcon } from '@phosphor-icons/react';

import Portal from '~/components/portal';
import {
  FormCard,
  FieldRow,
  StyledSelect,
  StyledTagsInput,
  StyledTextInput,
  SectionTitle,
} from '~/components/forms/styles';
import {
  COUNTRY_CALLING_CODES,
  extractCountryCode,
  prependCountryCode,
} from '~/components/forms/patient-form';
import medicalSpecialties from '~/medical-specialties.json';

const specialtyOptions = medicalSpecialties.map(s => s.nombre);

type PersonalDataLike =
  | { firstName?: string | null; lastName?: string | null; documentType?: string | null; documentValue?: string | null }
  | undefined;
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
      isVerified?: boolean;
      recetarioTitle?: string | null;
      recetarioProvince?: string | null;
      signatureImage?: string | null;
    }
  | undefined;

function getInitialProfileValues(
  user: { personalData?: PersonalDataLike; contactData?: ContactDataLike } | undefined,
  mdSettings: MdSettingsLike | null
) {
  const pd = user?.personalData;
  const cd = user?.contactData;
  const rawPhone =
    cd?.phoneNumber == null ? '' : Array.isArray(cd.phoneNumber) ? cd.phoneNumber.join(', ') : String(cd.phoneNumber);
  const { countryCode, localNumber } = rawPhone
    ? extractCountryCode(rawPhone)
    : { countryCode: '54', localNumber: '' };
  return {
    firstName: pd?.firstName ?? '',
    lastName: pd?.lastName ?? '',
    documentType: pd?.documentType ?? '',
    documentValue: pd?.documentValue ?? '',
    email: cd?.email ?? '',
    phoneCountryCode: countryCode,
    phoneNumber: localNumber,
    streetAddress: cd?.streetAddress ?? '',
    city: cd?.city ?? '',
    province: cd?.province ?? '',
    country: cd?.country ?? '',
    medicalSpecialty: mdSettings?.medicalSpecialty
      ? mdSettings.medicalSpecialty
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : ([] as string[]),
    nationalLicenseNumber: mdSettings?.nationalLicenseNumber ?? '',
    stateLicense: mdSettings?.stateLicense ?? '',
    stateLicenseNumber: mdSettings?.stateLicenseNumber ?? '',
  };
}

export type ProfileFormActionData = {
  ok: boolean;
  intent: string;
  error?: string;
};

type ProfileFormProps = {
  user: unknown;
  mdSettings: MdSettingsLike | null;
  isMedic: boolean;
  actionData: ProfileFormActionData | undefined;
  countryOptions: { value: string; label: string }[];
  provinceOptions: { value: string; label: string }[];
  isSavingProfile: boolean;
  isVerifyingLicense: boolean;
  showFormActions?: boolean;
};

export function ProfileForm({
  user,
  mdSettings,
  isMedic,
  actionData,
  countryOptions,
  provinceOptions,
  isSavingProfile,
  showFormActions = true,
}: ProfileFormProps) {
  const { t } = useTranslation();

  const initialProfile = useMemo(
    () =>
      getInitialProfileValues(user as { personalData?: PersonalDataLike; contactData?: ContactDataLike }, mdSettings),
    [user, mdSettings]
  );

  const profileForm = useForm({
    initialValues: initialProfile,
    validate: {
      documentValue: v => (v ? null : t('patients.document_required')),
    },
  });

  const formRef = useRef<HTMLFormElement>(null);

  useHotkeys([['mod+S', () => formRef.current?.requestSubmit()]], []);

  useEffect(() => {
    profileForm.setValues(initialProfile);
    profileForm.clearErrors();
  }, [user, mdSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      const validation = profileForm.validate();
      if (validation.hasErrors) {
        e.preventDefault();
      }
    },
    [profileForm]
  );

  const hasProfileSuccess = actionData?.ok && actionData.intent === 'update-profile';
  const isProfileError = actionData?.ok === false && actionData.intent === 'update-profile';
  const errorMessage = actionData?.ok === false && actionData && 'error' in actionData ? actionData.error : '';

  useEffect(() => {
    if (hasProfileSuccess) {
      showNotification({ color: 'teal', message: t('profile.profile_saved') });
    }
  }, [hasProfileSuccess, t]);

  useEffect(() => {
    if (isProfileError) {
      showNotification({
        color: 'red',
        message: typeof errorMessage === 'string' ? errorMessage : t('profile.profile_save_error'),
      });
    }
  }, [isProfileError, errorMessage, t]);

  const payload = useMemo(() => {
    const values = profileForm.values;
    return {
      documentValue: values.documentValue,
      personalData: {
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined,
        documentType: values.documentType || undefined,
        documentValue: values.documentValue || undefined,
      },
      contactData: {
        email: values.email || undefined,
        phoneNumber: prependCountryCode(values.phoneNumber, values.phoneCountryCode) || undefined,
        streetAddress: values.streetAddress || undefined,
        city: values.city || undefined,
        province: values.province || undefined,
        country: values.country || undefined,
      },
      ...(isMedic
        ? {
            mdSettings: {
              medicalSpecialty: values.medicalSpecialty.length > 0 ? values.medicalSpecialty.join(', ') : undefined,
              nationalLicenseNumber: values.nationalLicenseNumber || undefined,
              stateLicense: values.stateLicense || undefined,
              stateLicenseNumber: values.stateLicenseNumber || undefined,
            },
          }
        : {}),
    };
  }, [profileForm.values, isMedic]);

  return (
    <Form
      id="profile-update-form"
      method="post"
      ref={formRef}
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <input type="hidden" name="intent" value="update-profile" />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <SectionTitle id="personal-data" icon={<UserIcon />}>
        {t('profile.personal_data')}
      </SectionTitle>
      <FormCard style={{ marginBottom: '1rem' }}>
        <FieldRow label={`${t('profile.first_name')}:`} variant="stacked">
          <StyledTextInput {...profileForm.getInputProps('firstName')} />
        </FieldRow>
        <FieldRow label={`${t('profile.last_name')}:`} variant="stacked">
          <StyledTextInput {...profileForm.getInputProps('lastName')} />
        </FieldRow>
        <FieldRow label={`${t('patients.document_type')}:`} variant="stacked">
          <StyledSelect
            data={[
              { value: 'DNI', label: 'DNI' },
              { value: 'CI', label: 'CI' },
              { value: 'LE', label: 'LE' },
              { value: 'LC', label: 'LC' },
              { value: 'passport', label: 'Pasaporte' },
            ]}
            {...profileForm.getInputProps('documentType')}
          />
        </FieldRow>
        <FieldRow label={`${t('patients.document_value')}:`} variant="stacked">
          <StyledTextInput {...profileForm.getInputProps('documentValue')} />
        </FieldRow>
      </FormCard>

      <SectionTitle id="contact-data" icon={<EnvelopeIcon />}>
        {t('profile.contact_data')}
      </SectionTitle>
      <FormCard style={{ marginBottom: '1rem' }}>
        <FieldRow label={`${t('profile.email')}:`} variant="stacked">
          <StyledTextInput type="email" {...profileForm.getInputProps('email')} />
        </FieldRow>
        <FieldRow label={`${t('profile.phone')}:`} variant="stacked">
          <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: 0 }}>
            <StyledSelect
              data={COUNTRY_CALLING_CODES}
              searchable
              style={{ width: '7rem', flex: 'none' }}
              {...profileForm.getInputProps('phoneCountryCode')}
            />
            <StyledTextInput
              placeholder={t('profile.phone')}
              style={{ flex: 1 }}
              {...profileForm.getInputProps('phoneNumber')}
            />
          </div>
        </FieldRow>
        <FieldRow label={`${t('profile.street_address')}:`} variant="stacked">
          <StyledTextInput {...profileForm.getInputProps('streetAddress')} />
        </FieldRow>
        <FieldRow label={`${t('profile.city')}:`} variant="stacked">
          <StyledTextInput {...profileForm.getInputProps('city')} />
        </FieldRow>
        <FieldRow label={`${t('profile.province')}:`} variant="stacked">
          <StyledSelect data={provinceOptions} searchable {...profileForm.getInputProps('province')} />
        </FieldRow>
        <FieldRow label={`${t('profile.country')}:`} variant="stacked">
          <StyledSelect data={countryOptions} searchable {...profileForm.getInputProps('country')} />
        </FieldRow>
      </FormCard>

      {isMedic && (
        <>
          <SectionTitle id="professional-data" icon={<StethoscopeIcon />}>
            {t('profile.professional_info')}
          </SectionTitle>
          <FormCard>
            <FieldRow label={`${t('profile.medical_specialty')}:`} variant="stacked">
              <StyledTagsInput data={specialtyOptions} {...profileForm.getInputProps('medicalSpecialty')} />
            </FieldRow>
            <FieldRow label={`${t('profile.national_license_number')}:`} variant="stacked">
              <StyledTextInput {...profileForm.getInputProps('nationalLicenseNumber')} />
            </FieldRow>
            <FieldRow label={`${t('profile.state_license')}:`} variant="stacked">
              <StyledSelect data={provinceOptions} searchable {...profileForm.getInputProps('stateLicense')} />
            </FieldRow>
            <FieldRow label={`${t('profile.state_license_number')}:`} variant="stacked">
              <StyledTextInput {...profileForm.getInputProps('stateLicenseNumber')} />
            </FieldRow>
          </FormCard>
        </>
      )}

      {showFormActions && (
        <Portal id="form-actions">
          <Button type="submit" form="profile-update-form" loading={isSavingProfile} style={{ marginLeft: 'auto' }}>
            {t('common.save')}
          </Button>
        </Portal>
      )}
    </Form>
  );
}
