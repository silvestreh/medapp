import { useCallback } from 'react';
import { Stack, Group, Button, NumberInput, TextInput, Textarea, Select } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';

interface SireTreatmentFormProps {
  patientId: string;
  initialData?: any;
  onSubmit: (data: Record<string, any>) => void;
}

export function SireTreatmentForm({ patientId, initialData, onSubmit }: SireTreatmentFormProps) {
  const { t } = useTranslation();

  const form = useForm({
    initialValues: {
      medication: initialData?.medication || 'Acenocumarol',
      tabletDoseMg: initialData?.tabletDoseMg || 4,
      targetInrMin: initialData?.targetInrMin || 2.0,
      targetInrMax: initialData?.targetInrMax || 3.0,
      indication: initialData?.indication || '',
      startDate: initialData?.startDate ? new Date(initialData.startDate) : new Date(),
      nextControlDate: initialData?.nextControlDate ? new Date(initialData.nextControlDate) : (null as Date | null),
      status: initialData?.status || 'active',
      notes: initialData?.notes || '',
    },
  });

  const handleSubmit = useCallback(() => {
    const formatDate = (d: Date | string | null) => (d instanceof Date ? d.toISOString().split('T')[0] : d);

    onSubmit({
      ...form.values,
      patientId,
      startDate: formatDate(form.values.startDate),
      nextControlDate: formatDate(form.values.nextControlDate),
    });
  }, [form.values, patientId, onSubmit]);

  return (
    <Stack gap="md">
      <Select
        label={t('sire.medication')}
        data={[
          { value: 'Acenocumarol', label: t('sire.med_acenocoumarol') },
          { value: 'Warfarina', label: t('sire.med_warfarin') },
          { value: 'Apixabán', label: t('sire.med_apixaban') },
          { value: 'Rivaroxabán', label: t('sire.med_rivaroxaban') },
          { value: 'Dabigatrán', label: t('sire.med_dabigatran') },
        ]}
        {...form.getInputProps('medication')}
      />

      <NumberInput
        label={t('sire.tablet_dose')}
        min={0.5}
        step={0.5}
        decimalScale={1}
        {...form.getInputProps('tabletDoseMg')}
      />

      <Group grow>
        <NumberInput
          label={t('sire.target_inr_min')}
          min={0.5}
          max={5}
          step={0.1}
          decimalScale={1}
          {...form.getInputProps('targetInrMin')}
        />
        <NumberInput
          label={t('sire.target_inr_max')}
          min={0.5}
          max={5}
          step={0.1}
          decimalScale={1}
          {...form.getInputProps('targetInrMax')}
        />
      </Group>

      <TextInput label={t('sire.indication')} placeholder={t('sire.placeholder_indication')} {...form.getInputProps('indication')} />

      <Group grow>
        <DateInput label={t('sire.start_date')} valueFormat="YYYY-MM-DD" {...form.getInputProps('startDate')} />
        <DateInput
          label={t('sire.next_control')}
          valueFormat="YYYY-MM-DD"
          clearable
          placeholder={t('sire.placeholder_no_date')}
          {...form.getInputProps('nextControlDate')}
        />
      </Group>

      <Textarea label={t('sire.notes')} autosize minRows={2} {...form.getInputProps('notes')} />

      <Button onClick={handleSubmit} fullWidth>
        {initialData ? t('sire.update_treatment') : t('sire.create_treatment')}
      </Button>
    </Stack>
  );
}
