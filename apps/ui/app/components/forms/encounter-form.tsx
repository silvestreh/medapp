import { Button, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { Form } from '@remix-run/react';
import { useCallback } from 'react';

import { ReasonForConsultationForm } from '~/components/forms/reason-for-consultation-form';
import { FamilyHistoryForm } from '~/components/forms/family-history-form';
import { PersonalHistoryForm } from '~/components/forms/personal-history-form';
import { EvolutionForm } from '~/components/forms/evolution-form';
import { FormContainer } from '~/components/forms/styles';
import Portal from '~/components/portal';

interface EncounterFormProps {
  encounter: any;
  readOnly?: boolean;
  activeFormKey?: string;
  onValuesChange?: (values: any) => void;
}

export function EncounterForm({ encounter, readOnly, activeFormKey, onValuesChange }: EncounterFormProps) {
  const { t } = useTranslation();

  // We use Mantine form to manage the aggregate state of all sub-forms
  const form = useForm({
    initialValues: encounter.data || {},
  });

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

  return (
    <Form method="post">
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

          {shouldShow('general/evolucion_consulta_internacion') && (
            <EvolutionForm
              initialData={form.values['general/evolucion_consulta_internacion']}
              onChange={handleSubFormChange('general/evolucion_consulta_internacion')}
              readOnly={readOnly}
            />
          )}

          {!readOnly && (
            <Portal id="form-actions">
              <Button type="submit">{t('common.save')}</Button>
            </Portal>
          )}
        </Stack>
      </FormContainer>
    </Form>
  );
}
