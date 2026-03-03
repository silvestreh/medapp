import { useState, useCallback, useMemo } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData, useNavigate } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Group, Stack, Button, ActionIcon, Tooltip, Tabs, Text } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { X, FileDown, Printer, Plus } from 'lucide-react';

import { getAuthenticatedClient, authenticatedLoader, isMedicVerified, getCurrentOrgRoleIds } from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import { parseFormJson } from '~/utils/parse-form-json';
import EncounterTree from '~/components/encounter-tree';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { EncounterForm } from '~/components/forms/encounter-form';
import { StudyForm } from '~/components/forms/study-form';
import { studySchemas } from '~/components/forms/study-schemas';
import { PatientOverview } from '~/components/patient-overview';
import type { StudyResultData } from '~/components/forms/study-form-types';
import { getPageTitle } from '~/utils/meta';
import { media } from '~/media';
import { ExportSignedPdfDialog } from '~/components/export-signed-pdf-dialog';
import { PrintPdfDialog } from '~/components/print-pdf-dialog';
import { Fab, FabItem } from '~/components/fab';
import { ToolbarTitle } from '~/components/toolbar-title';
import { EncounterAiChatPanel } from '~/components/encounter-ai-chat-panel';

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
    padding: '1rem',
    position: 'sticky',
    top: '4.5rem',

    lg: {
      padding: '2rem',
    },
  },
});

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'encounter_detail') }];
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { patientId } = params;

  if (!patientId) {
    throw new Response('Patient ID is required', { status: 400 });
  }

  const { client, user } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const data = parseFormJson(formData.get('data'));

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

  const loaderOrgId = await getCurrentOrganizationId(request);
  const orgRoleIds = getCurrentOrgRoleIds(user, loaderOrgId);
  const isMedic = orgRoleIds.includes('medic');

  const [patient, encounters, studies, isVerified] = await Promise.all([
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
    isMedicVerified(user, orgRoleIds),
  ]);

  let hasCertificate = false;
  let isCertificateEncrypted = false;
  if (isMedic) {
    try {
      const certs = await client.service('signing-certificates' as any).find({ query: { $limit: 1 } });
      const certList = Array.isArray(certs) ? certs : (certs as any)?.data || [];
      hasCertificate = certList.length > 0;
      if (certList.length > 0) {
        isCertificateEncrypted = !!(certList[0] as any).isClientEncrypted;
      }
    } catch {
      // signing-certificates may not exist yet
    }
  }

  return {
    user,
    patient,
    encounters: (encounters as any).data || encounters,
    studies: (studies as any).data || studies,
    isMedic,
    isVerified,
    hasCertificate,
    isCertificateEncrypted,
  };
});

export default function PatientEncounterDetail() {
  const { t } = useTranslation();
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery(media.md);
  const [exportOpened, { open: openExport, close: closeExport }] = useDisclosure(false);
  const [printOpened, { open: openPrint, close: closePrint }] = useDisclosure(false);
  const [fabOpen, { toggle: toggleFab, close: closeFab }] = useDisclosure(false);

  const handleFabPrint = useCallback(() => {
    closeFab();
    openPrint();
  }, [closeFab, openPrint]);

  const handleFabExport = useCallback(() => {
    closeFab();
    openExport();
  }, [closeFab, openExport]);

  const handleFabNewEncounter = useCallback(() => {
    closeFab();
    navigate(`/encounters/${data.patient.id}/new`);
  }, [closeFab, navigate, data.patient.id]);

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const dateRange = useMemo(() => {
    const encounters = data?.encounters || [];
    const studies = data?.studies || [];
    const allDates = [
      ...encounters.map((e: any) => new Date(e.date)),
      ...studies.map((s: any) => new Date(s.date || s.createdAt)),
    ];
    if (allDates.length === 0) return { min: null, max: null };
    return {
      min: new Date(Math.min(...allDates.map((d: Date) => d.getTime()))),
      max: new Date(Math.max(...allDates.map((d: Date) => d.getTime()))),
    };
  }, [data?.encounters, data?.studies]);

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
          <ToolbarTitle
            title={`${data.patient.personalData.firstName} ${data.patient.personalData.lastName}`}
            onBack={handleGoBack}
          />
          {isDesktop && (
            <Group gap="sm">
              {data.isMedic && (
                <Button variant="light" leftSection={<Printer size={16} />} onClick={openPrint}>
                  {t('print_pdf.button')}
                </Button>
              )}
              {data.isMedic && (
                <Button variant="light" leftSection={<FileDown size={16} />} onClick={openExport}>
                  {t('export_pdf.button')}
                </Button>
              )}
              {data.isVerified && (
                <Button component={Link} to={`/encounters/${data.patient.id}/new`} leftSection={<Plus size={16} />}>
                  {t('encounters.new')}
                </Button>
              )}
            </Group>
          )}
        </Group>
      </Portal>

      {data.isMedic && (
        <ExportSignedPdfDialog
          opened={exportOpened}
          onClose={closeExport}
          patientId={data.patient.id}
          patientName={`${data.patient.personalData.firstName || ''} ${data.patient.personalData.lastName || ''}`.trim()}
          hasCertificate={data.hasCertificate}
          isCertificateEncrypted={data.isCertificateEncrypted}
          dateRange={dateRange}
        />
      )}

      {data.isMedic && (
        <PrintPdfDialog
          opened={printOpened}
          onClose={closePrint}
          patientId={data.patient.id}
          patientName={`${data.patient.personalData.firstName || ''} ${data.patient.personalData.lastName || ''}`.trim()}
          dateRange={dateRange}
        />
      )}

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
            {selectedEncounter && (
              <EncounterForm
                encounter={selectedEncounter}
                readOnly={!!selectedEncounter.id}
                activeFormKey={activeFormKey}
              />
            )}

            {selectedStudy?.results?.length === 1 && studySchemas[selectedStudy.results[0].type] && (
              <StudyForm
                schema={studySchemas[selectedStudy.results[0].type]}
                initialData={selectedStudy.results[0].data as StudyResultData}
                onChange={() => {}}
                readOnly
              />
            )}

            {selectedStudy?.results?.length > 1 && (
              <>
                <Text c="gray.5" size="xl">
                  Protocolo #{selectedStudy.protocol}
                </Text>
                <Tabs defaultValue={selectedStudy.results[0].type}>
                  <Tabs.List>
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
        <EncounterAiChatPanel
          patientId={String(data.patient.id)}
          encounterDraft={selectedEncounter?.data || {}}
        />
      </Content>

      {!isDesktop && (
        <Fab open={fabOpen} onToggle={toggleFab} onClose={closeFab}>
          {data.isMedic && (
            <FabItem onClick={handleFabPrint} index={data.isMedic ? 2 : 0}>
              <Printer size={18} />
              {t('print_pdf.button')}
            </FabItem>
          )}
          {data.isMedic && (
            <FabItem onClick={handleFabExport} index={1}>
              <FileDown size={18} />
              {t('export_pdf.button')}
            </FabItem>
          )}
          {data.isVerified && (
            <FabItem onClick={handleFabNewEncounter} index={0}>
              <Plus size={18} />
              {t('encounters.new')}
            </FabItem>
          )}
        </Fab>
      )}
    </Container>
  );
}
