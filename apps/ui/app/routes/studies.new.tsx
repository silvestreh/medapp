import { useState, useCallback } from 'react';
import type { ActionFunctionArgs, MetaFunction } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { useFetcher, useNavigate } from '@remix-run/react';
import { Group, Button, ActionIcon, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Save, ArrowLeft } from 'lucide-react';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import { useGet } from '~/components/provider';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { StudyMetadataForm } from '~/components/forms/study-metadata-form';

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Nuevo Estudio' }];
};

export const loader = authenticatedLoader();

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const payload = JSON.parse(formData.get('data') as string);

  const study = await client.service('studies').create({
    ...payload,
    medicId: user.id,
  });

  return redirect(`/studies/${study.id}`);
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

export default function NewStudy() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [patientId, setPatientId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(new Date());
  const [medic, setMedic] = useState('');
  const [comment, setComment] = useState('');
  const [noOrder, setNoOrder] = useState(false);
  const [selectedStudies, setSelectedStudies] = useState<string[]>([]);

  const { data: patient } = useGet('patients', patientId!, { enabled: !!patientId });

  const toggleStudy = useCallback((key: string) => {
    setSelectedStudies(prev => (prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]));
  }, []);

  const canSave = patientId && selectedStudies.length > 0 && date;
  const isSaving = fetcher.state !== 'idle';

  const handleSave = useCallback(() => {
    if (!canSave) return;

    const payload = {
      patientId,
      date: date.toISOString(),
      studies: selectedStudies,
      noOrder,
      comment: comment || undefined,
      results: [],
    };

    fetcher.submit({ data: JSON.stringify(payload) }, { method: 'post' });
  }, [canSave, patientId, date, selectedStudies, noOrder, comment, fetcher]);

  return (
    <PageContainer>
      <Portal id="toolbar">
        <Group align="center" flex={1}>
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => navigate('/studies')}>
            <ArrowLeft size={20} />
          </ActionIcon>
          <Title m={0} lh={1} fz="h2">
            {t('studies.new_study')}
          </Title>
        </Group>
      </Portal>

      <Portal id="form-actions">
        <Group>
          <Button onClick={handleSave} disabled={!canSave} loading={isSaving} leftSection={<Save size={16} />}>
            {t('studies.save')}
          </Button>
        </Group>
      </Portal>

      <StudyMetadataForm
        mode="create"
        studyTypeKeys={STUDY_TYPE_KEYS}
        selectedStudies={selectedStudies}
        onToggleStudy={toggleStudy}
        noOrder={noOrder}
        onNoOrderChange={setNoOrder}
        comment={comment}
        onCommentChange={setComment}
        date={date}
        onDateChange={setDate}
        patientId={patientId}
        onPatientChange={setPatientId}
        patient={patient as any}
        referringDoctor={medic}
        onReferringDoctorChange={setMedic}
        showEmptyStudyHint
      />
    </PageContainer>
  );
}
