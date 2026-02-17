import { useMemo } from 'react';
import type { UseFormReturnType } from '@mantine/form';
import { useTranslation } from 'react-i18next';

import {
  FormContainer,
  FormCard,
  FieldRow,
  Label,
  StyledTextInput,
  StyledSelect,
  StyledDateInput,
  StyledTitle,
} from '~/components/forms/styles';

export interface PatientFormValues {
  documentType: string;
  documentValue: string;
  firstName: string;
  lastName: string;
  nationality: string;
  maritalStatus: string;
  birthDate: Date | null;
  gender: string;
  streetAddress: string;
  city: string;
  province: string;
  country: string;
  phoneNumber: string;
  email: string;
  medicare: string;
  medicareNumber: string;
  medicarePlan: string;
}

export const EMPTY_PATIENT_FORM_VALUES: PatientFormValues = {
  documentType: 'DNI',
  documentValue: '',
  firstName: '',
  lastName: '',
  nationality: 'AR',
  maritalStatus: '',
  birthDate: null,
  gender: '',
  streetAddress: '',
  city: '',
  province: '',
  country: 'AR',
  phoneNumber: '',
  email: '',
  medicare: '',
  medicareNumber: '',
  medicarePlan: '',
};

export function parsePatientToFormValues(patient: any): PatientFormValues {
  const pd = patient.personalData || {};
  const cd = patient.contactData || {};
  return {
    documentType: pd.documentType || 'DNI',
    documentValue: pd.documentValue || '',
    firstName: pd.firstName || '',
    lastName: pd.lastName || '',
    nationality: pd.nationality || 'AR',
    maritalStatus: pd.maritalStatus || '',
    birthDate: pd.birthDate ? new Date(pd.birthDate) : null,
    gender: pd.gender || '',
    streetAddress: cd.streetAddress || '',
    city: cd.city || '',
    province: cd.province || '',
    country: cd.country || 'AR',
    phoneNumber: Array.isArray(cd.phoneNumber) ? cd.phoneNumber.join(', ') : cd.phoneNumber || '',
    email: cd.email || '',
    medicare: patient.medicare || '',
    medicareNumber: patient.medicareNumber || '',
    medicarePlan: patient.medicarePlan || '',
  };
}

export function buildFormPayload(values: PatientFormValues) {
  const { documentType, documentValue, firstName, lastName, nationality, maritalStatus, birthDate, gender } = values;
  const { streetAddress, city, province, country, phoneNumber, email } = values;
  const { medicare, medicareNumber, medicarePlan } = values;

  return {
    personalData: {
      documentType,
      documentValue: documentValue.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      nationality: nationality || undefined,
      maritalStatus: maritalStatus || undefined,
      birthDate: birthDate ? birthDate.toISOString() : undefined,
      gender: gender || undefined,
    },
    contactData: {
      streetAddress: streetAddress || undefined,
      city: city || undefined,
      province: province || undefined,
      country: country || undefined,
      phoneNumber: phoneNumber || undefined,
      email: email || undefined,
    },
    patientFields: {
      medicare: medicare || undefined,
      medicareNumber: medicareNumber || undefined,
      medicarePlan: medicarePlan || undefined,
    },
  };
}

function buildSelectOptions(obj: Record<string, string>) {
  return Object.entries(obj).map(([value, label]) => ({ value, label }));
}

interface PatientFormProps {
  form: UseFormReturnType<PatientFormValues>;
  readOnlyDocument?: boolean;
  disabled?: boolean;
  showContactAndInsurance?: boolean;
}

