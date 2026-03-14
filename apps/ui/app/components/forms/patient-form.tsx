import { useCallback, useMemo } from 'react';
import type { UseFormReturnType } from '@mantine/form';
import { useTranslation } from 'react-i18next';

import {
  FormContainer,
  FormCard,
  FieldRow,
  StyledTextInput,
  StyledSelect,
  StyledDateInput,
  StyledTitle,
} from '~/components/forms/styles';
import { PrepagaSelector } from '~/components/prepaga-selector';
import { useGet } from '~/components/provider';

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
  phoneCountryCode: string;
  phoneNumber: string;
  email: string;
  medicare: string;
  medicareId: string;
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
  phoneCountryCode: '54',
  phoneNumber: '',
  email: '',
  medicare: '',
  medicareId: '',
  medicareNumber: '',
  medicarePlan: '',
};

const COUNTRY_CALLING_CODES = [
  { value: '54', label: '🇦🇷 +54' },
  { value: '55', label: '🇧🇷 +55' },
  { value: '56', label: '🇨🇱 +56' },
  { value: '57', label: '🇨🇴 +57' },
  { value: '58', label: '🇻🇪 +58' },
  { value: '591', label: '🇧🇴 +591' },
  { value: '593', label: '🇪🇨 +593' },
  { value: '595', label: '🇵🇾 +595' },
  { value: '598', label: '🇺🇾 +598' },
  { value: '51', label: '🇵🇪 +51' },
  { value: '52', label: '🇲🇽 +52' },
  { value: '1', label: '🇺🇸 +1' },
  { value: '34', label: '🇪🇸 +34' },
];

/**
 * Extracts the country code from a phone string like "cel:+542216412898"
 * or "cel:542216412898". Returns { countryCode, localNumber }.
 */
function extractCountryCode(phone: string): { countryCode: string; localNumber: string } {
  // Strip the tel:/cel: prefix and any + sign
  const digits = phone.replace(/^(tel:|cel:)\+?/i, '').replace(/[^0-9]/g, '');

  // Try to match known country codes (longest first to avoid ambiguity)
  const sortedCodes = COUNTRY_CALLING_CODES
    .map((c) => c.value)
    .sort((a, b) => b.length - a.length);

  for (const code of sortedCodes) {
    if (digits.startsWith(code) && digits.length > code.length) {
      return { countryCode: code, localNumber: digits.slice(code.length) };
    }
  }

  // Default: assume the whole thing is a local number
  return { countryCode: '54', localNumber: digits };
}

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
    ...(() => {
      const raw = Array.isArray(cd.phoneNumber) ? cd.phoneNumber.join(', ') : cd.phoneNumber || '';
      // If there's a single phone number with a prefix, extract country code
      const phones: string[] = Array.isArray(cd.phoneNumber) ? cd.phoneNumber : (cd.phoneNumber ? [cd.phoneNumber] : []);
      // Prefer cel: for extraction
      const primary = phones.find((p: string) => p.startsWith('cel:')) || phones[0] || '';
      if (primary) {
        const { countryCode, localNumber } = extractCountryCode(primary);
        // Show all numbers as comma-separated but strip country code from the primary
        const displayNumbers = phones.map((p: string) => {
          const prefix = p.match(/^(tel:|cel:)/i)?.[0] || '';
          const { localNumber: ln } = extractCountryCode(p);
          return `${prefix}${ln}`;
        }).join(', ');
        return { phoneCountryCode: countryCode, phoneNumber: displayNumbers };
      }
      return { phoneCountryCode: '54', phoneNumber: raw };
    })(),
    email: cd.email || '',
    medicare: patient.medicare || '',
    medicareId: patient.medicareId || '',
    medicareNumber: patient.medicareNumber || '',
    medicarePlan: patient.medicarePlan || '',
  };
}

/**
 * Prepends the country code to each phone number in a comma-separated string.
 * Preserves the tel:/cel: prefix if present.
 * e.g. "cel:2216412898, tel:42123456" with code "54" → "cel:+542216412898, tel:+5442123456"
 */
function prependCountryCode(phoneNumber: string, countryCode: string): string {
  if (!phoneNumber) return '';
  return phoneNumber
    .split(',')
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      const prefixMatch = trimmed.match(/^(tel:|cel:)/i);
      const prefix = prefixMatch?.[0] || '';
      const digits = trimmed.replace(/^(tel:|cel:)\+?/i, '').replace(/[^0-9]/g, '');
      if (!digits) return '';
      return `${prefix}+${countryCode}${digits}`;
    })
    .filter(Boolean)
    .join(', ');
}

