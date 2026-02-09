import { useState, useCallback } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Title, Stack } from '@mantine/core';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import EncounterTree from '~/components/encounter-tree';
import Portal from '~/components/portal';
import { styled } from '~/stitches';
import { EncounterForm } from '~/components/forms/encounter-form';

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
  const data = JSON.parse(formData.get('data') as string);

  await client.service('encounters').patch(encounterId, {
    data,
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
  const [selectedEncounter, setSelectedEncounter] = useState<any>(null);
  const [activeFormKey, setActiveFormKey] = useState<string | undefined>(undefined);

  const handleEncounterClick = useCallback((encounter: any) => {
    setSelectedEncounter(encounter);
    setActiveFormKey(undefined);
  }, []);

  const handleFormClick = useCallback((encounter: any, formKey: string) => {
    setSelectedEncounter(encounter);
    setActiveFormKey(formKey);
  }, []);

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
          activeFormKey={activeFormKey}
          onEncounterClick={handleEncounterClick}
          onFormClick={handleFormClick}
        />
      </Sidebar>

      <Content>
        <Stack key={`${selectedEncounter?.id}-${activeFormKey}`}>
          {selectedEncounter && (
            <EncounterForm
              encounter={selectedEncounter}
              readOnly={false}
              activeFormKey={activeFormKey}
            />
          )}
        </Stack>
      </Content>
    </Container>
  );
}
