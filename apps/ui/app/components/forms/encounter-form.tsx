import { Button, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { Form, useSubmit } from '@remix-run/react';
import { useCallback, useMemo } from 'react';

import { ReasonForConsultationForm } from '~/components/forms/reason-for-consultation-form';
import { FamilyHistoryForm } from '~/components/forms/family-history-form';
import { PersonalHistoryForm } from '~/components/forms/personal-history-form';
import { EvolutionForm } from '~/components/forms/evolution-form';
import { HabitsForm } from '~/components/forms/habits-form';
import { FormContainer } from '~/components/forms/styles';
import Portal from '~/components/portal';

interface EncounterFormProps {
  encounter: any;
  readOnly?: boolean;
  activeFormKey?: string;
  onValuesChange?: (values: any) => void;
}

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

  // We use Mantine form to manage the aggregate state of all sub-forms
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

  const shouldShow = (formKey: string) => {
    if (!activeFormKey) return true;
    return activeFormKey === formKey;
  };

  const handleSave = useCallback(() => {
    if (isEmpty) return;
    submit({ data: JSON.stringify(form.values) }, { method: 'post' });
  }, [form.values, submit, isEmpty]);

  return (
    <Form method="post" id="encounter-form">
      {/* Hidden inputs to pass the aggregate data to the Remix action */}
      <input type="hidden" name="patientId" value={encounter.patientId} />
      <input type="hidden" name="data" value={JSON.stringify(form.values)} />

      <FormContainer>
        <Stack gap="xl">
          {shouldShow('general/consulta_internacion') && (
            <ReasonForConsultationForm
              initialData={form.values['general/consulta_internacion']}
              onChange={handleSubFormChange('general/consulta_internacion')}
              readOnly={readOnly}
            />
          )}

          {shouldShow('antecedentes/familiares') && (
            <FamilyHistoryForm
              initialData={form.values['antecedentes/familiares']}
              onChange={handleSubFormChange('antecedentes/familiares')}
              readOnly={readOnly}
            />
          )}

          {shouldShow('antecedentes/personales') && (
            <PersonalHistoryForm
              initialData={form.values['antecedentes/personales']}
              onChange={handleSubFormChange('antecedentes/personales')}
              readOnly={readOnly}
            />
          )}

          {shouldShow('antecedentes/habitos') && (
            <HabitsForm
              initialData={form.values['antecedentes/habitos']}
              onChange={handleSubFormChange('antecedentes/habitos')}
              readOnly={readOnly}
            />
          )}

          {shouldShow('general/evolucion_consulta_internacion') && (
            <EvolutionForm
              initialData={form.values['general/evolucion_consulta_internacion']}
              onChange={handleSubFormChange('general/evolucion_consulta_internacion')}
              readOnly={readOnly}
            />
          )}

          {!readOnly && (
            <Portal id="form-actions">
              <Button onClick={handleSave} disabled={isEmpty}>
                {t('common.save')}
              </Button>
            </Portal>
          )}
        </Stack>
      </FormContainer>
    </Form>
  );
}
