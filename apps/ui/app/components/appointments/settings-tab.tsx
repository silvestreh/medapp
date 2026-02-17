import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
  Flex,
} from '@mantine/core';
import { TimePicker } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';

import { styled } from '~/styled-system/jsx';

type WeekdayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

type DaySettings = {
  start: string | null;
  end: string | null;
};

export interface MdSettingsRecord {
  id: string;
  userId: string;
  scheduleAllWeekCustomTime?: boolean | null;
  encounterDuration: number;
  mondayStart: string | null;
  mondayEnd: string | null;
  tuesdayStart: string | null;
  tuesdayEnd: string | null;
  wednesdayStart: string | null;
  wednesdayEnd: string | null;
  thursdayStart: string | null;
  thursdayEnd: string | null;
  fridayStart: string | null;
  fridayEnd: string | null;
  saturdayStart: string | null;
  saturdayEnd: string | null;
  sundayStart: string | null;
  sundayEnd: string | null;
}

export interface SettingsSavePayload {
  userId: string;
  scheduleAllWeekCustomTime: boolean;
  encounterDuration: number;
  mondayStart: string | null;
  mondayEnd: string | null;
  tuesdayStart: string | null;
  tuesdayEnd: string | null;
  wednesdayStart: string | null;
  wednesdayEnd: string | null;
  thursdayStart: string | null;
  thursdayEnd: string | null;
  fridayStart: string | null;
  fridayEnd: string | null;
  saturdayStart: string | null;
  saturdayEnd: string | null;
  sundayStart: string | null;
  sundayEnd: string | null;
}

type DayStartKey = `${WeekdayKey}Start`;
type DayEndKey = `${WeekdayKey}End`;

interface SettingsTabProps {
  medicId: string;
  initialSettings?: MdSettingsRecord | null;
  isSaving: boolean;
  onSave: (payload: SettingsSavePayload) => void;
}

const Footer = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'flex-end',
    pos: 'sticky',
    bottom: 0,
    w: '100%',
    py: 'md',
    borderTop: '1px solid var(--mantine-color-gray-2)',
    bg: 'white',

    lg: {
      bg: 'transparent',
      position: 'static',
      borderTop: 'none',
    },
  },
});

const dayOrder: WeekdayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const setDayRange = (payload: SettingsSavePayload, day: WeekdayKey, start: string | null, end: string | null) => {
  payload[`${day}Start` as DayStartKey] = start;
  payload[`${day}End` as DayEndKey] = end;
};

const formatTime = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.slice(0, 5);
};

const parseInitialSettings = (settings?: MdSettingsRecord | null) => {
  const daySettings: Record<WeekdayKey, DaySettings> = dayOrder.reduce(
    (acc, day) => ({
      ...acc,
      [day]: {
        start: formatTime(settings?.[`${day}Start` as keyof MdSettingsRecord] as string | null),
        end: formatTime(settings?.[`${day}End` as keyof MdSettingsRecord] as string | null),
      },
    }),
    {} as Record<WeekdayKey, DaySettings>
  );

  const hasDay = (day: WeekdayKey) => Boolean(daySettings[day].start || daySettings[day].end);
  const selectedDays = dayOrder.reduce(
    (acc, day) => ({
      ...acc,
      [day]: hasDay(day),
    }),
    {} as Record<WeekdayKey, boolean>
  );
  const selectedDayList = dayOrder.filter(day => selectedDays[day]);
  const firstActiveDay = selectedDayList[0] || 'monday';
  const defaultStart = daySettings[firstActiveDay].start || '09:00';
  const defaultEnd = daySettings[firstActiveDay].end || '17:00';
  const uniqueSelectedTimeRanges = new Set(
    selectedDayList.map(day => `${daySettings[day].start || ''}-${daySettings[day].end || ''}`)
  );
  const useDifferentTimes =
    typeof settings?.scheduleAllWeekCustomTime === 'boolean'
      ? settings.scheduleAllWeekCustomTime
      : uniqueSelectedTimeRanges.size > 1;

  return {
    useDifferentTimes,
    activeDay: firstActiveDay,
    encounterDuration: settings?.encounterDuration ?? 20,
    commonStart: defaultStart,
    commonEnd: defaultEnd,
    daySettings: dayOrder.reduce(
      (acc, day) => ({
        ...acc,
        [day]: {
          start: daySettings[day].start || defaultStart,
          end: daySettings[day].end || defaultEnd,
        },
      }),
      {} as Record<WeekdayKey, { start: string; end: string }>
    ),
    selectedDays,
  };
};

