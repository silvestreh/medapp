import { type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Title } from '@mantine/core';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import EncounterTree from '~/components/encounter-tree';
import Portal from '~/components/portal';
import { styled } from '~/stitches';

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
});

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Detalle de Encuentro' }];
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
          onEncounterClick={encounter => console.log('Encounter clicked', encounter)}
        />
      </Sidebar>

      <Content>{/* <Code block>{JSON.stringify(data, null, 2)}</Code> */}</Content>
    </Container>
  );
}
