import { useState, useCallback, useEffect } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate, useParams } from '@remix-run/react';
import { Group, Button, Tabs, Text, Loader, Modal } from '@mantine/core';
import { useMediaQuery, useDisclosure } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Printer, Save } from 'lucide-react';

import { getCurrentOrganizationId } from '~/session';
import { parseFormJson } from '~/utils/parse-form-json';
import { useGet, useFeathers } from '~/components/provider';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { studySchemas } from '~/components/forms/study-schemas';
import { StudyForm } from '~/components/forms/study-form';
import { StudyMetadataForm } from '~/components/forms/study-metadata-form';
import type { StudyResultData } from '~/components/forms/study-form-types';
import { StyledTitle } from '~/components/forms/styles';
import { getPageTitle } from '~/utils/meta';
import { media } from '~/media';
import { pdfDataToBlob, printPdfBlob } from '~/utils/print-pdf';
import { Fab, FabItem } from '~/components/fab';
import { ToolbarTitle } from '~/components/toolbar-title';
import { useUnsavedGuard } from '~/hooks/use-unsaved-guard';
import {
  getAuthenticatedClient,
  authenticatedLoader,
  isMedicVerified,
  getCurrentOrgRoleIds,
} from '~/utils/auth.server';

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'study') }];
};

export const loader = authenticatedLoader(async ({ request }: LoaderFunctionArgs) => {
  const { user } = await getAuthenticatedClient(request);
  const orgId = await getCurrentOrganizationId(request);
  const orgRoleIds = getCurrentOrgRoleIds(user, orgId);
  const isVerified = isMedicVerified(user, orgRoleIds);
  return json({ isVerified });
});

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { studyId } = params;
  if (!studyId) throw new Response('Study ID is required', { status: 400 });

  const { client, user } = await getAuthenticatedClient(request);
  const actionOrgId = await getCurrentOrganizationId(request);
  const actionOrgRoleIds = getCurrentOrgRoleIds(user, actionOrgId);
  const verified = isMedicVerified(user, actionOrgRoleIds);
  if (!verified) {
    return json({ success: false }, { status: 403 });
  }

  const formData = await request.formData();
  const payload = parseFormJson<Record<string, any>>(formData.get('data'));

  await client.service('studies').patch(studyId, payload);

  return json({ success: true });
};

// ---------------------------------------------------------------------------
// Study type definitions
// ---------------------------------------------------------------------------

const STUDY_TYPE_KEYS = [
  'anemia',
  'anticoagulation',
  'compatibility',
  'hemostasis',
  'myelogram',
  'thrombophilia',
] as const;

