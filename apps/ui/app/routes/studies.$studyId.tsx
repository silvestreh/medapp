import { useState, useCallback, useEffect } from 'react';
import type { ActionFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useFetcher, useNavigate, useParams } from '@remix-run/react';
import { Group, Button, Tabs, Text, Loader, Title, ActionIcon, Flex } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save } from 'lucide-react';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import { useGet } from '~/components/provider';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { studySchemas } from '~/components/forms/study-schemas';
import { StudyForm } from '~/components/forms/study-form';
import { StudyMetadataForm } from '~/components/forms/study-metadata-form';
import type { StudyResultData } from '~/components/forms/study-form-types';
import { StyledTitle } from '~/components/forms/styles';

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Estudio' }];
};

export const loader = authenticatedLoader();

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { studyId } = params;
  if (!studyId) throw new Response('Study ID is required', { status: 400 });

  const { client } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const payload = JSON.parse(formData.get('data') as string);

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
  const { t } = useTranslation();
  const { studyId } = useParams();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const { data: study, isLoading: studyLoading } = useGet('studies', studyId!);

  // Local draft state for result forms (saved through the unified study save action)
  const [resultDrafts, setResultDrafts] = useState<Record<string, StudyResultData>>({});

  // Local metadata state (initialized from study once loaded)
  const [metaDirty, setMetaDirty] = useState(false);
  const [comment, setComment] = useState<string | undefined>(undefined);
  const [noOrder, setNoOrder] = useState<boolean | undefined>(undefined);
  const [selectedStudies, setSelectedStudies] = useState<string[] | undefined>(undefined);
  const [date, setDate] = useState<Date | null | undefined>(undefined);

  // Initialize local state from study data once loaded
  if (study?.id && comment === undefined) {
    setComment(study.comment || '');
    setNoOrder(study.noOrder ?? false);
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
      studies: selectedStudies ?? study.studies ?? [],
      date: (date ?? (study.date ? new Date(study.date) : null))?.toISOString(),
      results: Object.entries(resultDrafts).map(([type, data]) => ({ type, data })),
    };

    fetcher.submit({ data: JSON.stringify(payload) }, { method: 'post' });
  }, [studyId, comment, noOrder, selectedStudies, date, study, resultDrafts, fetcher]);

  const handleResultDraftChange = useCallback(
    (type: string) => (data: StudyResultData) => {
      setResultDrafts(prev => ({
        ...prev,
        [type]: data,
      }));
    },
    []
  );

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
  const isDirty = metaDirty || Object.keys(resultDrafts).length > 0;
  const currentStudies = selectedStudies || study.studies || [];
  const extractionDate = date ?? (study.date ? new Date(study.date) : null);
  const canEditResults = !!study.id;

  return (
    <PageContainer>
      <Portal id="toolbar">
        <Group align="center" flex={1}>
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => navigate('/studies')}>
            <ArrowLeft size={20} />
          </ActionIcon>
          <Flex direction="column" gap={0}>
            <Title m={0} lh={1} fz="sm">
              {t('studies.study_title')}
            </Title>
            <Text c="dimmed" size="h4" fw={600}>
              #{study.protocol}
            </Text>
          </Flex>
        </Group>
      </Portal>

      <Portal id="form-actions">
        <Group>
          <Button onClick={handleSave} loading={isSavingMeta} disabled={!isDirty} leftSection={<Save size={16} />}>
            {t('studies.save_changes')}
          </Button>
        </Group>
      </Portal>

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
        comment={comment ?? study.comment ?? ''}
        onCommentChange={value => {
          setComment(value);
          setMetaDirty(true);
        }}
        date={extractionDate}
        dateReadOnly
        patient={patient}
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
                    readOnly={false}
                  />
                </Tabs.Panel>
              );
            })}
          </Tabs>
        </>
      )}
    </PageContainer>
  );
}
