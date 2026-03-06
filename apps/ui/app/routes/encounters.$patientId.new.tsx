import { useState, useCallback, useMemo } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { useLoaderData, useNavigate } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Stack, Center, Text, ActionIcon, Tooltip, Group, Box, Button } from '@mantine/core';
import { Paperclip } from 'lucide-react';

import { getCurrentOrganizationId } from '~/session';
import { parseFormJson } from '~/utils/parse-form-json';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { EncounterForm } from '~/components/forms/encounter-form';
import NewEncounterSidebar from '~/components/new-encounter-sidebar';
import { EncounterAiChatPanel } from '~/components/encounter-ai-chat-panel';
import { getPageTitle } from '~/utils/meta';
import { ToolbarTitle } from '~/components/toolbar-title';
import { useAttachmentUpload, FloatingAttachmentsList, type AttachmentData } from '~/components/encounter-attachments';
import { useFeathers } from '~/components/provider';
import {
  getAuthenticatedClient,
  authenticatedLoader,
  isMedicVerified,
  getCurrentOrgRoleIds,
} from '~/utils/auth.server';

const Container = styled('div', {
  base: {
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    width: '100%',

    lg: {
      flexDirection: 'row',
    },
  },
});

const Sidebar = styled('div', {
  base: {
    background: 'white',
    borderRight: '1px solid var(--mantine-color-gray-1)',

    lg: {
      minHeight: 'calc(100vh - 5em)',
      minWidth: '300px',
    },
  },
});

const Content = styled('div', {
  base: {
    flex: 1,
    height: '100%',
    padding: '2rem',
  },
});

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'new_encounter') }];
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { patientId } = params;

  if (!patientId) {
    throw new Response('Patient ID is required', { status: 400 });
  }

  const { client, user } = await getAuthenticatedClient(request);
  const actionOrgId = await getCurrentOrganizationId(request);
  const actionOrgRoleIds = getCurrentOrgRoleIds(user, actionOrgId);
  const verified = isMedicVerified(user, actionOrgRoleIds);
  if (!verified) {
    return redirect(`/encounters/${patientId}`);
  }

  const formData = await request.formData();
  const data = parseFormJson(formData.get('data'));
  const postedInsurerId = String(formData.get('insurerId') || '').trim();

  const patient = await client.service('patients').get(patientId);
  const insurerId = postedInsurerId || (patient as any).medicareId || null;

  await client.service('encounters').create({
    patientId,
    medicId: user.id,
    date: new Date(),
    data,
    insurerId,
  });

  return redirect(`/encounters/${patientId}`);
};

