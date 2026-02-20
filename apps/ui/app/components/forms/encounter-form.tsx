import { Button, Stack, ActionIcon, Group, Box } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { Form, useSubmit } from '@remix-run/react';
import { useCallback, useMemo } from 'react';
import { Save } from 'lucide-react';

import { EncounterSchemaForm } from './encounter-schema-form';
import { encounterForms } from './encounter-schemas';
import { FormContainer } from './styles';
import Portal from '~/components/portal';

interface EncounterFormProps {
  encounter: any;
  readOnly?: boolean;
  activeFormKey?: string;
  onValuesChange?: (values: any) => void;
}

const FORM_KEY_ORDER = [
  'general/consulta_internacion',
  'general/enfermedad_actual',
  'antecedentes/familiares',
  'antecedentes/habitacionales',
  'antecedentes/personales',
  'antecedentes/habitos',
  'antecedentes/medicamentosos',
  'antecedentes/ocupacionales',
  'alergias/general',
  'alergias/medicamentos',
  'alergias/asma',
  'cardiologia/general',
  'general/evolucion_consulta_internacion',
];

const isDataEmpty = (data: any): boolean => {
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return true;

  return Object.values(data).every((form: any) => {
    if (!form || !form.values || typeof form.values !== 'object') return true;

    return Object.values(form.values).every((val: any) => {
      if (Array.isArray(val)) {
        return val.every(v => !v || (typeof v === 'string' && v.trim() === ''));
      }
      if (typeof val === 'string') {
        return val.trim() === '';
      }
      return !val;
    });
  });
};

export function EncounterForm({ encounter, readOnly, activeFormKey, onValuesChange }: EncounterFormProps) {
  const { t } = useTranslation();
  const submit = useSubmit();

  const form = useForm({
    initialValues: encounter.data || {},
  });

  const isEmpty = useMemo(() => isDataEmpty(form.values), [form.values]);

  const handleSubFormChange = useCallback(
    (formKey: string) => (data: any) => {
      const newValues = {
        ...form.values,
        [formKey]: data,
      };
      form.setValues(newValues);
      onValuesChange?.(newValues);
    },
    [form, onValuesChange]
  );

  const shouldShow = useCallback(
    (formKey: string) => {
      if (!activeFormKey) return true;
      return activeFormKey === formKey;
    },
    [activeFormKey]
  );

  const handleSave = useCallback(() => {
    if (isEmpty) return;
    submit({ data: JSON.stringify(form.values) }, { method: 'post' });
  }, [form.values, submit, isEmpty]);

  return (
    <Form method="post" id="encounter-form">
      <input type="hidden" name="patientId" value={encounter.patientId} />
      <input type="hidden" name="data" value={JSON.stringify(form.values)} />

      <FormContainer>
        <Stack gap="xl">
          {FORM_KEY_ORDER.map(formKey => {
            if (!shouldShow(formKey)) return null;

            const def = encounterForms[formKey];
            if (!def) return null;

            return (
              <EncounterSchemaForm
                key={formKey}
                schema={def.schema}
                adapter={def.adapter}
                initialData={form.values[formKey]}
                onChange={handleSubFormChange(formKey)}
                readOnly={readOnly}
              />
            );
          })}

          {!readOnly && (
            <Portal id="form-actions">
              <Group>
                <Box visibleFrom="lg">
                  <Button onClick={handleSave} disabled={isEmpty} leftSection={<Save size={16} />} color="green">
                    {t('common.save')}
                  </Button>
                </Box>
                <Box hiddenFrom="lg">
                  <ActionIcon onClick={handleSave} disabled={isEmpty} size="lg" radius="xl" color="green">
                    <Save size={20} />
                  </ActionIcon>
                </Box>
              </Group>
            </Portal>
          )}
        </Stack>
      </FormContainer>
    </Form>
  );
}
