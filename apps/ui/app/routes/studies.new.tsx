import { useState, useCallback } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { useFetcher, useNavigate } from '@remix-run/react';
import { Group, Button } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';

import {
  getAuthenticatedClient,
  authenticatedLoader,
  isMedicVerified,
  getCurrentOrgRoleIds,
} from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import { parseFormJson } from '~/utils/parse-form-json';
import { useGet } from '~/components/provider';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { StudyMetadataForm } from '~/components/forms/study-metadata-form';
import { getPageTitle } from '~/utils/meta';
import { ToolbarTitle } from '~/components/toolbar-title';
import { Fab } from '~/components/fab';
import { media } from '~/media';

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'new_study') }];
};

export const loader = authenticatedLoader(async ({ request }: LoaderFunctionArgs) => {
  const { user } = await getAuthenticatedClient(request);
  const orgId = await getCurrentOrganizationId(request);
  const orgRoleIds = getCurrentOrgRoleIds(user, orgId);
  const verified = isMedicVerified(user, orgRoleIds);

  if (!verified) {
    throw redirect('/studies');
  }

  return json({});
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const actionOrgId = await getCurrentOrganizationId(request);
  const actionOrgRoleIds = getCurrentOrgRoleIds(user, actionOrgId);
  const verified = isMedicVerified(user, actionOrgRoleIds);
  if (!verified) {
    return redirect('/studies');
  }

  const formData = await request.formData();
  const payload = parseFormJson<Record<string, any>>(formData.get('data'));

  await client.service('studies').create(payload);

  return redirect('/studies');
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
  const isDesktop = useMediaQuery(media.md);

  const [patientId, setPatientId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(new Date());
  const [referringDoctor, setReferringDoctor] = useState('');
  const [medicId, setMedicId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [noOrder, setNoOrder] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [selectedStudies, setSelectedStudies] = useState<string[]>([]);

  const { data: patient } = useGet('patients', patientId!, { enabled: !!patientId });
  const insurerId = (patient as any)?.medicareId || null;

  const toggleStudy = useCallback((key: string) => {
    setSelectedStudies(prev => (prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]));
  }, []);

  const canSave = patientId && selectedStudies.length > 0 && date;
  const isSaving = fetcher.state !== 'idle';

  const handleBack = useCallback(() => navigate('/studies'), [navigate]);

  const handleSave = useCallback(() => {
    if (!canSave) return;

    const payload = {
      patientId,
      date: date.toISOString(),
      studies: selectedStudies,
      noOrder,
      emergency,
      comment: comment || undefined,
      ...(medicId ? { medicId } : { referringDoctor: referringDoctor || undefined }),
      insurerId,
      results: [],
    };

    fetcher.submit({ data: JSON.stringify(payload) }, { method: 'post' });
  }, [
    canSave,
    patientId,
    date,
    selectedStudies,
    noOrder,
    emergency,
    comment,
    referringDoctor,
    medicId,
    insurerId,
    fetcher,
  ]);

  return (
    <PageContainer>
      <Portal id="toolbar">
        <ToolbarTitle title={t('studies.new_study')} onBack={handleBack} />
      </Portal>

      {isDesktop && (
        <Portal id="form-actions">
          <Group>
            <Button onClick={handleSave} disabled={!canSave} loading={isSaving} leftSection={<Save size={16} />}>
              {t('studies.save')}
            </Button>
          </Group>
        </Portal>
      )}

      {!isDesktop && <Fab icon={<Save size={22} />} onClick={handleSave} disabled={!canSave} />}

      <StudyMetadataForm
        mode="create"
        studyTypeKeys={STUDY_TYPE_KEYS}
        selectedStudies={selectedStudies}
        onToggleStudy={toggleStudy}
        noOrder={noOrder}
        onNoOrderChange={setNoOrder}
        emergency={emergency}
        onEmergencyChange={setEmergency}
        comment={comment}
        onCommentChange={setComment}
        date={date}
        onDateChange={setDate}
        patientId={patientId}
        onPatientChange={setPatientId}
        patient={patient as any}
        referringDoctor={referringDoctor}
        onReferringDoctorChange={setReferringDoctor}
        medicId={medicId}
        onMedicIdChange={setMedicId}
        showEmptyStudyHint
      />
    </PageContainer>
  );
}
