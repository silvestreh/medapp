import { useState, useCallback, useMemo } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData, useNavigate, useRevalidator } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Group, Stack, Button, ActionIcon, Tooltip, Tabs, Text } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { X, FileDown, Printer, Plus, ClipboardPen } from 'lucide-react';

import {
  getAuthenticatedClient,
  authenticatedLoader,
  isMedicVerified,
  getCurrentOrgRoleIds,
} from '~/utils/auth.server';
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
import { PrescriptionDetail } from '~/components/prescription-detail';
import { PrescribeModal } from '~/components/prescribe-modal';
import { AttachmentViewer } from '~/components/encounter-attachments';

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
  const intent = formData.get('intent');

  if (intent === 'prescribe') {
    const result = await client.service('recetario' as any).create({
      action: 'quick-link',
      patientId,
    });
    return json({ intent: 'prescribe', prescriptionsLink: (result as any).prescriptionsLink });
  }

  if (intent === 'get-patient-data') {
    const result = await client.service('recetario' as any).create({ action: 'get-patient-data', patientId });
    return json({ intent: 'get-patient-data', recetarioData: (result as any).recetarioData, matchedPrepagaId: (result as any).matchedPrepagaId, mhsPatientData: (result as any).mhsPatientData });
  }

  if (intent === 'search-recetario-medications') {
    const { search } = parseFormJson(formData.get('data'));
    const result = await client.service('recetario' as any).create({ action: 'search-medications', search });
    return json({ intent: 'search-recetario-medications', medications: (result as any).medications });
  }

  if (intent === 'create-prescription') {
    const { diagnosis, medications, hiv, patientData } = parseFormJson(formData.get('data'));
    const result = await client.service('recetario' as any).create({ action: 'prescribe', patientId, diagnosis, medications, hiv, patientData });
    return json({ intent: 'create-prescription', success: true, url: (result as any).url ?? null, prescriptionId: (result as any).prescriptionId ?? null, recetarioDocumentId: (result as any).recetarioDocumentId ?? null });
  }

  if (intent === 'create-order') {
    const { diagnosis, content, patientData } = parseFormJson(formData.get('data'));
    const result = await client.service('recetario' as any).create({ action: 'order', patientId, diagnosis, content, patientData });
    return json({ intent: 'create-order', success: true, url: (result as any).url ?? null, prescriptionId: (result as any).prescriptionId ?? null, recetarioDocumentId: (result as any).recetarioDocumentId ?? null });
  }

  if (intent === 'cancel-prescription') {
    const { prescriptionId, recetarioDocumentId } = parseFormJson(formData.get('data')) as any;
    await client.service('recetario' as any).create({ action: 'cancel', prescriptionId, recetarioDocumentId });
    return json({ intent: 'cancel-prescription', success: true });
  }

  if (intent === 'share-prescription') {
    const { prescriptionId, documentIds, shareChannel, shareRecipient, pdfUrl } = parseFormJson(formData.get('data')) as any;
    await client.service('recetario' as any).create({ action: 'share', prescriptionId, documentIds, shareChannel, shareRecipient, pdfUrl });
    return json({ intent: 'share-prescription', success: true });
  }

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

  let prescriptions: any[] = [];
  let recetarioReady = false;
  if (isMedic && isVerified) {
    try {
      const prescriptionsResult = await client.service('prescriptions' as any).find({
        query: { patientId, $sort: { createdAt: -1 }, $limit: 50 },
      });
      prescriptions = (prescriptionsResult as any).data || prescriptionsResult;
    } catch {
      // prescriptions service may not exist yet
    }

    try {
      const readiness = await client.service('recetario' as any).create({ action: 'check-readiness' });
      recetarioReady = !!(readiness as any).ready;
    } catch {
      // recetario service may not be configured
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
    prescriptions,
    recetarioReady,
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
  const [prescribeOpened, { open: openPrescribe, close: closePrescribe }] = useDisclosure(false);
  const { revalidate } = useRevalidator();

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

  // Prescription selection
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);

  // Attachment selection
  const [activeAttachmentIndex, setActiveAttachmentIndex] = useState<number | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedEncounter(null);
    setActiveFormKey(undefined);
    setSelectedStudy(null);
    setSelectedPrescription(null);
    setActiveAttachmentIndex(null);
  }, []);

  const handleEncounterClick = useCallback((encounter: any) => {
    setSelectedStudy(null);
    setSelectedPrescription(null);
    setSelectedEncounter(encounter);
    setActiveFormKey(undefined);
    setActiveAttachmentIndex(null);
  }, []);

  const handleFormClick = useCallback((encounter: any, formKey: string) => {
    setSelectedStudy(null);
    setSelectedPrescription(null);
    setSelectedEncounter(encounter);
    setActiveFormKey(formKey);
    setActiveAttachmentIndex(null);
  }, []);

  const handleStudyClick = useCallback((study: any) => {
    setSelectedEncounter(null);
    setActiveFormKey(undefined);
    setSelectedStudy(study);
    setSelectedPrescription(null);
    setActiveAttachmentIndex(null);
  }, []);

  const handlePrescriptionClick = useCallback((prescription: any) => {
    setSelectedEncounter(null);
    setActiveFormKey(undefined);
    setSelectedStudy(null);
    setSelectedPrescription(prescription);
    setActiveAttachmentIndex(null);
  }, []);

  const handleAttachmentClick = useCallback((encounter: any, index: number) => {
    setSelectedStudy(null);
    setSelectedPrescription(null);
    setSelectedEncounter(encounter);
    setActiveFormKey(undefined);
    setActiveAttachmentIndex(index);
  }, []);

  const hasSelection = selectedEncounter || selectedStudy || selectedPrescription;
  const selectedAttachment = selectedEncounter && activeAttachmentIndex !== null
    ? selectedEncounter.data?.attachments?.[activeAttachmentIndex]
    : null;

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
              {data.isVerified && data.recetarioReady && (
                <Tooltip label={t('recetario.prescribe_tooltip')}>
                  <Button
                    variant="light"
                    color="green"
                    leftSection={<ClipboardPen size={16} />}
                    onClick={openPrescribe}
                  >
                    {t('recetario.prescribe')}
                  </Button>
                </Tooltip>
              )}
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

      {data.isVerified && data.recetarioReady && (
        <PrescribeModal
          opened={prescribeOpened}
          onClose={closePrescribe}
          patient={data.patient}
          onSuccess={revalidate}
        />
      )}

      <Sidebar>
        <EncounterTree
          encounters={data.encounters}
          studies={data.studies}
          prescriptions={data.prescriptions}
          activeEncounterId={selectedEncounter?.id}
          activeFormKey={activeFormKey}
          activeStudyId={selectedStudy?.id}
          activePrescriptionId={selectedPrescription?.id}
          onEncounterClick={handleEncounterClick}
          onFormClick={handleFormClick}
          onStudyClick={handleStudyClick}
          onPrescriptionClick={handlePrescriptionClick}
          onAttachmentClick={handleAttachmentClick}
          activeAttachmentIndex={activeAttachmentIndex}
        />
      </Sidebar>

      <Content>
        {hasSelection ? (
          <Stack
            key={`${selectedEncounter?.id ?? selectedStudy?.id ?? selectedPrescription?.id}-${activeFormKey ?? 'none'}-${activeAttachmentIndex ?? 'none'}`}
            pos="relative"
          >
            {selectedAttachment && (
              <AttachmentViewer attachment={selectedAttachment} />
            )}

            {selectedEncounter && !selectedAttachment && (
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

            {selectedPrescription && (
              <PrescriptionDetail
                prescription={selectedPrescription}
                onCancelled={() => { revalidate(); clearSelection(); }}
              />
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
        <EncounterAiChatPanel patientId={String(data.patient.id)} encounterDraft={selectedEncounter?.data || {}} />
      </Content>

      {!isDesktop && (
        <Fab open={fabOpen} onToggle={toggleFab} onClose={closeFab}>
          {data.isVerified && data.recetarioReady && (
            <FabItem
              onClick={() => {
                closeFab();
                openPrescribe();
              }}
              index={3}
            >
              <ClipboardPen size={18} />
              {t('recetario.prescribe')}
            </FabItem>
          )}
          {data.isMedic && (
            <FabItem onClick={handleFabPrint} index={2}>
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