// ---------------------------------------------------------------------------
// Page-level layout
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function StudyDetail() {
  const { t, i18n } = useTranslation();
  const { isVerified } = useLoaderData<typeof loader>();
  const { studyId } = useParams();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const client = useFeathers();
  const isDesktop = useMediaQuery(media.md);

  const { data: study, isLoading: studyLoading } = useGet('studies', studyId!);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleBack = useCallback(() => navigate(-1), [navigate]);

  const handlePrint = useCallback(async () => {
    if (!client || !studyId || !study?.patientId) return;

    setIsPrinting(true);
    try {
      const result = await client.service('signed-exports' as any).create({
        patientId: study.patientId,
        studyId,
        content: 'studies',
        delivery: 'download',
        locale: i18n.language,
      });

      if (result.pdf) {
        printPdfBlob(pdfDataToBlob(result));
      }
    } catch {
      // silent — printing is best-effort
    } finally {
      setIsPrinting(false);
    }
  }, [client, studyId, study?.patientId, i18n.language]);

  // Local draft state for result forms (saved through the unified study save action)
  const [resultDrafts, setResultDrafts] = useState<Record<string, StudyResultData>>({});

  // Local metadata state (initialized from study once loaded)
  const [metaDirty, setMetaDirty] = useState(false);
  const [comment, setComment] = useState<string | undefined>(undefined);
  const [noOrder, setNoOrder] = useState<boolean | undefined>(undefined);
  const [emergency, setEmergency] = useState<boolean | undefined>(undefined);
  const [selectedStudies, setSelectedStudies] = useState<string[] | undefined>(undefined);
  const [date, setDate] = useState<Date | null | undefined>(undefined);

  // Initialize local state from study data once loaded
  if (study?.id && comment === undefined) {
    setComment(study.comment || '');
    setNoOrder(study.noOrder ?? false);
    setEmergency(study.emergency ?? false);
    setSelectedStudies(study.studies || []);
    setDate(study.date ? new Date(study.date) : new Date());
  }

  const patient = study?.patient;
  const results: any[] = study?.results || [];

  const toggleStudy = useCallback((key: string) => {
    setSelectedStudies(prev => {
      if (!prev) return [key];
      return prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key];
    });
    setMetaDirty(true);
  }, []);

  useEffect(() => {
    const wasSaved = (fetcher.data as { success?: boolean } | undefined)?.success;
    if (fetcher.state === 'idle' && wasSaved) {
      setMetaDirty(false);
      setResultDrafts({});
    }
  }, [fetcher.state, fetcher.data]);

  const handleSave = useCallback(() => {
    if (!studyId) return;

    const payload: Record<string, any> = {
      id: studyId,
      comment: comment ?? study.comment ?? '',
      noOrder: noOrder ?? study.noOrder ?? false,
      emergency: emergency ?? study.emergency ?? false,
      studies: selectedStudies ?? study.studies ?? [],
      date: (date ?? (study.date ? new Date(study.date) : null))?.toISOString(),
      results: Object.entries(resultDrafts).map(([type, data]) => ({ type, data })),
    };

    fetcher.submit({ data: JSON.stringify(payload) }, { method: 'post' });
  }, [studyId, comment, noOrder, emergency, selectedStudies, date, study, resultDrafts, fetcher]);

  const handleResultDraftChange = useCallback(
    (type: string) => (data: StudyResultData) => {
      setResultDrafts(prev => ({
        ...prev,
        [type]: data,
      }));
    },
    []
  );

  const isDirty = isVerified && (metaDirty || Object.keys(resultDrafts).length > 0);
  const [fabOpen, { toggle: toggleFab, close: closeFab }] = useDisclosure(false);

  const handleFabPrint = useCallback(() => {
    closeFab();
    handlePrint();
  }, [closeFab, handlePrint]);

  const handleFabSave = useCallback(() => {
    if (!isDirty) return;
    closeFab();
    handleSave();
  }, [closeFab, isDirty, handleSave]);

  const { blocker, handleDiscard, handleCancel, handleSaveAndLeave } = useUnsavedGuard({
    isDirty,
    onSave: handleSave,
  });

  if (studyLoading || !study?.id) {
    return (
      <PageContainer>
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      </PageContainer>
    );
  }

  const isSavingMeta = fetcher.state !== 'idle';
  const currentStudies = selectedStudies || study.studies || [];
  const extractionDate = date ?? (study.date ? new Date(study.date) : null);
  const canEditResults = !!study.id && isVerified;

  return (
    <PageContainer>
      <Portal id="toolbar">
        <ToolbarTitle title={t('studies.study_title')} subTitle={`#${study.protocol}`} onBack={handleBack} />
      </Portal>

      {isDesktop && (
        <Portal id="form-actions">
          <Group>
            <Button variant="light" onClick={handlePrint} loading={isPrinting} leftSection={<Printer size={16} />}>
              {t('print_pdf.print')}
            </Button>
            <Button
              onClick={handleSave}
              loading={isSavingMeta}
              disabled={!isDirty || !isVerified}
              leftSection={<Save size={16} />}
            >
              {t('studies.save_changes')}
            </Button>
          </Group>
        </Portal>
      )}

      {!isDesktop && (
        <Fab open={fabOpen} onToggle={toggleFab} onClose={closeFab}>
          <FabItem onClick={handleFabPrint} index={1}>
            <Printer size={18} />
            {t('print_pdf.print')}
          </FabItem>
          <FabItem onClick={handleFabSave} index={0} disabled={!isDirty || !isVerified}>
            <Save size={18} />
            {t('studies.save_changes')}
          </FabItem>
        </Fab>
      )}

      <StudyMetadataForm
        mode="edit"
        studyTypeKeys={STUDY_TYPE_KEYS}
        selectedStudies={currentStudies}
        onToggleStudy={toggleStudy}
        noOrder={noOrder ?? study.noOrder ?? false}
        onNoOrderChange={value => {
          setNoOrder(value);
          setMetaDirty(true);
        }}
        emergency={emergency ?? study.emergency ?? false}
        onEmergencyChange={value => {
          setEmergency(value);
          setMetaDirty(true);
        }}
        comment={comment ?? study.comment ?? ''}
        onCommentChange={value => {
          setComment(value);
          setMetaDirty(true);
        }}
        date={extractionDate}
        dateReadOnly
        patient={patient}
        referringDoctor={study.referringDoctor ?? ''}
        readOnly={!isVerified}
      />

      {/* Results section */}
      {currentStudies.length > 0 && canEditResults && (
        <>
          <StyledTitle>{t('studies.results')}</StyledTitle>
          <Tabs defaultValue={currentStudies[0]} variant="pills">
            <Tabs.List mb="sm" bd="1px solid var(--mantine-color-gray-2)" bdrs={4}>
              {currentStudies.map((type: string) => {
                const schema = studySchemas[type];
                return (
                  <Tabs.Tab key={type} value={type}>
                    {schema?.label ?? type}
                  </Tabs.Tab>
                );
              })}
            </Tabs.List>

            {currentStudies.map((type: string) => {
              const schema = studySchemas[type];
              if (!schema) return null;

              const existingResult = results.find((r: any) => r.type === type);
              const resultData = existingResult?.data as StudyResultData | undefined;
              const draftData = resultDrafts[type];
              const initialResultData = draftData ?? resultData;

              return (
                <Tabs.Panel key={type} value={type}>
                  <StudyForm
                    schema={schema}
                    initialData={initialResultData}
                    onChange={handleResultDraftChange(type)}
                    readOnly={!isVerified}
                  />
                </Tabs.Panel>
              );
            })}
          </Tabs>
        </>
      )}
      <Modal opened={blocker.state === 'blocked'} onClose={handleCancel} title={t('common.unsaved_title')}>
        <Text mb="lg">{t('common.unsaved_body')}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={handleDiscard}>
            {t('common.discard')}
          </Button>
          <Button onClick={handleSaveAndLeave}>{t('common.save_and_leave')}</Button>
        </Group>
      </Modal>
    </PageContainer>
  );
}
