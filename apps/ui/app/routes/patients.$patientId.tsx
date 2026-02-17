import { useCallback, useEffect } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate } from '@remix-run/react';
import { Group, Button, ActionIcon, Title, Alert, Text, Modal } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Save, ArrowLeft, Trash2, AlertCircle } from 'lucide-react';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import {
  PatientForm,
  parsePatientToFormValues,
  buildFormPayload,
  type PatientFormValues,
} from '~/components/forms/patient-form';

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Paciente' }];
};

export const loader = authenticatedLoader(async ({ params, request }: LoaderFunctionArgs) => {
  const { patientId } = params;
  if (!patientId) throw new Response('Patient ID is required', { status: 400 });

  const { client } = await getAuthenticatedClient(request);
  const patient = await client.service('patients').get(patientId);

  return { patient };
});

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { patientId } = params;
  if (!patientId) throw new Response('Patient ID is required', { status: 400 });

  const { client } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const payload = JSON.parse(formData.get('data') as string);
  const intent = payload.intent;

  if (intent === 'delete') {
    const [encounters, studies] = await Promise.all([
      client.service('encounters').find({ query: { patientId, $limit: 0 } }),
      client.service('studies').find({ query: { patientId, $limit: 0 } }),
    ]);

    const encounterCount = (encounters as any).total || 0;
    const studyCount = (studies as any).total || 0;

    if (encounterCount > 0 || studyCount > 0) {
      return json({
        success: false,
        error: 'cannot_delete',
        encounterCount,
        studyCount,
      });
    }

    await client.service('patients').remove(patientId);
    return redirect('/patients');
  }

  if (intent === 'save') {
    const { personalDataId, contactDataId, personalData, contactData, patientFields } = payload;

    const promises: Promise<any>[] = [];

    if (personalDataId && personalData) {
      const { documentValue, ...patchablePersonalData } = personalData;
      promises.push(client.service('personal-data').patch(personalDataId, patchablePersonalData));
    }

    if (contactDataId && contactData) {
      promises.push(client.service('contact-data').patch(contactDataId, contactData));
    }

    if (patientFields) {
      promises.push(client.service('patients').patch(patientId, patientFields));
    }

    await Promise.all(promises);
    return json({ success: true });
  }

  return json({ success: false, error: 'unknown_intent' });
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

export default function PatientDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const { patient } = useLoaderData<typeof loader>() as { patient: any };
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);

  const form = useForm<PatientFormValues>({
    initialValues: parsePatientToFormValues(patient),
    validate: {
      firstName: (value) => (value.trim() ? null : t('patients.validation.first_name_required')),
      lastName: (value) => (value.trim() ? null : t('patients.validation.last_name_required')),
    },
  });

  const isSaving = fetcher.state !== 'idle';

  const actionData = fetcher.data as { success?: boolean; error?: string; encounterCount?: number; studyCount?: number } | undefined;

  useEffect(() => {
    if (actionData?.success) {
      navigate(-1);
    }
  }, [actionData?.success, navigate]);

  const handleSave = useCallback(() => {
    const validation = form.validate();
    if (validation.hasErrors) return;

    const { personalData, contactData, patientFields } = buildFormPayload(form.values);

    const payload = {
      intent: 'save',
      personalDataId: patient.personalData?.id,
      contactDataId: patient.contactData?.id,
      personalData,
      contactData,
      patientFields,
    };

    fetcher.submit({ data: JSON.stringify(payload) }, { method: 'post' });
  }, [form, patient, fetcher]);

  const handleDelete = useCallback(() => {
    fetcher.submit(
      { data: JSON.stringify({ intent: 'delete' }) },
      { method: 'post' }
    );
    closeDelete();
  }, [fetcher, closeDelete]);

  const canDelete = !isSaving;

  return (
    <PageContainer>
      <Portal id="toolbar">
        <Group align="center" flex={1}>
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => navigate('/patients')}>
            <ArrowLeft size={20} />
          </ActionIcon>
          <Title m={0} lh={1} fz="h2">
            {patient.personalData?.firstName} {patient.personalData?.lastName}
          </Title>
        </Group>
      </Portal>

      <Portal id="form-actions">
        <Group>
          <Button
            variant="outline"
            color="red"
            onClick={openDelete}
            disabled={!canDelete}
            leftSection={<Trash2 size={16} />}
          >
            {t('patients.delete')}
          </Button>
          <Button onClick={handleSave} loading={isSaving} leftSection={<Save size={16} />}>
            {t('patients.save')}
          </Button>
        </Group>
      </Portal>

      {actionData?.error === 'cannot_delete' && (
        <Alert icon={<AlertCircle size={16} />} color="red">
          {t('patients.cannot_delete', {
            encounters: actionData.encounterCount,
            studies: actionData.studyCount,
          })}
        </Alert>
      )}

      {actionData?.success && (
        <Alert color="green">
          {t('patients.saved_successfully')}
        </Alert>
      )}

      <PatientForm
        form={form}
        readOnlyDocument
      />

      {/* Delete confirmation modal */}
      <Modal opened={deleteOpened} onClose={closeDelete} title={t('patients.delete_confirm_title')}>
        <Text mb="lg">{t('patients.delete_confirm_body')}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={closeDelete}>
            {t('common.cancel')}
          </Button>
          <Button color="red" onClick={handleDelete} leftSection={<Trash2 size={16} />}>
            {t('patients.delete')}
          </Button>
        </Group>
      </Modal>
    </PageContainer>
  );
}
