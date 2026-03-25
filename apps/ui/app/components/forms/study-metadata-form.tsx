import { useState, useMemo, useCallback, useEffect } from 'react';
import { ActionIcon, Autocomplete, Checkbox, Group, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { PencilSimpleIcon } from '@phosphor-icons/react';
import { styled } from '~/styled-system/jsx';
import PatientSearch from '~/components/patient-search';
import { useFind } from '~/components/provider';
import { MedicareDisplay } from '~/components/medicare-display';
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
  medicare?: string | null;
  medicareId?: string | null;
  prepaga?: { shortName: string; denomination: string } | null;
}

interface StudyMetadataFormProps {
  mode: 'create' | 'edit';
  studyTypeKeys: readonly string[];
  selectedStudies: string[];
  onToggleStudy: (key: string) => void;
  noOrder: boolean;
  onNoOrderChange: (value: boolean) => void;
  emergency?: boolean;
  onEmergencyChange?: (value: boolean) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  date: Date | null;
  onDateChange?: (value: Date | null) => void;
  dateReadOnly?: boolean;
  patientId?: string | null;
  onPatientChange?: (patientId: string) => void;
  patient?: StudyPatientInfo;
  patientEditable?: boolean;
  referringDoctor?: string;
  onReferringDoctorChange?: (value: string) => void;
  medicId?: string | null;
  onMedicIdChange?: (value: string | null) => void;
  showEmptyStudyHint?: boolean;
  readOnly?: boolean;
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
  emergency = false,
  onEmergencyChange,
  comment,
  onCommentChange,
  date,
  onDateChange,
  dateReadOnly,
  onPatientChange,
  patient,
  patientEditable = false,
  referringDoctor,
  onReferringDoctorChange,
  onMedicIdChange,
  showEmptyStudyHint,
  readOnly = false,
}: StudyMetadataFormProps) {
  const { t } = useTranslation();
  const isCreateMode = mode === 'create';
  const [isChangingPatient, setIsChangingPatient] = useState(false);
  const [isEditingDoctor, setIsEditingDoctor] = useState(false);

  const handleStartEditingDoctor = useCallback(() => {
    setIsEditingDoctor(true);
  }, []);

  const handlePatientSelected = useCallback(
    (id: string) => {
      onPatientChange?.(id);
      setIsChangingPatient(false);
    },
    [onPatientChange]
  );

  const handleStartChangingPatient = useCallback(() => {
    setIsChangingPatient(true);
  }, []);

  const { response: doctorsResponse } = useFind('referring-doctors');
  const doctors: any[] = useMemo(() => (Array.isArray(doctorsResponse) ? doctorsResponse : []), [doctorsResponse]);
  const autocompleteData = useMemo(() => doctors.map((d: any) => d.name), [doctors]);
  const doctorsByName = useMemo(() => new Map(doctors.map((d: any) => [d.name, d.medicId])), [doctors]);

  // Auto-prefill when there's exactly one medic in the system
  const singleMedic = useMemo(() => {
    const medics = doctors.filter((d: any) => d.medicId);
    return medics.length === 1 ? medics[0] : null;
  }, [doctors]);

  useEffect(() => {
    if (isCreateMode && singleMedic && !referringDoctor) {
      onReferringDoctorChange?.(singleMedic.name);
      onMedicIdChange?.(singleMedic.medicId);
    }
  }, [isCreateMode, singleMedic, referringDoctor, onReferringDoctorChange, onMedicIdChange]);

  const handleReferringDoctorChange = useCallback(
    (value: string) => {
      // Strip non-standard characters (en/em dashes, special punctuation, etc.)
      const sanitized = value.replace(/[^\w\s.,()áéíóúàèìòùäëïöüâêîôûñçÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑÇ'-]/g, '');
      onReferringDoctorChange?.(sanitized);
      onMedicIdChange?.(doctorsByName.get(sanitized) ?? null);
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

        {!isCreateMode && !isChangingPatient && (
          <FieldRow label={t('studies.patient')}>
            <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
              <StyledTextInput
                value={
                  patient ? `${patient.personalData?.firstName || ''} ${patient.personalData?.lastName || ''}` : '—'
                }
                readOnly
                style={{ flex: 1 }}
              />
              {patientEditable && (
                <ActionIcon variant="subtle" size="sm" onClick={handleStartChangingPatient}>
                  <PencilSimpleIcon size={16} />
                </ActionIcon>
              )}
            </Group>
          </FieldRow>
        )}

        {!isCreateMode && isChangingPatient && (
          <FieldRow label={t('studies.patient')}>
            <PatientSearch
              onChange={handlePatientSelected}
              onBlur={() => {}}
              placeholder={t('studies.patient_search_placeholder')}
              autoFocus
            />
          </FieldRow>
        )}

        <FieldRow label={t('studies.referring_doctor')}>
          {(isCreateMode || isEditingDoctor) && (
            <StyledAutocomplete
              placeholder={t('studies.referring_doctor_placeholder')}
              value={referringDoctor || ''}
              onChange={handleReferringDoctorChange}
              data={autocompleteData}
              autoFocus={isEditingDoctor}
            />
          )}
          {!isCreateMode && !isEditingDoctor && (
            <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
              <StyledTextInput value={referringDoctor || '—'} readOnly style={{ flex: 1 }} />
              {!readOnly && onReferringDoctorChange && (
                <ActionIcon variant="subtle" size="sm" onClick={handleStartEditingDoctor}>
                  <PencilSimpleIcon size={16} />
                </ActionIcon>
              )}
            </Group>
          )}
        </FieldRow>

        <FieldRow label={t('studies.insurance')}>
          {patient && <MedicareDisplay patient={patient} fallback="—" />}
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
            disabled={readOnly}
          />
        </FieldRow>

        <FieldRow checkbox>
          <Checkbox
            label={t('studies.emergency')}
            checked={emergency}
            onChange={e => onEmergencyChange?.(e.currentTarget.checked)}
            color="red"
            disabled={readOnly}
          />
        </FieldRow>

        <FieldRow label={t('studies.observations')}>
          <StyledTextarea
            placeholder={t('studies.observations_placeholder')}
            value={comment}
            onChange={e => onCommentChange(e.currentTarget.value)}
            autosize
            minRows={2}
            readOnly={readOnly}
            disabled={readOnly}
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
                disabled={readOnly}
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
