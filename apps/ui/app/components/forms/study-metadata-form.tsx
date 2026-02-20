import { useMemo, useCallback } from 'react';
import { Autocomplete, Checkbox, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { styled } from '~/styled-system/jsx';
import PatientSearch from '~/components/patient-search';
import { PrepagaSelector } from '~/components/prepaga-selector';
import { useFind } from '~/components/provider';
import {
  FormCard,
  FieldRow,
  StyledTextInput,
  StyledTextarea,
  StyledDateInput,
  StyledTitle,
  FormHeader,
} from '~/components/forms/styles';

interface StudyPatientInfo {
  personalData?: {
    firstName?: string;
    lastName?: string;
    documentValue?: string;
  };
  medicare?: string;
}

interface StudyMetadataFormProps {
  mode: 'create' | 'edit';
  studyTypeKeys: readonly string[];
  selectedStudies: string[];
  onToggleStudy: (key: string) => void;
  noOrder: boolean;
  onNoOrderChange: (value: boolean) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  date: Date | null;
  onDateChange?: (value: Date | null) => void;
  dateReadOnly?: boolean;
  patientId?: string | null;
  onPatientChange?: (patientId: string) => void;
  patient?: StudyPatientInfo;
  referringDoctor?: string;
  onReferringDoctorChange?: (value: string) => void;
  medicId?: string | null;
  onMedicIdChange?: (value: string | null) => void;
  showEmptyStudyHint?: boolean;
}

const STUDY_TYPE_TRANSLATION_KEY_BY_CODE = {
  anemia: 'studies.type_anemia',
  anticoagulation: 'studies.type_anticoagulation',
  compatibility: 'studies.type_compatibility',
  hemostasis: 'studies.type_hemostasis',
  myelogram: 'studies.type_myelogram',
  thrombophilia: 'studies.type_thrombophilia',
} as const;

const TypeGrid = styled('div', {
  base: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.75rem',
    sm: {
      gridTemplateColumns: '1fr 1fr',
    },
    lg: {
      gridTemplateColumns: '1fr 1fr 1fr',
    },
  },
});

const StyledAutocomplete = styled(Autocomplete, {
  base: {
    flex: 1,

    '& .mantine-Autocomplete-input': {
      border: 'none',
      padding: 0,
      height: 'auto',
      minHeight: '1.5rem',
      lineHeight: 1.75,

      '&:focus': {
        boxShadow: 'none',
      },
    },
  },
});

export function StudyMetadataForm({
  mode,
  studyTypeKeys,
  selectedStudies,
  onToggleStudy,
  noOrder,
  onNoOrderChange,
  comment,
  onCommentChange,
  date,
  onDateChange,
  dateReadOnly,
  onPatientChange,
  patient,
  referringDoctor,
  onReferringDoctorChange,
  onMedicIdChange,
  showEmptyStudyHint,
}: StudyMetadataFormProps) {
  const { t } = useTranslation();
  const isCreateMode = mode === 'create';

  const { response: doctorsResponse } = useFind('referring-doctors');
  const doctors: any[] = Array.isArray(doctorsResponse) ? doctorsResponse : [];
  const autocompleteData = useMemo(() => doctors.map((d: any) => d.name), [doctors]);
  const doctorsByName = useMemo(() => new Map(doctors.map((d: any) => [d.name, d.medicId])), [doctors]);

  const handleReferringDoctorChange = useCallback(
    (value: string) => {
      onReferringDoctorChange?.(value);
      onMedicIdChange?.(doctorsByName.get(value) ?? null);
    },
    [onReferringDoctorChange, onMedicIdChange, doctorsByName]
  );

  return (
    <>
      <FormHeader>
        <StyledTitle>{t('studies.study_data')}</StyledTitle>
      </FormHeader>
      <FormCard>
        {isCreateMode && (
          <FieldRow label={t('studies.patient_required')}>
            <PatientSearch
              onChange={id => onPatientChange?.(id)}
              onBlur={() => {}}
              placeholder={t('studies.patient_search_placeholder')}
              autoFocus
            />
          </FieldRow>
        )}

        {!isCreateMode && (
          <FieldRow label={t('studies.patient')}>
            <StyledTextInput
              value={patient ? `${patient.personalData?.firstName || ''} ${patient.personalData?.lastName || ''}` : '—'}
              readOnly
            />
          </FieldRow>
        )}

        <FieldRow label={t('studies.referring_doctor')}>
          {isCreateMode && (
            <StyledAutocomplete
              placeholder={t('studies.referring_doctor_placeholder')}
              value={referringDoctor || ''}
              onChange={handleReferringDoctorChange}
              data={autocompleteData}
            />
          )}
          {!isCreateMode && <StyledTextInput value={referringDoctor || '—'} readOnly disabled />}
        </FieldRow>

        <FieldRow label={t('studies.insurance')}>
          <PrepagaSelector value={patient?.medicare || ''} onChange={() => {}} readOnly />
        </FieldRow>

        <FieldRow label={t('studies.extraction_date')}>
          <StyledDateInput
            value={date}
            onChange={v => onDateChange?.(v ? new Date(v) : null)}
            readOnly={dateReadOnly}
            disabled={dateReadOnly}
            valueFormat="DD/MM/YYYY"
          />
        </FieldRow>

        {!isCreateMode && (
          <FieldRow label={t('studies.col_dni')}>
            <StyledTextInput value={patient?.personalData?.documentValue || '—'} readOnly />
          </FieldRow>
        )}

        <FieldRow checkbox>
          <Checkbox
            label={t('studies.no_order')}
            checked={noOrder}
            onChange={e => onNoOrderChange(e.currentTarget.checked)}
            color="blue"
          />
        </FieldRow>

        <FieldRow label={t('studies.observations')}>
          <StyledTextarea
            placeholder={t('studies.observations_placeholder')}
            value={comment}
            onChange={e => onCommentChange(e.currentTarget.value)}
            autosize
            minRows={2}
          />
        </FieldRow>
      </FormCard>

      <FormHeader>
        <StyledTitle>{t('studies.requested_studies')}</StyledTitle>
      </FormHeader>
      <FormCard>
        <FieldRow stacked>
          <TypeGrid>
            {studyTypeKeys.map(key => (
              <Checkbox
                key={key}
                label={
                  STUDY_TYPE_TRANSLATION_KEY_BY_CODE[key as keyof typeof STUDY_TYPE_TRANSLATION_KEY_BY_CODE]
                    ? t(STUDY_TYPE_TRANSLATION_KEY_BY_CODE[key as keyof typeof STUDY_TYPE_TRANSLATION_KEY_BY_CODE])
                    : key
                }
                checked={selectedStudies.includes(key)}
                onChange={() => onToggleStudy(key)}
                color="blue"
              />
            ))}
          </TypeGrid>

          {showEmptyStudyHint && selectedStudies.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" mt="sm">
              {t('studies.select_at_least_one')}
            </Text>
          )}
        </FieldRow>
      </FormCard>
    </>
  );
}
