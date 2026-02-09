import { useState, useCallback } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import { Title, Stack } from '@mantine/core';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import EncounterTree from '~/components/encounter-tree';
import Portal from '~/components/portal';
import { styled } from '~/stitches';
import { ReasonForConsultationForm } from '~/components/forms/reason-for-consultation-form';

const Container = styled('div', {
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  width: '100%',

  '@lg': {
    flexDirection: 'row',
  },
});

const Sidebar = styled('div', {
  background: 'white',
  borderRight: '1px solid var(--mantine-color-gray-1)',

  '@lg': {
    minHeight: 'calc(100vh - 5em)',
    minWidth: '300px',
  },
});

const Content = styled('div', {
  flex: 1,
  height: '100%',
  padding: '2rem',
});

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Detalle de Encuentro' }];
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const encounterId = formData.get('encounterId') as string;
  const formKey = formData.get('formKey') as string;
  const data = JSON.parse(formData.get('data') as string);

  const encounter = await client.service('encounters').get(encounterId);

  await client.service('encounters').patch(encounterId, {
    data: {
      ...encounter.data,
      [formKey]: data,
    },
  });

  return json({ success: true });
};

export const loader = authenticatedLoader(async ({ params, request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const { patientId } = params;

  if (!patientId) {
    throw new Response('Patient ID is required', { status: 400 });
  }

  const [patient, encounters, studies] = await Promise.all([
    client.service('patients').get(patientId),
    client.service('encounters').find({
      query: {
        patientId,
        $sort: { date: -1 },
        $limit: 100,
      },
    }),
    client.service('studies').find({
      query: {
        patientId,
        $sort: { createdAt: -1 },
      },
    }),
  ]);

  return {
    user,
    patient,
    encounters: (encounters as any).data || encounters,
    studies: (studies as any).data || studies,
  };
});

export default function PatientEncounterDetail() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [selectedEncounter, setSelectedEncounter] = useState<any>(null);
  const [selectedFormKey, setSelectedFormKey] = useState<string | null>(null);

  const handleFormClick = useCallback((encounter: any, formKey: string) => {
    setSelectedEncounter(encounter);
    setSelectedFormKey(formKey);
  }, []);

  const handleFormSubmit = async (formData: any) => {
    if (!selectedEncounter || !selectedFormKey) return;

    fetcher.submit(
      {
        encounterId: selectedEncounter.id,
        formKey: selectedFormKey,
        data: JSON.stringify(formData),
      },
      { method: 'post' }
    );

    setSelectedEncounter(null);
    setSelectedFormKey(null);
  };

  return (
    <Container className="encounters-container">
      <Portal id="toolbar">
        <Title order={2}>
          {data.patient.personalData.firstName} {data.patient.personalData.lastName}
        </Title>
      </Portal>

      <Sidebar>
        <EncounterTree
          encounters={data.encounters}
          activeEncounterId={selectedEncounter?.id}
          activeFormKey={selectedFormKey || undefined}
          onEncounterClick={encounter => {
            setSelectedEncounter(encounter);
            setSelectedFormKey(null);
          }}
          onFormClick={handleFormClick}
        />
      </Sidebar>

      <Content>
        <Stack>
          {selectedFormKey === 'general/consulta_internacion' && (
            <ReasonForConsultationForm
              initialData={selectedEncounter.data[selectedFormKey]}
              onSubmit={handleFormSubmit}
              // readOnly
            />
          )}
        </Stack>
      </Content>
    </Container>
  );
}
