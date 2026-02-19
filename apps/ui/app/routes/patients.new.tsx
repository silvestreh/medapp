import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { ActionFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useFetcher, useNavigate, useLocation } from '@remix-run/react';
import { Group, Button, ActionIcon, Title, Alert, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDebouncedValue } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Save, ArrowLeft, AlertCircle, RotateCcw } from 'lucide-react';
import omit from 'lodash/omit';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import { useFind, useMutation } from '~/components/provider';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import {
  PatientForm,
  EMPTY_PATIENT_FORM_VALUES,
  buildFormPayload,
  type PatientFormValues,
} from '~/components/forms/patient-form';
import { getPageTitle } from '~/utils/meta';

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'new_patient') }];
};

export const loader = authenticatedLoader();

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const payload = JSON.parse(formData.get('data') as string);

  const { existingPersonalDataId, personalData, contactData, patientFields } = payload;

  if (existingPersonalDataId) {
    const patchable = omit(personalData, ['documentValue']);
    await client.service('personal-data').patch(existingPersonalDataId, patchable);
  }

  const patient = await client.service('patients').create({
    personalData,
    contactData,
    medicare: patientFields.medicare,
    medicareNumber: patientFields.medicareNumber,
    medicarePlan: patientFields.medicarePlan,
  });

  return json({ success: true, patientId: patient.id });
};

const PageContainer = styled('div', {
  base: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',

    lg: {
      padding: '2rem',
    },
  },
});

interface AssignSlotState {
  assignSlot: { medicId: string; startDate: string; extra: boolean };
  returnTo: string;
}

export default function NewPatient() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const fetcher = useFetcher();
  const { create: createAppointment } = useMutation('appointments');
  const hasHandledSuccess = useRef(false);

  const state = location.state as AssignSlotState | undefined;
  const assignSlot = state?.assignSlot;
  const returnTo = state?.returnTo;

  const [existingPersonalDataId, setExistingPersonalDataId] = useState<string | null>(null);

  const form = useForm<PatientFormValues>({
    initialValues: EMPTY_PATIENT_FORM_VALUES,
    validate: {
      documentValue: value => (value.trim() ? null : t('patients.validation.document_required')),
      firstName: value => (value.trim() ? null : t('patients.validation.first_name_required')),
      lastName: value => (value.trim() ? null : t('patients.validation.last_name_required')),
    },
  });

  const [debouncedDocValue] = useDebouncedValue(form.values.documentValue, 500);

  const personalDataQuery = useMemo(
    () => (debouncedDocValue.trim() ? { documentValue: debouncedDocValue.trim(), $limit: 1 } : null),
    [debouncedDocValue]
  );

  const patientQuery = useMemo(
    () => (debouncedDocValue.trim() ? { documentValue: debouncedDocValue.trim(), $limit: 1 } : null),
    [debouncedDocValue]
  );

  const { response: pdResponse, isLoading: pdLoading } = useFind('personal-data', personalDataQuery ?? undefined, {
    enabled: !!personalDataQuery,
  });

  const { response: ptResponse, isLoading: ptLoading } = useFind('patients', patientQuery ?? undefined, {
    enabled: !!patientQuery,
  });

  const pdResults = (pdResponse as any)?.data || [];
  const ptResults = (ptResponse as any)?.data || [];
  const isLookingUp = pdLoading || ptLoading;

  const existingPersonalData = pdResults.length > 0 ? pdResults[0] : null;
  const existingPatient = ptResults.length > 0 ? ptResults[0] : null;
  const patientAlreadyExists = !!existingPatient;

  useEffect(() => {
    if (existingPersonalData && !patientAlreadyExists) {
      setExistingPersonalDataId(existingPersonalData.id);
      form.setValues({
        firstName: existingPersonalData.firstName || '',
        lastName: existingPersonalData.lastName || '',
        nationality: existingPersonalData.nationality || 'AR',
        maritalStatus: existingPersonalData.maritalStatus || '',
        birthDate: existingPersonalData.birthDate ? new Date(existingPersonalData.birthDate) : null,
        gender: existingPersonalData.gender || '',
        documentType: existingPersonalData.documentType || form.values.documentType,
      });
    }

    if (!existingPersonalData) {
      setExistingPersonalDataId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingPersonalData?.id, patientAlreadyExists]);

  const isSaving = fetcher.state !== 'idle';
  const actionData = fetcher.data as { success?: boolean; patientId?: string } | undefined;

  useEffect(() => {
    if (!actionData?.success || hasHandledSuccess.current) return;

    const patientId = actionData.patientId;
    if (!patientId) return;

    hasHandledSuccess.current = true;

    if (assignSlot && returnTo) {
      createAppointment({
        patientId,
        medicId: assignSlot.medicId,
        startDate: assignSlot.startDate,
        extra: assignSlot.extra,
      }).then(() => {
        navigate(returnTo);
      });
    } else {
      navigate(-1);
    }
  }, [actionData?.success, actionData?.patientId, assignSlot, returnTo, createAppointment, navigate]);

  const canSave =
    !patientAlreadyExists &&
    form.values.documentValue.trim() &&
    form.values.firstName.trim() &&
    form.values.lastName.trim();

  const handleSave = useCallback(() => {
    if (!canSave) return;
    const validation = form.validate();
    if (validation.hasErrors) return;

    const { personalData, contactData, patientFields } = buildFormPayload(form.values);

    const payload = {
      existingPersonalDataId,
      personalData,
      contactData,
      patientFields,
    };

    fetcher.submit({ data: JSON.stringify(payload) }, { method: 'post' });
  }, [canSave, form, existingPersonalDataId, fetcher]);

  const handleReset = useCallback(() => {
    form.reset();
    setExistingPersonalDataId(null);
  }, [form]);

  return (
    <PageContainer>
      <Portal id="toolbar">
        <Group align="center" flex={1}>
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </ActionIcon>
          <Title m={0} lh={1} fz="h2">
            {t('patients.new_patient')}
          </Title>
        </Group>
      </Portal>

      <Portal id="form-actions">
        <Group>
          <Button onClick={handleSave} disabled={!canSave} loading={isSaving} leftSection={<Save size={16} />}>
            {t('patients.save')}
          </Button>
        </Group>
      </Portal>

      {isLookingUp && (
        <Text size="xs" c="dimmed">
          {t('patients.looking_up')}
        </Text>
      )}

      {patientAlreadyExists && (
        <Alert
          icon={<AlertCircle size={16} />}
          color="red"
          withCloseButton
          closeButtonLabel={t('common.reset')}
          onClose={handleReset}
        >
          <Group justify="space-between" align="center">
            <Text>{t('patients.patient_already_exists')}</Text>
            <Button
              variant="subtle"
              color="red"
              size="compact-sm"
              leftSection={<RotateCcw size={14} />}
              onClick={handleReset}
            >
              {t('common.reset')}
            </Button>
          </Group>
        </Alert>
      )}

      {existingPersonalData && !patientAlreadyExists && (
        <Alert
          icon={<AlertCircle size={16} />}
          color="blue"
          withCloseButton
          closeButtonLabel={t('common.reset')}
          onClose={handleReset}
        >
          <Group justify="space-between" align="center">
            <Text>{t('patients.personal_data_found')}</Text>
            <Button
              variant="subtle"
              color="blue"
              size="compact-sm"
              leftSection={<RotateCcw size={14} />}
              onClick={handleReset}
            >
              {t('common.reset')}
            </Button>
          </Group>
        </Alert>
      )}

      <PatientForm form={form} disabled={patientAlreadyExists} showContactAndInsurance={!patientAlreadyExists} />
    </PageContainer>
  );
}
