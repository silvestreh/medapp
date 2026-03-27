import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate, useParams, Link } from '@remix-run/react';
import { Group, Button, Tabs, Text, Loader, Modal } from '@mantine/core';
import { useMediaQuery, useDisclosure, useHotkeys } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { PrinterIcon, FloppyDiskIcon, DropIcon } from '@phosphor-icons/react';

import { getCurrentOrganizationId } from '~/session';
import { parseFormJson } from '~/utils/parse-form-json';
import { useGet, useFind, useFeathers } from '~/components/provider';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { studySchemas } from '~/components/forms/study-schemas';
import { StudyForm } from '~/components/forms/study-form';
import { StudyMetadataForm } from '~/components/forms/study-metadata-form';
import type { StudyResultData } from '~/components/forms/study-form-types';
import { StyledTitle } from '~/components/forms/styles';
import { getPageTitle } from '~/utils/meta';
import { media } from '~/media';
import { printHtmlContent } from '~/utils/print-pdf';
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

  const { data: study, isLoading: studyLoading, mutate: mutateStudy } = useGet('studies', studyId!);
  const [isPrinting, setIsPrinting] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const handleBack = useCallback(() => navigate('/studies'), [navigate]);

  const handlePrint = useCallback(async () => {
    if (!client || !studyId || !study?.patientId) return;

    setIsPrinting(true);
    try {
      const result = await client.service('signed-exports' as any).create({
        patientId: study.patientId,
        studyId,
        content: 'studies',
        delivery: 'download',
        outputFormat: 'html',
        locale: i18n.language,
      });

      if (result.html) {
        printHtmlContent(result.html);
      }
    } catch {
      // silent — printing is best-effort
    } finally {
      setIsPrinting(false);
    }
  }, [client, studyId, study?.patientId, i18n.language]);

  // Local draft state for result forms (saved through the unified study save action)
  const [resultDrafts, setResultDrafts] = useState<Record<string, StudyResultData>>({});
  // Ref to keep drafts being saved (so we can update SWR cache after save succeeds)
  const pendingSaveDraftsRef = useRef<Record<string, StudyResultData>>({});

  // Local metadata state (initialized from study once loaded)
  const [metaDirty, setMetaDirty] = useState(false);
  const [comment, setComment] = useState<string | undefined>(undefined);
  const [noOrder, setNoOrder] = useState<boolean | undefined>(undefined);
  const [emergency, setEmergency] = useState<boolean | undefined>(undefined);
  const [selectedStudies, setSelectedStudies] = useState<string[] | undefined>(undefined);
  const [date, setDate] = useState<Date | null | undefined>(undefined);
  const [patientId, setPatientId] = useState<string | undefined>(undefined);
  const [referringDoctor, setReferringDoctor] = useState<string | undefined>(undefined);
  const [medicId, setMedicId] = useState<string | null | undefined>(undefined);

  // Initialize local state from study data once loaded
  if (study?.id && comment === undefined) {
    setComment(study.comment || '');
    setNoOrder(study.noOrder ?? false);
    setEmergency(study.emergency ?? false);
    setSelectedStudies(study.studies || []);
    setDate(study.date ? new Date(study.date) : new Date());
    setPatientId(study.patientId);
    setReferringDoctor(study.referringDoctor ?? '');
    setMedicId(study.medicId ?? null);
  }

  const results: any[] = study?.results || [];
  const isPatientChanged = !!patientId && patientId !== study?.patientId;
  const patientEditable = results.length === 0 && isVerified;

  // Fetch new patient data when patient is changed (same pattern as studies.new.tsx)
  const { data: fetchedPatient } = useGet('patients', patientId!, {
    enabled: !!patientId && isPatientChanged,
  });
  const patient = isPatientChanged && fetchedPatient ? fetchedPatient : study?.patient;

  const handlePatientChange = useCallback((newPatientId: string) => {
    setPatientId(newPatientId);
    setMetaDirty(true);
  }, []);

  const handleReferringDoctorChange = useCallback((value: string) => {
    setReferringDoctor(value);
    setMetaDirty(true);
  }, []);

  const handleMedicIdChange = useCallback((value: string | null) => {
    setMedicId(value);
    setMetaDirty(true);
  }, []);

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
      // Optimistically update SWR cache with saved results so navigating
      // away and back shows fresh data instead of stale cached values.
      const savedDrafts = pendingSaveDraftsRef.current;
      if (Object.keys(savedDrafts).length > 0) {
        mutateStudy((currentStudy: any) => {
          if (!currentStudy) return currentStudy;
          const updatedResults = [...(currentStudy.results || [])];
          for (const [type, data] of Object.entries(savedDrafts)) {
            const idx = updatedResults.findIndex((r: any) => r.type === type);
            if (idx >= 0) {
              updatedResults[idx] = { ...updatedResults[idx], data };
            } else {
              updatedResults.push({ type, data });
            }
          }
          return { ...currentStudy, results: updatedResults };
        }, { revalidate: true });
        pendingSaveDraftsRef.current = {};
      }
      setMetaDirty(false);
      setResultDrafts({});
    }
  }, [fetcher.state, fetcher.data, mutateStudy]);

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

    // Include patientId and insurerId when patient was reassigned
    if (isPatientChanged) {
      payload.patientId = patientId;
      payload.insurerId = (patient as any)?.medicareId || null;
    }

    // Include referring doctor if changed
    const currentReferringDoctor = referringDoctor ?? study.referringDoctor ?? '';
    const currentMedicId = medicId !== undefined ? medicId : (study.medicId ?? null);
    if (currentMedicId) {
      payload.medicId = currentMedicId;
    } else {
      payload.referringDoctor = currentReferringDoctor || undefined;
      payload.medicId = null;
    }

    pendingSaveDraftsRef.current = { ...resultDrafts };
    fetcher.submit({ data: JSON.stringify(payload) }, { method: 'post' });
  }, [
    studyId,
    comment,
    noOrder,
    emergency,
    selectedStudies,
    date,
    study,
    resultDrafts,
    fetcher,
    isPatientChanged,
    patientId,
    patient,
    referringDoctor,
    medicId,
  ]);

  const handleResultDraftChange = useCallback(
    (type: string) => (data: StudyResultData) => {
      setResultDrafts(prev => ({
        ...prev,
        [type]: data,
      }));
    },
    []
  );

  useHotkeys([['mod+S', handleSave]], []);

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

  // SIRE integration: fetch active treatment for this patient (must be before early return)
  // Use a ref to keep the latest anticoag values across save cycles (drafts get cleared on save
  // before the server data is refetched, which would briefly lose the values).
  const anticoagResult = results.find((r: any) => r.type === 'anticoagulation');
  const anticoagData = resultDrafts['anticoagulation'] ?? anticoagResult?.data;
  const latestAnticoagRef = useRef(anticoagData);
  if (anticoagData && (anticoagData.rin || anticoagData.complex_2_7_9_10)) {
    latestAnticoagRef.current = anticoagData;
  }
  const sireAnticoagData = latestAnticoagRef.current;
  const hasAnticoagDataForFetch = !!sireAnticoagData && !!(sireAnticoagData.rin || sireAnticoagData.complex_2_7_9_10);

  const { response: sireTreatments } = useFind(
    'sire-treatments',
    { patientId: study?.patientId, status: 'active', $limit: 1 },
    { enabled: !!study?.patientId && hasAnticoagDataForFetch }
  );

  const isSavingMeta = fetcher.state !== 'idle';
  const currentStudies = selectedStudies || study.studies || [];
  const extractionDate = date ?? (study.date ? new Date(study.date) : null);
  const canEditResults = !!study.id && isVerified;

  // SIRE integration: build link when anticoagulation result has data
  const effectiveTab = activeTab ?? currentStudies[0];
  const hasAnticoagData = hasAnticoagDataForFetch;
  const hasActiveSireTreatment = Array.isArray(sireTreatments)
    ? sireTreatments.length > 0
    : ((sireTreatments as any)?.data?.length ?? 0) > 0;

  const sireLink = useMemo(() => {
    if (!study?.patientId || !hasAnticoagData) return null;
    const params = new URLSearchParams();
    params.set('intent', hasActiveSireTreatment ? 'new-control' : 'new-treatment');
    const rin = sireAnticoagData.rin;
    const pct = sireAnticoagData.complex_2_7_9_10;
    const rinVal = typeof rin === 'object' ? rin?.value : rin;
    const pctVal = typeof pct === 'object' ? pct?.value : pct;
    if (rinVal) params.set('inr', String(rinVal));
    if (pctVal) params.set('percentage', String(pctVal));
    params.set('callbackUrl', `/studies/${studyId}`);
    return `/patients/${study.patientId}/sire?${params.toString()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study?.patientId, studyId, hasAnticoagData, hasActiveSireTreatment, anticoagData]);

  if (studyLoading || !study?.id) {
    return (
      <PageContainer>
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Portal id="toolbar">
        <ToolbarTitle title={t('studies.study_title')} subTitle={`#${study.protocol}`} onBack={handleBack} />
      </Portal>

      {isDesktop && (
        <Portal id="form-actions">
          <Group>
            {sireLink && (
              <Button component={Link} to={sireLink} variant="light" color="teal" leftSection={<DropIcon size={16} />}>
                {t('studies.send_to_sire')}
              </Button>
            )}
            <Button variant="light" onClick={handlePrint} loading={isPrinting} leftSection={<PrinterIcon size={16} />}>
              {t('print_pdf.print')}
            </Button>
            <Button
              onClick={handleSave}
              loading={isSavingMeta}
              disabled={!isDirty || !isVerified}
              leftSection={<FloppyDiskIcon size={16} />}
            >
              {t('studies.save_changes')}
            </Button>
          </Group>
        </Portal>
      )}

      {!isDesktop && (
        <Fab open={fabOpen} onToggle={toggleFab} onClose={closeFab}>
          {sireLink && (
            <FabItem onClick={() => navigate(sireLink)} index={2}>
              <DropIcon size={18} />
              {t('studies.send_to_sire')}
            </FabItem>
          )}
          <FabItem onClick={handleFabPrint} index={1}>
            <PrinterIcon size={18} />
            {t('print_pdf.print')}
          </FabItem>
          <FabItem onClick={handleFabSave} index={0} disabled={!isDirty || !isVerified}>
            <FloppyDiskIcon size={18} />
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
        patientEditable={patientEditable}
        onPatientChange={handlePatientChange}
        referringDoctor={referringDoctor ?? study.referringDoctor ?? ''}
        onReferringDoctorChange={handleReferringDoctorChange}
        onMedicIdChange={handleMedicIdChange}
        readOnly={!isVerified}
      />

      {/* Results section */}
      {currentStudies.length > 0 && canEditResults && (
        <>
          <StyledTitle>{t('studies.results')}</StyledTitle>
          <Tabs value={effectiveTab} onChange={setActiveTab} variant="pills" keepMounted>
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
