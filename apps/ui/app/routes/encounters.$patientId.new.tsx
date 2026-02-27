import { useState, useCallback, useMemo } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { useLoaderData, useNavigate } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Stack, Center, Text, NumberInput, Paper } from '@mantine/core';

import { getAuthenticatedClient, authenticatedLoader, isMedicVerified } from '~/utils/auth.server';
import { parseFormJson } from '~/utils/parse-form-json';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { EncounterForm } from '~/components/forms/encounter-form';
import NewEncounterSidebar from '~/components/new-encounter-sidebar';
import { EncounterAiChatPanel } from '~/components/encounter-ai-chat-panel';
import { getPageTitle } from '~/utils/meta';
import { ToolbarTitle } from '~/components/toolbar-title';
import { calculatePracticeCost, normalizeInsurerPrices, toNumericPrice } from '~/utils/accounting';

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
    borderRight: '1px solid var(--mantine-color-gray-1)',

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
  },
});

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'new_encounter') }];
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { patientId } = params;

  if (!patientId) {
    throw new Response('Patient ID is required', { status: 400 });
  }

  const { client, user } = await getAuthenticatedClient(request);
  const verified = await isMedicVerified(client, String((user as any).id), (user as any).roleId);
  if (!verified) {
    return redirect(`/encounters/${patientId}`);
  }

  const formData = await request.formData();
  const data = parseFormJson(formData.get('data'));
  const postedInsurerId = String(formData.get('insurerId') || '').trim();

  const patient = await client.service('patients').get(patientId);
  const insurerId = postedInsurerId || (patient as any).medicareId || null;

  await client.service('encounters').create({
    patientId,
    medicId: user.id,
    date: new Date(),
    data,
    insurerId,
  });

  return redirect(`/encounters/${patientId}`);
};

export const loader = authenticatedLoader(async ({ params, request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const { patientId } = params;

  if (!patientId) {
    throw new Response('Patient ID is required', { status: 400 });
  }

  const verified = await isMedicVerified(client, String((user as any).id), (user as any).roleId);
  if (!verified) {
    throw redirect(`/encounters/${patientId}`);
  }

  const patient = await client.service('patients').get(patientId);

  const acctSettingsResponse = await client.service('accounting-settings').find({
    query: { userId: user.id, $limit: 1 },
    paginate: false,
  });
  const acctSettingsList = Array.isArray(acctSettingsResponse)
    ? acctSettingsResponse
    : ((acctSettingsResponse as { data?: unknown[] }).data ?? []);
  const acctSettings = acctSettingsList[0] as { insurerPrices?: unknown } | undefined;
  const insurerPrices = normalizeInsurerPrices(acctSettings?.insurerPrices);
  const insurerId = (patient as any).medicareId || null;
  const defaultCost = insurerId ? calculatePracticeCost(insurerPrices[insurerId]?.encounter) : 0;

  return {
    patient,
    insurerId,
    defaultCost,
  };
});

const ALL_FORMS = [
  'general/consulta_internacion',
  null,
  'antecedentes/habitacionales',
  'antecedentes/familiares',
  'antecedentes/personales',
  'antecedentes/habitos',
  'antecedentes/medicamentosos',
  'antecedentes/ocupacionales',
  null,
  'alergias/general',
  'alergias/medicamentos',
  'alergias/asma',
  null,
  'cardiologia/general',
  null,
  'general/enfermedad_actual',
  'general/evolucion_consulta_internacion',
];

function cleanSeparators(list: (string | null)[]): (string | null)[] {
  return list
    .filter((item, i) => item !== null || list[i - 1] !== null) // no consecutive nulls
    .filter((item, i, arr) => item !== null || (i !== 0 && i !== arr.length - 1)); // no leading/trailing nulls
}

export default function NewEncounter() {
  const { t } = useTranslation();
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { patient } = data;
  const [formValues, setFormValues] = useState<any>({});
  const [activeFormKey, setActiveFormKey] = useState<string | undefined>(undefined);
  const [cost, setCost] = useState<number>(data.defaultCost ?? 0);

  const activeForms = useMemo(() => {
    const filtered = ALL_FORMS.filter(key => key === null || formValues[key] !== undefined);
    return cleanSeparators(filtered);
  }, [formValues]);

  const availableForms = useMemo(() => {
    const filtered = ALL_FORMS.filter(key => key === null || formValues[key] === undefined);
    return cleanSeparators(filtered);
  }, [formValues]);

  const handleFormClick = useCallback((formKey: string) => {
    setActiveFormKey(formKey);
  }, []);

  const handleValuesChange = useCallback((values: any) => {
    setFormValues(values);
  }, []);

  const handleRemoveForm = useCallback(
    (formKey: string) => {
      setFormValues((prev: any) => {
        const newValues = { ...prev };
        delete newValues[formKey];
        return newValues;
      });
      if (activeFormKey === formKey) {
        setActiveFormKey(undefined);
      }
    },
    [activeFormKey]
  );

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (!data) {
    return null;
  }

  return (
    <Container className="encounters-container">
      <Portal id="toolbar">
        <ToolbarTitle
          title={t('encounters.new')}
          subTitle={`${patient.personalData.firstName} ${patient.personalData.lastName}`}
          onBack={handleGoBack}
        />
      </Portal>

      <Sidebar>
        <NewEncounterSidebar
          availableForms={availableForms}
          activeForms={activeForms}
          activeFormKey={activeFormKey}
          onFormClick={handleFormClick}
          onRemoveForm={handleRemoveForm}
        />
      </Sidebar>

      <Content>
        <Stack key={activeFormKey ?? 'no-active-form'}>
          <Paper withBorder p="md">
            <NumberInput
              label={t('accounting.encounter_cost', { defaultValue: 'Encounter cost' })}
              value={cost}
              onChange={value => setCost(toNumericPrice(value))}
              min={0}
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
            />
          </Paper>
          {activeFormKey && (
            <EncounterForm
              encounter={{ patientId: patient.id, data: formValues }}
              readOnly={false}
              activeFormKey={activeFormKey}
              onValuesChange={handleValuesChange}
              cost={cost}
              insurerId={data.insurerId}
            />
          )}
          {!activeFormKey && (
            <Center style={{ height: '100%' }}>
              <Text color="dimmed">{t('encounters.select_form_instruction')}</Text>
            </Center>
          )}
        </Stack>
        <EncounterAiChatPanel patientId={String(patient.id)} encounterDraft={formValues} />
      </Content>
    </Container>
  );
}
