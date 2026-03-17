import { useEffect, useState, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
  setupNotificationCategories,
  configureNotificationHandler,
  setupAndroidChannel,
  requestPermissions,
  getNotificationsEnabled,
  setNotificationsEnabled,
  getReminderTime,
  setReminderTime,
  scheduleDoseReminders,
  cancelAllDoseReminders,
  scheduleSnooze,
} from '../notifications';
import type { SireDoseSchedule, SireTreatment } from '../types';

interface UseNotificationsReturn {
  enabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  loading: boolean;
  toggleEnabled: () => Promise<void>;
  updateReminderTime: (hour: number, minute: number) => Promise<void>;
}

export function useNotifications(
  treatment: SireTreatment | null,
  doseSchedule: SireDoseSchedule | null,
  onDoseAction?: (action: 'taken' | 'not-taken') => void,
): UseNotificationsReturn {
  const [enabled, setEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(9);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [loading, setLoading] = useState(true);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Initialize: load preferences, set up categories and handler
  useEffect(() => {
    async function init() {
      configureNotificationHandler();
      await setupAndroidChannel();
      await setupNotificationCategories();

      const [isEnabled, time] = await Promise.all([
        getNotificationsEnabled(),
        getReminderTime(),
      ]);
      setEnabled(isEnabled);
      setReminderHour(time.hour);
      setReminderMinute(time.minute);
      setLoading(false);
    }
    init();
  }, []);

  // Listen for notification action responses (taken / not-taken / snooze)
  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const actionId = response.actionIdentifier;
        const data = response.notification.request.content.data;

        if (actionId === 'taken') {
          onDoseAction?.('taken');
        } else if (actionId === 'not-taken') {
          onDoseAction?.('not-taken');
        } else if (actionId === 'snooze') {
          const medication = treatment?.medication ?? '';
          const dose = typeof data?.dose === 'number' ? data.dose : null;
          scheduleSnooze(medication, dose);
        }
      },
    );
    return () => {
      responseListener.current?.remove();
    };
  }, [treatment, onDoseAction]);

  // Re-schedule when schedule, treatment, time, or enabled state changes
  useEffect(() => {
    if (!enabled || !treatment || !doseSchedule) {
      cancelAllDoseReminders();
      return;
    }
    scheduleDoseReminders(
      doseSchedule.schedule,
      treatment.medication,
      reminderHour,
      reminderMinute,
    );
  }, [enabled, treatment, doseSchedule, reminderHour, reminderMinute]);

  const toggleEnabled = useCallback(async () => {
    if (!enabled) {
      const granted = await requestPermissions();
      if (!granted) return;
      await setNotificationsEnabled(true);
      setEnabled(true);
    } else {
      await setNotificationsEnabled(false);
      await cancelAllDoseReminders();
      setEnabled(false);
    }
  }, [enabled]);

  const updateReminderTime = useCallback(async (hour: number, minute: number) => {
    setReminderHour(hour);
    setReminderMinute(minute);
    await setReminderTime(hour, minute);
  }, []);

  return { enabled, reminderHour, reminderMinute, loading, toggleEnabled, updateReminderTime };
}
