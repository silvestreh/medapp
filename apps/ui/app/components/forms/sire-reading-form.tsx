import { useCallback } from 'react';
import { Stack, Group, Button, NumberInput, Select } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';

interface SireReadingFormProps {
  treatmentId: string;
  patientId: string;
  organizationId: string;
  onSubmit: (data: Record<string, any>) => void;
}

export function SireReadingForm({ treatmentId, patientId, organizationId, onSubmit }: SireReadingFormProps) {
  const { t } = useTranslation();

  const form = useForm({
    initialValues: {
      date: new Date(),
      inr: '' as number | '',
      quick: '' as number | '',
      percentage: '' as number | '',
      source: 'provider' as string,
    },
    validate: {
      inr: value => (value === '' ? t('sire.inr_required') : null),
    },
  });

  const handleSubmit = useCallback(() => {
    if (form.validate().hasErrors) return;

    onSubmit({
      treatmentId,
      patientId,
      organizationId,
      date: form.values.date instanceof Date ? form.values.date.toISOString().split('T')[0] : form.values.date,
      inr: Number(form.values.inr),
      quick: form.values.quick !== '' ? Number(form.values.quick) : null,
      percentage: form.values.percentage !== '' ? Number(form.values.percentage) : null,
      source: form.values.source,
    });
  }, [form, treatmentId, patientId, organizationId, onSubmit]);

  return (
    <Stack gap="md">
      <DateInput label={t('sire.reading_date')} valueFormat="YYYY-MM-DD" {...form.getInputProps('date')} />

      <NumberInput
        label={t('sire.inr')}
        required
        min={0}
        max={20}
        step={0.1}
        decimalScale={1}
        placeholder={t('sire.placeholder_inr')}
        {...form.getInputProps('inr')}
      />

      <Group grow>
        <NumberInput
          label={t('sire.quick_sec')}
          min={0}
          step={0.1}
          decimalScale={1}
          placeholder={t('sire.placeholder_quick')}
          {...form.getInputProps('quick')}
        />
        <NumberInput
          label={t('sire.percentage')}
          min={0}
          max={200}
          step={1}
          decimalScale={0}
          placeholder={t('sire.placeholder_percentage')}
          {...form.getInputProps('percentage')}
        />
      </Group>

      <Select
        label={t('sire.source')}
        data={[
          { value: 'provider', label: t('sire.source_provider') },
          { value: 'patient', label: t('sire.source_patient') },
          { value: 'lab', label: t('sire.source_lab') },
        ]}
        {...form.getInputProps('source')}
      />

      <Button onClick={handleSubmit} fullWidth>
        {t('sire.save_reading')}
      </Button>
    </Stack>
  );
}
