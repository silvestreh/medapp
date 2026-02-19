import { useEffect, useMemo } from 'react';
import { Alert, Button } from '@mantine/core';
import { Form } from '@remix-run/react';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';

import Portal from '~/components/portal';
import {
  FormCard,
  FieldRow,
  Label,
  StyledSelect,
  StyledTextInput,
  StyledTitle,
  FormHeader,
} from '~/components/forms/styles';

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
  });

  useEffect(() => {
    profileForm.setValues(initialProfile);
  }, [user, mdSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasProfileSuccess = actionData?.ok && actionData.intent === 'update-profile';
  const isProfileError = actionData?.ok === false && actionData.intent === 'update-profile';
  const errorMessage = actionData?.ok === false && actionData && 'error' in actionData ? actionData.error : '';

  const payload = useMemo(() => {
    const values = profileForm.values;
    return {
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
  }, [profileForm.values, isMedic]);

  return (
    <Form id="profile-update-form" method="post">
      <input type="hidden" name="intent" value="update-profile" />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <FormHeader>
        <StyledTitle>{t('profile.personal_data')}</StyledTitle>
      </FormHeader>
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

      <FormHeader>
        <StyledTitle style={{ marginTop: '2rem' }}>{t('profile.contact_data')}</StyledTitle>
      </FormHeader>
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
          <FormHeader>
            <StyledTitle style={{ marginTop: '2rem' }}>{t('profile.professional_info')}</StyledTitle>
          </FormHeader>
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

      {showFormActions && (
        <Portal id="form-actions">
          <Button type="submit" form="profile-update-form" loading={isSavingProfile} style={{ marginLeft: 'auto' }}>
            {t('profile.save_profile')}
          </Button>
        </Portal>
      )}
    </Form>
  );
}