export function SettingsTab({ medicId, initialSettings, isSaving, onSave }: SettingsTabProps) {
  const { t } = useTranslation();
  const [useDifferentTimes, setUseDifferentTimes] = useState(false);
  const [activeDay, setActiveDay] = useState<WeekdayKey>('monday');
  const [encounterDuration, setEncounterDuration] = useState(20);
  const [commonStart, setCommonStart] = useState('09:00');
  const [commonEnd, setCommonEnd] = useState('17:00');
  const [selectedDays, setSelectedDays] = useState<Record<WeekdayKey, boolean>>({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  });
  const [daySettings, setDaySettings] = useState<Record<WeekdayKey, { start: string; end: string }>>({
    monday: { start: '09:00', end: '17:00' },
    tuesday: { start: '09:00', end: '17:00' },
    wednesday: { start: '09:00', end: '17:00' },
    thursday: { start: '09:00', end: '17:00' },
    friday: { start: '09:00', end: '17:00' },
    saturday: { start: '09:00', end: '17:00' },
    sunday: { start: '09:00', end: '17:00' },
  });

  useEffect(() => {
    const parsed = parseInitialSettings(initialSettings);
    console.log('[appointments/settings] loaded settings from DB', initialSettings);
    console.log('[appointments/settings] parsed initial UI state', parsed);
    setUseDifferentTimes(parsed.useDifferentTimes);
    setActiveDay(parsed.activeDay);
    setEncounterDuration(parsed.encounterDuration);
    setCommonStart(parsed.commonStart);
    setCommonEnd(parsed.commonEnd);
    setDaySettings(parsed.daySettings);
    setSelectedDays(parsed.selectedDays);
  }, [initialSettings]);

  useEffect(() => {
    console.log('[appointments/settings] state changed', {
      useDifferentTimes,
      activeDay,
      encounterDuration,
      commonStart,
      commonEnd,
      selectedDays,
      daySettings,
    });
  }, [useDifferentTimes, activeDay, encounterDuration, commonStart, commonEnd, selectedDays, daySettings]);

  const selectedCount = useMemo(() => Object.values(selectedDays).filter(Boolean).length, [selectedDays]);
  const selectedDayList = useMemo(() => dayOrder.filter(day => selectedDays[day]), [selectedDays]);
  const normalizedActiveDay = selectedDays[activeDay] ? activeDay : selectedDayList[0] || 'monday';

  const handleSave = () => {
    if (!medicId) {
      return;
    }

    if (!useDifferentTimes && (!commonStart || !commonEnd)) {
      showNotification({
        color: 'red',
        title: t('appointments.incomplete_schedule_title'),
        message: t('appointments.incomplete_schedule_message'),
      });
      return;
    }

    if (selectedCount === 0) {
      showNotification({
        color: 'red',
        title: t('appointments.no_days_selected_title'),
        message: t('appointments.no_days_selected_message'),
      });
      return;
    }

    const payload: SettingsSavePayload = {
      userId: medicId,
      scheduleAllWeekCustomTime: useDifferentTimes,
      encounterDuration: encounterDuration || 20,
      mondayStart: null,
      mondayEnd: null,
      tuesdayStart: null,
      tuesdayEnd: null,
      wednesdayStart: null,
      wednesdayEnd: null,
      thursdayStart: null,
      thursdayEnd: null,
      fridayStart: null,
      fridayEnd: null,
      saturdayStart: null,
      saturdayEnd: null,
      sundayStart: null,
      sundayEnd: null,
    };

    if (!useDifferentTimes) {
      dayOrder.forEach(day => {
        if (selectedDays[day]) {
          setDayRange(payload, day, commonStart, commonEnd);
          return;
        }

        setDayRange(payload, day, null, null);
      });
    }

    if (useDifferentTimes) {
      for (const day of dayOrder) {
        if (!selectedDays[day]) {
          setDayRange(payload, day, null, null);
          continue;
        }

        const start = daySettings[day].start;
        const end = daySettings[day].end;

        if (!start || !end) {
          showNotification({
            color: 'red',
            title: t('appointments.incomplete_schedule_title'),
            message: t(`appointments.complete_day_schedule_message`, { day: t(`appointments.day_${day}`) }),
          });
          return;
        }

        setDayRange(payload, day, start, end);
      }
    }

    console.log('[appointments/settings] payload before submit', payload);
    onSave(payload);
  };

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text fw={500}>{t('appointments.schedule_days_prompt')}</Text>
        <SimpleGrid cols={7}>
          {dayOrder.map(day => {
            const checked = selectedDays[day];

            return (
              <UnstyledButton
                key={day}
                onClick={() => {
                  const nextChecked = !checked;

                  setSelectedDays(current => ({ ...current, [day]: nextChecked }));

                  if (nextChecked) {
                    setActiveDay(day);

                    setDaySettings(current => {
                      const start = current[day].start || commonStart || '09:00';
                      const end = current[day].end || commonEnd || '17:00';
                      return {
                        ...current,
                        [day]: {
                          start,
                          end,
                        },
                      };
                    });
                    return;
                  }

                  if (activeDay === day) {
                    const nextActive = dayOrder.find(candidate => candidate !== day && selectedDays[candidate]);
                    if (nextActive) {
                      setActiveDay(nextActive);
                    }
                  }
                }}
                style={{
                  border: `1px solid ${checked ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-gray-4)'}`,
                  borderRadius: 8,
                  minHeight: 56,
                  width: '100%',
                  color: checked ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-6)',
                  backgroundColor: checked ? 'var(--mantine-color-blue-0)' : 'transparent',
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                {t(`appointments.day_short_${day}`)}
              </UnstyledButton>
            );
          })}
        </SimpleGrid>
      </Stack>

      {selectedCount > 1 && (
        <Checkbox
          checked={useDifferentTimes}
          onChange={event => {
            const checked = event.currentTarget.checked;
            setUseDifferentTimes(checked);

            if (!checked) {
              const sourceDay = selectedDayList[0];
              if (sourceDay) {
                const sourceStart = daySettings[sourceDay].start || '09:00';
                const sourceEnd = daySettings[sourceDay].end || '17:00';
                setCommonStart(sourceStart);
                setCommonEnd(sourceEnd);
              }
            }
          }}
          label={t('appointments.use_different_times_toggle')}
        />
      )}

      {!useDifferentTimes && (
        <Group grow>
          <TimePicker
            label={t('appointments.start_label')}
            min="00:00"
            max="23:59"
            value={commonStart}
            onChange={setCommonStart}
          />
          <TimePicker
            label={t('appointments.end_label')}
            min="00:00"
            max="23:59"
            value={commonEnd}
            onChange={setCommonEnd}
          />
        </Group>
      )}

      {useDifferentTimes && (
        <Flex gap="sm">
          <Stack gap="xs" pl="lg">
            {selectedDayList.map(day => {
              const isActive = normalizedActiveDay === day;

              return (
                <UnstyledButton
                  key={day}
                  onClick={() => setActiveDay(day)}
                  style={{
                    textAlign: 'right',
                    color: isActive ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-6)',
                    fontWeight: isActive ? 600 : 400,
                    textDecoration: isActive ? 'underline' : 'none',
                    cursor: 'pointer',
                    borderRadius: 8,
                    padding: '6px 8px',
                    backgroundColor: 'transparent',
                  }}
                >
                  {t(`appointments.day_${day}`)}
                </UnstyledButton>
              );
            })}
            {selectedDayList.length === 0 && <Text c="dimmed">{t('appointments.no_days_selected_message')}</Text>}
          </Stack>
          <Card withBorder flex={1}>
            <Stack gap="sm">
              <TimePicker
                label={t('appointments.start_label')}
                min="00:00"
                max="23:59"
                disabled={selectedDayList.length === 0 || !selectedDays[normalizedActiveDay]}
                value={daySettings[normalizedActiveDay].start}
                onChange={value => {
                  setDaySettings(current => ({
                    ...current,
                    [normalizedActiveDay]: { ...current[normalizedActiveDay], start: value },
                  }));
                }}
              />
              <TimePicker
                label={t('appointments.end_label')}
                min="00:00"
                max="23:59"
                disabled={selectedDayList.length === 0 || !selectedDays[normalizedActiveDay]}
                value={daySettings[normalizedActiveDay].end}
                onChange={value => {
                  setDaySettings(current => ({
                    ...current,
                    [normalizedActiveDay]: { ...current[normalizedActiveDay], end: value },
                  }));
                }}
              />
            </Stack>
          </Card>
        </Flex>
      )}

      <NumberInput
        label={t('appointments.encounter_duration_label')}
        min={10}
        max={60}
        step={5}
        value={encounterDuration}
        onChange={value => setEncounterDuration(Number(value) || 20)}
      />

      <Footer>
        <Button onClick={handleSave} loading={isSaving} size="lg">
          {t('common.save')}
        </Button>
      </Footer>
    </Stack>
  );
}
