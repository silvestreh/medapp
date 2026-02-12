import { useState, useCallback } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Group, Title, Stack, Button, ActionIcon, Tooltip, Tabs, Text } from '@mantine/core';
import { X } from 'lucide-react';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import EncounterTree from '~/components/encounter-tree';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { EncounterForm } from '~/components/forms/encounter-form';
import { StudyForm } from '~/components/forms/study-form';
import { studySchemas } from '~/components/forms/study-schemas';
import { PatientOverview } from '~/components/patient-overview';
import type { StudyResultData } from '~/components/forms/study-form-types';

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
    borderRight: '1px solid var(--mantine-color-gray-2)',

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
    position: 'sticky',
    top: '4.5rem',
  },
});

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Detalle de Encuentro' }];
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { patientId } = params;

  if (!patientId) {
    throw new Response('Patient ID is required', { status: 400 });
  }

  const { client, user } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const data = JSON.parse(formData.get('data') as string);

  await client.service('encounters').create({
    patientId,
    medicId: user.id,
    date: new Date(),
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
  const { t } = useTranslation();
  const data = useLoaderData<typeof loader>();

  // Encounter selection
  const [selectedEncounter, setSelectedEncounter] = useState<any>(null);
  const [activeFormKey, setActiveFormKey] = useState<string | undefined>(undefined);

  // Study selection
  const [selectedStudy, setSelectedStudy] = useState<any>(null);

  const clearSelection = useCallback(() => {
    setSelectedEncounter(null);
    setActiveFormKey(undefined);
    setSelectedStudy(null);
  }, []);

  const handleEncounterClick = useCallback((encounter: any) => {
    setSelectedStudy(null);
    setSelectedEncounter(encounter);
    setActiveFormKey(undefined);
  }, []);

  const handleFormClick = useCallback((encounter: any, formKey: string) => {
    setSelectedStudy(null);
    setSelectedEncounter(encounter);
    setActiveFormKey(formKey);
  }, []);

  const handleStudyClick = useCallback((study: any) => {
    setSelectedEncounter(null);
    setActiveFormKey(undefined);
    setSelectedStudy(study);
  }, []);

  const hasSelection = selectedEncounter || selectedStudy;

  if (!data) {
    return null;
  }

  return (
    <Container className="encounters-container">
      <Portal id="toolbar">
        <Group justify="space-between" align="center" style={{ width: '100%' }}>
          <Title order={2} fz="md">
            {data.patient.personalData.firstName} {data.patient.personalData.lastName}
          </Title>
          <Button component={Link} to={`/encounters/${data.patient.id}/new`}>
            {t('encounters.new')}
          </Button>
        </Group>
      </Portal>

      <Sidebar>
        <EncounterTree
          encounters={data.encounters}
          studies={data.studies}
          activeEncounterId={selectedEncounter?.id}
          activeFormKey={activeFormKey}
          activeStudyId={selectedStudy?.id}
          onEncounterClick={handleEncounterClick}
          onFormClick={handleFormClick}
          onStudyClick={handleStudyClick}
        />
      </Sidebar>

      <Content>
        {hasSelection ? (
          <Stack key={`${selectedEncounter?.id ?? selectedStudy?.id}-${activeFormKey ?? 'study'}`} pos="relative">
            {/* Encounter form */}
            {selectedEncounter && (
              <EncounterForm
                encounter={selectedEncounter}
                readOnly={!!selectedEncounter.id}
                activeFormKey={activeFormKey}
              />
            )}

            {/* Study forms (read-only) — tabbed by result type */}
            {selectedStudy?.results?.length > 0 && (
              <>
                <Text c="gray.5" size="xl" mb="sm">
                  Protocolo #{selectedStudy.protocol}
                </Text>
                <Tabs defaultValue={selectedStudy.results[0].type} variant="pills">
                  <Tabs.List bd="1px solid var(--mantine-color-gray-2)" bdrs={4}>
                    {selectedStudy.results.map((result: any) => (
                      <Tabs.Tab key={result.type} value={result.type}>
                        {studySchemas[result.type]?.label ?? result.type}
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>

                  {selectedStudy.results.map((result: any) => {
                    const schema = studySchemas[result.type];
                    if (!schema) return null;
                    return (
                      <Tabs.Panel key={result.type} value={result.type} pt="md">
                        <StudyForm
                          schema={schema}
                          initialData={result.data as StudyResultData}
                          onChange={() => {}}
                          readOnly
                        />
                      </Tabs.Panel>
                    );
                  })}
                </Tabs>
              </>
            )}

            <Tooltip label={t('common.close')} position="left">
              <ActionIcon variant="filled" color="gray" onClick={clearSelection} pos="absolute" top={0} right={0}>
                <X size={16} />
              </ActionIcon>
            </Tooltip>
          </Stack>
        ) : (
          <PatientOverview patient={data.patient} encounters={data.encounters} />
        )}
      </Content>
    </Container>
  );
}