export const loader = authenticatedLoader(async ({ params, request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const { patientId } = params;

  if (!patientId) {
    throw new Response('Patient ID is required', { status: 400 });
  }

  const loaderOrgId = await getCurrentOrganizationId(request);
  const loaderOrgRoleIds = getCurrentOrgRoleIds(user, loaderOrgId);
  const verified = isMedicVerified(user, loaderOrgRoleIds);

  if (!verified) {
    throw redirect(`/encounters/${patientId}`);
  }

  const patient = await client.service('patients').get(patientId);
  const insurerId = (patient as any).medicareId || null;

  return {
    patient,
    insurerId,
  };
});

const ALL_FORMS = [
  'general/consulta_internacion',
  null,
  'antecedentes/habitacionales',
  'antecedentes/familiares',
  'antecedentes/personales',
  'antecedentes/habitos',
  'antecedentes/medicamentosos',
  'antecedentes/ocupacionales',
  null,
  'alergias/general',
  'alergias/medicamentos',
  'alergias/asma',
  null,
  'cardiologia/general',
  null,
  'general/enfermedad_actual',
  'general/evolucion_consulta_internacion',
];

function cleanSeparators(list: (string | null)[]): (string | null)[] {
  return list
    .filter((item, i) => item !== null || list[i - 1] !== null) // no consecutive nulls
    .filter((item, i, arr) => item !== null || (i !== 0 && i !== arr.length - 1)); // no leading/trailing nulls
}

export default function NewEncounter() {
  const { t } = useTranslation();
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { patient } = data;
  const client = useFeathers();
  const [formValues, setFormValues] = useState<any>({});
  const [activeFormKey, setActiveFormKey] = useState<string | undefined>(undefined);

  const handleAttached = useCallback((attachment: AttachmentData) => {
    setFormValues((prev: any) => ({
      ...prev,
      attachments: [...(prev.attachments || []), attachment],
    }));
  }, []);

  const handleRemoveAttachment = useCallback(async (index: number) => {
    const att = formValues.attachments?.[index];
    if (att?.url) {
      const filename = att.url.split('/').pop();
      if (filename?.endsWith('.enc')) {
        try {
          const token = await (client as any).authentication?.getAccessToken?.();
          const orgId = (client as any).organizationId;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;
          if (orgId) headers['organization-id'] = orgId;
          await fetch(`/api/file-uploads/${filename}`, { method: 'DELETE', headers });
        } catch {
          // best-effort deletion
        }
      }
    }
    setFormValues((prev: any) => {
      const attachments = [...(prev.attachments || [])];
      attachments.splice(index, 1);
      return { ...prev, attachments };
    });
  }, [formValues.attachments, client]);

  const { openFilePicker, uploading, FileInputElement } = useAttachmentUpload(handleAttached);

  const activeForms = useMemo(() => {
    const filtered = ALL_FORMS.filter(key => key === null || formValues[key] !== undefined);
    return cleanSeparators(filtered);
  }, [formValues]);

  const availableForms = useMemo(() => {
    const filtered = ALL_FORMS.filter(key => key === null || formValues[key] === undefined);
    return cleanSeparators(filtered);
  }, [formValues]);

  const handleFormClick = useCallback((formKey: string) => {
    setActiveFormKey(formKey);
  }, []);

  const handleValuesChange = useCallback((values: any) => {
    setFormValues(values);
  }, []);

  const handleRemoveForm = useCallback(
    (formKey: string) => {
      setFormValues((prev: any) => {
        const newValues = { ...prev };
        delete newValues[formKey];
        return newValues;
      });
      if (activeFormKey === formKey) {
        setActiveFormKey(undefined);
      }
    },
    [activeFormKey]
  );

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (!data) {
    return null;
  }

  return (
    <Container className="encounters-container">
      <Portal id="toolbar">
        <Group justify="space-between" align="center" style={{ width: '100%' }}>
          <ToolbarTitle
            title={t('encounters.new')}
            subTitle={`${patient.personalData.firstName} ${patient.personalData.lastName}`}
            onBack={handleGoBack}
          />
          <Box visibleFrom="lg">
            <Button variant="light" onClick={openFilePicker} loading={uploading} leftSection={<Paperclip size={16} />}>
              {t('encounters.attach_file')}
            </Button>
          </Box>
          <Box hiddenFrom="lg">
            <Tooltip label={t('encounters.attach_file')}>
              <ActionIcon variant="light" onClick={openFilePicker} loading={uploading}>
                <Paperclip size={16} />
              </ActionIcon>
            </Tooltip>
          </Box>
        </Group>
      </Portal>
      {FileInputElement}

      <Sidebar>
        <NewEncounterSidebar
          availableForms={availableForms}
          activeForms={activeForms}
          activeFormKey={activeFormKey}
          onFormClick={handleFormClick}
          onRemoveForm={handleRemoveForm}
        />
      </Sidebar>

      <Content>
        <Stack key={activeFormKey ?? 'no-active-form'}>
          {(activeFormKey || formValues.attachments?.length > 0) && (
            <EncounterForm
              encounter={{ patientId: patient.id, data: formValues }}
              readOnly={false}
              activeFormKey={activeFormKey || '__none__'}
              onValuesChange={handleValuesChange}
              insurerId={data.insurerId}
            />
          )}
          {!activeFormKey && (
            <Center style={{ height: '100%' }}>
              <Text color="dimmed">{t('encounters.select_form_instruction')}</Text>
            </Center>
          )}
        </Stack>
        <EncounterAiChatPanel patientId={String(patient.id)} encounterDraft={formValues} />
      </Content>

      <FloatingAttachmentsList
        attachments={formValues.attachments || []}
        onRemove={handleRemoveAttachment}
      />
    </Container>
  );
}
