import { useCallback } from 'react';
import { Stack, Group, Button, NumberInput, Select, Title, Divider } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_I18N_KEYS = ['day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat', 'day_sun'] as const;

interface SireInitialTreatmentFormProps {
  onSubmit: (data: {
    treatment: Record<string, any>;
    reading: Record<string, any>;
    schedule: Record<string, any>;
    nextControlDate: string | null;
  }) => void;
  prefill?: { inr?: number; percentage?: number } | null;
}

export function SireInitialTreatmentForm({ onSubmit, prefill }: SireInitialTreatmentFormProps) {
  const { t } = useTranslation();

  const DAYS = DAY_KEYS.map((key, i) => ({ key, label: t(`sire.${DAY_I18N_KEYS[i]}`) }));

  const form = useForm({
    initialValues: {
      medication: 'Acenocumarol',
      tabletDoseMg: 4 as number,
      targetInrMin: 2.0 as number,
      targetInrMax: 3.0 as number,
      startDate: new Date(),
      // Initial reading
      inr: (prefill?.inr ?? '') as number | '',
      percentage: (prefill?.percentage ?? '') as number | '',
      // Dose schedule
      monday: '' as number | '',
      tuesday: '' as number | '',
      wednesday: '' as number | '',
      thursday: '' as number | '',
      friday: '' as number | '',
      saturday: '' as number | '',
      sunday: '' as number | '',
      nextControlDate: null as Date | null,
    },
    validate: {
      inr: value => (value === '' ? t('sire.inr_required') : null),
      percentage: value => (value === '' ? t('sire.percentage_required') : null),
      monday: value => (value === '' ? t('sire.field_required') : null),
      tuesday: value => (value === '' ? t('sire.field_required') : null),
      wednesday: value => (value === '' ? t('sire.field_required') : null),
      thursday: value => (value === '' ? t('sire.field_required') : null),
      friday: value => (value === '' ? t('sire.field_required') : null),
      saturday: value => (value === '' ? t('sire.field_required') : null),
      sunday: value => (value === '' ? t('sire.field_required') : null),
      nextControlDate: value => (value === null ? t('sire.next_control_required') : null),
    },
  });

  const handleSubmit = useCallback(() => {
    if (form.validate().hasErrors) return;

    const formatDate = (d: Date | string | null) => {
      if (!d) return null;
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return String(d);
    };
    const startDate = formatDate(form.values.startDate)!;

    const weekSchedule: Record<string, number | null> = {};
    for (const day of DAY_KEYS) {
      const val = form.values[day];
      weekSchedule[day] = val !== '' ? Number(val) : null;
    }

    onSubmit({
      treatment: {
        medication: form.values.medication,
        tabletDoseMg: form.values.tabletDoseMg,
        targetInrMin: form.values.targetInrMin,
        targetInrMax: form.values.targetInrMax,
        startDate,
        status: 'active',
      },
      reading: {
        date: startDate,
        inr: Number(form.values.inr),
        percentage: form.values.percentage !== '' ? Number(form.values.percentage) : null,
      },
      schedule: {
        startDate,
        schedule: weekSchedule,
      },
      nextControlDate: formatDate(form.values.nextControlDate),
    });
  }, [form, onSubmit]);

  return (
    <Stack gap="md">
      <Title order={5}>{t('sire.treatment')}</Title>

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

      <DateInput label={t('sire.start_date')} valueFormat="YYYY-MM-DD" {...form.getInputProps('startDate')} />

      <Divider />

      <Title order={5}>{t('sire.initial_control')}</Title>

      <Group grow>
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
        <NumberInput
          label={t('sire.percentage')}
          required
          min={0}
          max={200}
          step={1}
          decimalScale={0}
          placeholder={t('sire.placeholder_percentage')}
          {...form.getInputProps('percentage')}
        />
      </Group>

      <Divider />

      <Title order={5}>{t('sire.dose_schedule')}</Title>

      <Group grow>
        {DAYS.map(day => (
          <NumberInput
            key={day.key}
            label={day.label}
            min={0}
            max={4}
            step={0.25}
            decimalScale={2}
            placeholder="—"
            size="sm"
            {...form.getInputProps(day.key)}
          />
        ))}
      </Group>

      <Divider />

      <DateInput
        label={t('sire.next_control')}
        required
        valueFormat="YYYY-MM-DD"
        placeholder={t('sire.placeholder_no_date')}
        {...form.getInputProps('nextControlDate')}
      />

      <Button onClick={handleSubmit} fullWidth>
        {t('sire.start_treatment')}
      </Button>
    </Stack>
  );
}