export function buildFormPayload(values: PatientFormValues) {
  const { documentType, documentValue, firstName, lastName, nationality, maritalStatus, birthDate, gender } = values;
  const { streetAddress, city, province, country, phoneCountryCode, phoneNumber, email } = values;
  const { medicareId, medicareNumber, medicarePlan } = values;

  return {
    personalData: {
      documentType,
      documentValue: documentValue.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      nationality: nationality || undefined,
      maritalStatus: maritalStatus || undefined,
      birthDate: (() => {
        if (birthDate == null) return undefined;
        const d = birthDate instanceof Date ? birthDate : new Date(birthDate as unknown as string);
        return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
      })(),
      gender: gender || undefined,
    },
    contactData: {
      streetAddress: streetAddress || undefined,
      city: city || undefined,
      province: province || undefined,
      country: country || undefined,
      phoneNumber: prependCountryCode(phoneNumber, phoneCountryCode) || undefined,
      email: email || undefined,
    },
    patientFields: {
      medicareId: medicareId || undefined,
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

interface PrepagaTier {
  name: string;
  code: number | null;
}

export function PatientForm({
  form,
  readOnlyDocument = false,
  disabled = false,
  showContactAndInsurance = true,
}: PatientFormProps) {
  const { t } = useTranslation();

  const medicareId = form.values.medicareId;
  const { data: selectedPrepaga } = useGet('prepagas', medicareId, {
    enabled: !!medicareId,
  });

  const tierOptions = useMemo(() => {
    const tiers = (selectedPrepaga as { tiers?: PrepagaTier[] })?.tiers;
    if (!tiers || tiers.length === 0) return [];
    return tiers.map(tier => ({ value: tier.name, label: tier.name }));
  }, [selectedPrepaga]);

  const handleInsurerChange = useCallback(
    (val: string) => {
      form.setFieldValue('medicareId', val);
      form.setFieldValue('medicarePlan', '');
    },
    [form],
  );

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
        <FieldRow label={`${t('patients.document_type')}:`}>
          <StyledSelect data={documentTypeOptions} disabled={disabled} {...form.getInputProps('documentType')} />
        </FieldRow>
        <FieldRow label={`${t('patients.document_value')}:`}>
          <StyledTextInput
            placeholder={readOnlyDocument ? undefined : t('patients.document_value_placeholder')}
            readOnly={readOnlyDocument}
            disabled={disabled}
            {...form.getInputProps('documentValue')}
          />
        </FieldRow>
        <FieldRow label={`${t('patients.first_name')}:`}>
          <StyledTextInput
            placeholder={t('patients.first_name')}
            disabled={disabled}
            {...form.getInputProps('firstName')}
          />
        </FieldRow>
        <FieldRow label={`${t('patients.last_name')}:`}>
          <StyledTextInput
            placeholder={t('patients.last_name')}
            disabled={disabled}
            {...form.getInputProps('lastName')}
          />
        </FieldRow>
        <FieldRow label={`${t('patients.nationality')}:`}>
          <StyledSelect data={countryOptions} searchable disabled={disabled} {...form.getInputProps('nationality')} />
        </FieldRow>
        <FieldRow label={`${t('patients.birth_date')}:`}>
          <StyledDateInput
            placeholder="DD/MM/YYYY"
            valueFormat="DD/MM/YYYY"
            clearable
            disabled={disabled}
            {...form.getInputProps('birthDate')}
          />
        </FieldRow>
        <FieldRow label={`${t('patients.gender')}:`}>
          <StyledSelect data={genderOptions} disabled={disabled} {...form.getInputProps('gender')} />
        </FieldRow>
        <FieldRow label={`${t('patients.marital_status')}:`}>
          <StyledSelect data={maritalStatusOptions} disabled={disabled} {...form.getInputProps('maritalStatus')} />
        </FieldRow>
      </FormCard>

      {/* Contact Data */}
      {showContactAndInsurance && (
        <>
          <StyledTitle>{t('patients.contact_data')}</StyledTitle>
          <FormCard>
            <FieldRow label={`${t('patients.street_address')}:`}>
              <StyledTextInput placeholder={t('patients.street_address')} {...form.getInputProps('streetAddress')} />
            </FieldRow>
            <FieldRow label={`${t('patients.city')}:`}>
              <StyledTextInput placeholder={t('patients.city')} {...form.getInputProps('city')} />
            </FieldRow>
            <FieldRow label={`${t('patients.province')}:`}>
              <StyledSelect data={provinceOptions} searchable {...form.getInputProps('province')} />
            </FieldRow>
            <FieldRow label={`${t('patients.country')}:`}>
              <StyledSelect data={countryOptions} searchable {...form.getInputProps('country')} />
            </FieldRow>
            <FieldRow label={`${t('patients.phone')}:`}>
              <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                <StyledSelect
                  data={COUNTRY_CALLING_CODES}
                  searchable
                  style={{ width: '7rem', flex: 'none' }}
                  disabled={disabled}
                  {...form.getInputProps('phoneCountryCode')}
                />
                <StyledTextInput
                  placeholder={t('patients.phone')}
                  style={{ flex: 1 }}
                  disabled={disabled}
                  {...form.getInputProps('phoneNumber')}
                />
              </div>
            </FieldRow>
            <FieldRow label={`${t('patients.email')}:`}>
              <StyledTextInput placeholder={t('patients.email')} {...form.getInputProps('email')} />
            </FieldRow>
          </FormCard>

          {/* Insurance */}
          <StyledTitle>{t('patients.insurance')}</StyledTitle>
          <FormCard>
            <FieldRow label={`${t('patients.medicare')}:`}>
              <PrepagaSelector
                value={form.values.medicareId}
                onChange={handleInsurerChange}
                placeholder={t('patients.medicare')}
                readOnly={disabled}
              />
            </FieldRow>
            <FieldRow label={`${t('patients.medicare_number')}:`}>
              <StyledTextInput placeholder={t('patients.medicare_number')} {...form.getInputProps('medicareNumber')} />
            </FieldRow>
            {tierOptions.length > 0 && (
              <FieldRow label={`${t('patients.medicare_plan')}:`}>
                <StyledSelect
                  data={tierOptions}
                  searchable
                  clearable
                  placeholder={t('patients.medicare_plan')}
                  disabled={disabled}
                  {...form.getInputProps('medicarePlan')}
                />
              </FieldRow>
            )}
          </FormCard>
        </>
      )}
    </FormContainer>
  );
}
