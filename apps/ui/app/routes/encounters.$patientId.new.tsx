import { useState, useCallback, useMemo } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Title, Stack, Center, Text } from '@mantine/core';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { styled } from '~/stitches';
import { EncounterForm } from '~/components/forms/encounter-form';
import NewEncounterSidebar from '~/components/new-encounter-sidebar';

const Container = styled('div', {
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  width: '100%',

  '@lg': {
    flexDirection: 'row',
  },
});

const Sidebar = styled('div', {
  background: 'white',
  borderRight: '1px solid var(--mantine-color-gray-1)',

  '@lg': {
    minHeight: 'calc(100vh - 5em)',
    minWidth: '300px',
  },
});

const Content = styled('div', {
  flex: 1,
  height: '100%',
  padding: '2rem',
});

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Nuevo Encuentro' }];
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { patientId } = params;

  if (!patientId) {
    throw new Response('Patient ID is required', { status: 400 });
  }

  const { client, user } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const data = JSON.parse(formData.get('data') as string);

  console.log(data);

  await client.service('encounters').create({
    patientId,
    medicId: user.id,
    date: new Date(),
    data,
  });

  return redirect(`/encounters/${patientId}`);
};

export const loader = authenticatedLoader(async ({ params, request }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const { patientId } = params;

  if (!patientId) {
    throw new Response('Patient ID is required', { status: 400 });
  }

  const patient = await client.service('patients').get(patientId);

  return {
    patient,
  };
});

const ALL_FORMS = [
  'general/consulta_internacion',
  'antecedentes/familiares',
  'antecedentes/personales',
  'general/evolucion_consulta_internacion',
];

export default function NewEncounter() {
  const { t } = useTranslation();
  const data = useLoaderData<typeof loader>();

  const { patient } = data;

  const [formValues, setFormValues] = useState<any>({});
  const [activeFormKey, setActiveFormKey] = useState<string | undefined>(undefined);

  const activeForms = useMemo(() => {
    return ALL_FORMS.filter(key => formValues[key] !== undefined);
  }, [formValues]);

  const availableForms = useMemo(() => {
    return ALL_FORMS.filter(key => formValues[key] === undefined);
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

  if (!data) {
    return null;
  }

  return (
    <Container className="encounters-container">
      <Portal id="toolbar">
        <Title order={2}>
          {t('encounters.new')}: {patient.personalData.firstName} {patient.personalData.lastName}
        </Title>
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
        {activeFormKey ? (
          <Stack key={activeFormKey}>
            <EncounterForm
              encounter={{ patientId: patient.id, data: formValues }}
              readOnly={false}
              activeFormKey={activeFormKey}
              onValuesChange={handleValuesChange}
            />
          </Stack>
        ) : (
          <Center style={{ height: '100%' }}>
            <Text color="dimmed">{t('encounters.select_form_instruction')}</Text>
          </Center>
        )}
      </Content>
    </Container>
  );
}
