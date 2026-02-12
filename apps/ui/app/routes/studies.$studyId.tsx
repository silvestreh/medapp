import { useState, useCallback, useRef } from 'react';
import type { ActionFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useFetcher, useNavigate, useParams } from '@remix-run/react';
import { Group, Button, Checkbox, Tabs, Text, Loader } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import { useGet, useMutation } from '~/components/provider';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { studySchemas } from '~/components/forms/study-schemas';
import { StudyForm } from '~/components/forms/study-form';
import type { StudyResultData } from '~/components/forms/study-form-types';
import {
  FormCard,
  FieldRow,
  Label,
  StyledTextInput,
  StyledTextarea,
  StyledDateInput,
  StyledTitle,
} from '~/components/forms/styles';

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

const TypeGrid = styled('div', {
  base: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.75rem',

    sm: {
      gridTemplateColumns: '1fr 1fr',
    },

    lg: {
      gridTemplateColumns: '1fr 1fr 1fr',
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
  const resultsMutation = useMutation('study-results');

  const { data: study, isLoading: studyLoading } = useGet('studies', studyId!);

  // Debounce timer refs for auto-saving results
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  const handleSaveMeta = useCallback(() => {
    if (!studyId) return;

    const payload: Record<string, any> = {};
    if (comment !== undefined) payload.comment = comment;
    if (noOrder !== undefined) payload.noOrder = noOrder;
    if (selectedStudies !== undefined) payload.studies = selectedStudies;
    if (date !== undefined) payload.date = date?.toISOString();

    fetcher.submit({ data: JSON.stringify(payload) }, { method: 'post' });
    setMetaDirty(false);
  }, [studyId, comment, noOrder, selectedStudies, date, fetcher]);

  const handleResultChange = useCallback(
    (type: string, resultId: string | undefined) => (data: StudyResultData) => {
      // Clear existing timer for this type
      if (saveTimers.current[type]) {
        clearTimeout(saveTimers.current[type]);
      }

      // Debounce the save by 1 second
      saveTimers.current[type] = setTimeout(() => {
        if (resultId) {
          resultsMutation.patch(resultId, { data });
        } else if (studyId) {
          resultsMutation.create({ studyId, type, data });
        }
      }, 1000);
    },
    [studyId, resultsMutation]
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
  const currentStudies = selectedStudies || study.studies || [];

  return (
    <PageContainer>
      <Portal id="toolbar">
        <Group justify="space-between" align="center" w="100%">
          <Group gap="sm" align="baseline">
            <StyledTitle order={2}>{t('studies.study_title')}</StyledTitle>
            <Text c="dimmed" size="lg">
              #{study.protocol}
            </Text>
          </Group>
          <Button variant="subtle" onClick={() => navigate('/studies')}>
            {t('studies.back_to_list')}
          </Button>
        </Group>
      </Portal>

      {/* Metadata section */}
      <StyledTitle order={3}>{t('studies.study_data')}</StyledTitle>
      <FormCard>
        <FieldRow>
          <Label>{t('studies.patient')}</Label>
          <StyledTextInput
            value={patient ? `${patient.personalData?.firstName || ''} ${patient.personalData?.lastName || ''}` : '—'}
            readOnly
          />
        </FieldRow>
        <FieldRow>
          <Label>{t('studies.insurance')}</Label>
          <StyledTextInput value={patient?.medicare || '—'} readOnly />
        </FieldRow>
        <FieldRow>
          <Label>{t('studies.extraction_date')}</Label>
          <StyledDateInput
            value={date ?? (study.date ? new Date(study.date) : null)}
            onChange={v => {
              setDate(v ? new Date(v) : null);
              setMetaDirty(true);
            }}
            valueFormat="DD/MM/YYYY"
          />
        </FieldRow>
        <FieldRow>
          <Label>{t('studies.col_dni')}</Label>
          <StyledTextInput value={patient?.personalData?.documentValue || '—'} readOnly />
        </FieldRow>
        <FieldRow checkbox>
          <Checkbox
            label={t('studies.no_order')}
            checked={noOrder ?? study.noOrder ?? false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setNoOrder(e.currentTarget.checked);
              setMetaDirty(true);
            }}
            color="blue"
          />
        </FieldRow>
        <FieldRow>
          <Label>{t('studies.observations')}</Label>
          <StyledTextarea
            placeholder={t('studies.observations_placeholder')}
            value={comment ?? study.comment ?? ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              setComment(e.currentTarget.value);
              setMetaDirty(true);
            }}
            autosize
            minRows={2}
          />
        </FieldRow>
      </FormCard>

      {/* Study types */}
      <StyledTitle order={3}>{t('studies.requested_studies')}</StyledTitle>
      <FormCard>
        <FieldRow stacked>
          <TypeGrid>
            {STUDY_TYPE_KEYS.map(key => (
              <Checkbox
                key={key}
                label={t(`studies.type_${key}`)}
                checked={currentStudies.includes(key)}
                onChange={() => toggleStudy(key)}
                color="blue"
              />
            ))}
          </TypeGrid>
        </FieldRow>
      </FormCard>

      {metaDirty && (
        <Group justify="flex-end">
          <Button onClick={handleSaveMeta} loading={isSavingMeta} leftSection={<Save size={16} />}>
            {t('studies.save_changes')}
          </Button>
        </Group>
      )}

      {/* Results section */}
      {currentStudies.length > 0 && (
        <>
          <StyledTitle order={3}>{t('studies.results')}</StyledTitle>
          <FormCard>
            <Tabs defaultValue={currentStudies[0]}>
              <Tabs.List>
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

                return (
                  <Tabs.Panel key={type} value={type} pt="md">
                    <StudyForm
                      schema={schema}
                      initialData={resultData}
                      onChange={handleResultChange(type, existingResult?.id)}
                      readOnly={false}
                    />
                  </Tabs.Panel>
                );
              })}
            </Tabs>
          </FormCard>
        </>
      )}
    </PageContainer>
  );
}
