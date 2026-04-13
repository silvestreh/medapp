import { useCallback } from 'react';
import { Stack, Group, Button, NumberInput, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_FULL_I18N_KEYS = [
  'day_monday',
  'day_tuesday',
  'day_wednesday',
  'day_thursday',
  'day_friday',
  'day_saturday',
  'day_sunday',
] as const;

interface SireDoseFormProps {
  treatmentId: string;
  onSubmit: (data: Record<string, any>) => void;
}

export function SireDoseForm({ treatmentId, onSubmit }: SireDoseFormProps) {
  const { t } = useTranslation();

  const DAYS = DAY_KEYS.map((key, i) => ({ key, label: t(`sire.${DAY_FULL_I18N_KEYS[i]}`) }));

  const form = useForm({
    initialValues: {
      startDate: new Date(),
      monday: 0.5 as number | '',
      tuesday: 0.25 as number | '',
      wednesday: 0.5 as number | '',
      thursday: 0.25 as number | '',
      friday: 0.25 as number | '',
      saturday: 0.5 as number | '',
      sunday: '' as number | '',
      notes: '',
    },
  });

  const handleSubmit = useCallback(() => {
    const schedule: Record<string, number | null> = {};
    for (const day of DAY_KEYS) {
      const val = form.values[day];
      schedule[day] = val !== '' ? Number(val) : null;
    }

    onSubmit({
      treatmentId,
      startDate:
        form.values.startDate instanceof Date
          ? form.values.startDate.toISOString().split('T')[0]
          : form.values.startDate,
      schedule,
      notes: form.values.notes || null,
    });
  }, [form.values, treatmentId, onSubmit]);

  return (
    <Stack gap="md">
      <DateInput label={t('sire.start_date')} valueFormat="YYYY-MM-DD" {...form.getInputProps('startDate')} />

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

      <Textarea
        label={t('sire.notes')}
        autosize
        minRows={2}
        placeholder={t('sire.placeholder_schedule_observations')}
        {...form.getInputProps('notes')}
      />

      <Button onClick={handleSubmit} fullWidth>
        {t('sire.save_schedule')}
      </Button>
    </Stack>
  );
}