export function PatientForm({
  form,
  readOnlyDocument = false,
  disabled = false,
  showContactAndInsurance = true,
}: PatientFormProps) {
  const { t } = useTranslation();

  const countryOptions = useMemo(
    () => buildSelectOptions(t('countries', { returnObjects: true }) as Record<string, string>),
    [t]
  );
  const provinceOptions = useMemo(
    () => buildSelectOptions(t('provinces', { returnObjects: true }) as Record<string, string>),
    [t]
  );
  const maritalStatusOptions = useMemo(
    () => buildSelectOptions(t('patients.marital_statuses', { returnObjects: true }) as Record<string, string>),
    [t]
  );
  const genderOptions = useMemo(
    () => buildSelectOptions(t('patients.genders', { returnObjects: true }) as Record<string, string>),
    [t]
  );
  const documentTypeOptions = useMemo(
    () => buildSelectOptions(t('patients.document_types', { returnObjects: true }) as Record<string, string>),
    [t]
  );

  return (
    <FormContainer>
      {/* Personal Data */}
      <StyledTitle>{t('patients.personal_data')}</StyledTitle>
      <FormCard>
        <FieldRow>
          <Label>{t('patients.document_type')}:</Label>
          <StyledSelect data={documentTypeOptions} disabled={disabled} {...form.getInputProps('documentType')} />
        </FieldRow>
        <FieldRow>
          <Label>{t('patients.document_value')}:</Label>
          <StyledTextInput
            placeholder={readOnlyDocument ? undefined : t('patients.document_value_placeholder')}
            readOnly={readOnlyDocument}
            disabled={disabled}
            {...form.getInputProps('documentValue')}
          />
        </FieldRow>
        <FieldRow>
          <Label>{t('patients.first_name')}:</Label>
          <StyledTextInput
            placeholder={t('patients.first_name')}
            disabled={disabled}
            {...form.getInputProps('firstName')}
          />
        </FieldRow>
        <FieldRow>
          <Label>{t('patients.last_name')}:</Label>
          <StyledTextInput
            placeholder={t('patients.last_name')}
            disabled={disabled}
            {...form.getInputProps('lastName')}
          />
        </FieldRow>
        <FieldRow>
          <Label>{t('patients.nationality')}:</Label>
          <StyledSelect data={countryOptions} searchable disabled={disabled} {...form.getInputProps('nationality')} />
        </FieldRow>
        <FieldRow>
          <Label>{t('patients.birth_date')}:</Label>
          <StyledDateInput
            placeholder="DD/MM/YYYY"
            valueFormat="DD/MM/YYYY"
            clearable
            disabled={disabled}
            {...form.getInputProps('birthDate')}
          />
        </FieldRow>
        <FieldRow>
          <Label>{t('patients.gender')}:</Label>
          <StyledSelect data={genderOptions} disabled={disabled} {...form.getInputProps('gender')} />
        </FieldRow>
        <FieldRow>
          <Label>{t('patients.marital_status')}:</Label>
          <StyledSelect data={maritalStatusOptions} disabled={disabled} {...form.getInputProps('maritalStatus')} />
        </FieldRow>
      </FormCard>

      {/* Contact Data */}
      {showContactAndInsurance && (
        <>
          <StyledTitle>{t('patients.contact_data')}</StyledTitle>
          <FormCard>
            <FieldRow>
              <Label>{t('patients.street_address')}:</Label>
              <StyledTextInput placeholder={t('patients.street_address')} {...form.getInputProps('streetAddress')} />
            </FieldRow>
            <FieldRow>
              <Label>{t('patients.city')}:</Label>
              <StyledTextInput placeholder={t('patients.city')} {...form.getInputProps('city')} />
            </FieldRow>
            <FieldRow>
              <Label>{t('patients.province')}:</Label>
              <StyledSelect data={provinceOptions} searchable {...form.getInputProps('province')} />
            </FieldRow>
            <FieldRow>
              <Label>{t('patients.country')}:</Label>
              <StyledSelect data={countryOptions} searchable {...form.getInputProps('country')} />
            </FieldRow>
            <FieldRow>
              <Label>{t('patients.phone')}:</Label>
              <StyledTextInput placeholder={t('patients.phone')} {...form.getInputProps('phoneNumber')} />
            </FieldRow>
            <FieldRow>
              <Label>{t('patients.email')}:</Label>
              <StyledTextInput placeholder={t('patients.email')} {...form.getInputProps('email')} />
            </FieldRow>
          </FormCard>

          {/* Insurance */}
          <StyledTitle>{t('patients.insurance')}</StyledTitle>
          <FormCard>
            <FieldRow>
              <Label>{t('patients.medicare')}:</Label>
              <StyledTextInput placeholder={t('patients.medicare')} {...form.getInputProps('medicare')} />
            </FieldRow>
            <FieldRow>
              <Label>{t('patients.medicare_number')}:</Label>
              <StyledTextInput placeholder={t('patients.medicare_number')} {...form.getInputProps('medicareNumber')} />
            </FieldRow>
            <FieldRow>
              <Label>{t('patients.medicare_plan')}:</Label>
              <StyledTextInput placeholder={t('patients.medicare_plan')} {...form.getInputProps('medicarePlan')} />
            </FieldRow>
          </FormCard>
        </>
      )}
    </FormContainer>
  );
}
