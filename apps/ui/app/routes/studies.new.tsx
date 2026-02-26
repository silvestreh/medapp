import { useState, useCallback, useMemo, useEffect } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate } from '@remix-run/react';
import { Group, Button, NumberInput, Paper } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';

import { getAuthenticatedClient, authenticatedLoader, isMedicVerified } from '~/utils/auth.server';
import { parseFormJson } from '~/utils/parse-form-json';
import { useGet } from '~/components/provider';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { StudyMetadataForm } from '~/components/forms/study-metadata-form';
import { getPageTitle } from '~/utils/meta';
import { ToolbarTitle } from '~/components/toolbar-title';
import { normalizeInsurerPrices, resolveStudyCost, toNumericPrice } from '~/utils/accounting';

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'new_study') }];
};

export const loader = authenticatedLoader(async ({ request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const verified = await isMedicVerified(client, String((user as any).id), (user as any).roleId);

  if (!verified) {
    throw redirect('/studies');
  }

  const settingsResponse = await client.service('md-settings').find({
    query: { userId: user.id, $limit: 1 },
    paginate: false,
  });

  const settingsList = Array.isArray(settingsResponse)
    ? settingsResponse
    : ((settingsResponse as { data?: unknown[] }).data ?? []);
  const mdSettings = settingsList[0] as { insurerPrices?: unknown } | undefined;

  return json({
    insurerPrices: normalizeInsurerPrices(mdSettings?.insurerPrices),
  });
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const verified = await isMedicVerified(client, String((user as any).id), (user as any).roleId);
  if (!verified) {
    return redirect('/studies');
  }

  const formData = await request.formData();
  const payload = parseFormJson<Record<string, any>>(formData.get('data'));

  const study = await client.service('studies').create(payload);

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
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [patientId, setPatientId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(new Date());
  const [referringDoctor, setReferringDoctor] = useState('');
  const [medicId, setMedicId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [noOrder, setNoOrder] = useState(false);
  const [selectedStudies, setSelectedStudies] = useState<string[]>([]);
  const [cost, setCost] = useState(0);
  const [costManuallyEdited, setCostManuallyEdited] = useState(false);

  const { data: patient } = useGet('patients', patientId!, { enabled: !!patientId });
  const insurerId = (patient as any)?.medicareId || null;

  const insurerPracticePrices = insurerId ? data.insurerPrices?.[insurerId] : undefined;

  useEffect(() => {
    if (!insurerId) {
      if (!costManuallyEdited) {
        setCost(0);
      }
      return;
    }

    if (!costManuallyEdited) {
      setCost(resolveStudyCost(selectedStudies, insurerPracticePrices));
    }
  }, [costManuallyEdited, insurerId, insurerPracticePrices, selectedStudies]);

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
      comment: comment || undefined,
      ...(medicId ? { medicId } : { referringDoctor: referringDoctor || undefined }),
      insurerId,
      results: [],
    };

    fetcher.submit({ data: JSON.stringify(payload) }, { method: 'post' });
  }, [canSave, patientId, date, selectedStudies, noOrder, comment, referringDoctor, medicId, insurerId, cost, fetcher]);

  const handleCostChange = useCallback((value: string | number) => {
    setCostManuallyEdited(true);
    setCost(toNumericPrice(value));
  }, []);

  return (
    <PageContainer>
      <Portal id="toolbar">
        <ToolbarTitle title={t('studies.new_study')} onBack={handleBack} />
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
        referringDoctor={referringDoctor}
        onReferringDoctorChange={setReferringDoctor}
        medicId={medicId}
        onMedicIdChange={setMedicId}
        showEmptyStudyHint
      />
      <Paper withBorder p="md">
        <NumberInput
          label={t('accounting.study_cost', { defaultValue: 'Study cost' })}
          decimalScale={2}
          min={0}
          fixedDecimalScale
          thousandSeparator=","
          value={cost}
          onChange={handleCostChange}
        />
      </Paper>
    </PageContainer>
  );
}
