import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const NOTIF_ENABLED_KEY = 'sire_notifications_enabled';
const NOTIF_HOUR_KEY = 'sire_notifications_hour';
const NOTIF_MINUTE_KEY = 'sire_notifications_minute';

export const DOSE_REMINDER_CATEGORY = 'dose-reminder';

// -- Notification categories with actions --

export async function setupNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(DOSE_REMINDER_CATEGORY, [
    {
      identifier: 'taken',
      buttonTitle: 'Tomado',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'not-taken',
      buttonTitle: 'No tomado',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'snooze',
      buttonTitle: 'Posponer 10 min',
      options: { opensAppToForeground: false },
    },
  ]);
}

// -- Default notification handler --

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
}

// -- Permissions --

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// -- Preference persistence --

export async function getNotificationsEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(NOTIF_ENABLED_KEY);
  return val === 'true';
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(NOTIF_ENABLED_KEY, String(enabled));
}

export async function getReminderTime(): Promise<{ hour: number; minute: number }> {
  const hour = await SecureStore.getItemAsync(NOTIF_HOUR_KEY);
  const minute = await SecureStore.getItemAsync(NOTIF_MINUTE_KEY);
  return { hour: hour ? Number(hour) : 9, minute: minute ? Number(minute) : 0 };
}

export async function setReminderTime(hour: number, minute: number): Promise<void> {
  await SecureStore.setItemAsync(NOTIF_HOUR_KEY, String(hour));
  await SecureStore.setItemAsync(NOTIF_MINUTE_KEY, String(minute));
}

// -- Scheduling --

export async function cancelAllDoseReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.categoryIdentifier === DOSE_REMINDER_CATEGORY) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

/**
 * Schedules 7 weekly repeating notifications (one per day) at the chosen time.
 * Each notification includes the expected dose for that day from the schedule.
 */
export async function scheduleDoseReminders(
  schedule: Record<string, number | null>,
  medication: string,
  hour: number,
  minute: number,
): Promise<void> {
  await cancelAllDoseReminders();

  const dayNames: Record<string, string> = {
    monday: 'lunes',
    tuesday: 'martes',
    wednesday: 'miércoles',
    thursday: 'jueves',
    friday: 'viernes',
    saturday: 'sábado',
    sunday: 'domingo',
  };

  // Expo weekday: 1=Sunday, 2=Monday, ..., 7=Saturday
  const dayToWeekday: Record<string, number> = {
    sunday: 1,
    monday: 2,
    tuesday: 3,
    wednesday: 4,
    thursday: 5,
    friday: 6,
    saturday: 7,
  };

  for (const [day, dose] of Object.entries(schedule)) {
    if (dose === null || dose === 0) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${medication} — ${doseLabel(dose)}`,
        body: `Es hora de tomar tu dosis del ${dayNames[day]}.`,
        categoryIdentifier: DOSE_REMINDER_CATEGORY,
        data: { day, dose, type: 'dose-reminder' },
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'dose-reminders' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: dayToWeekday[day],
        hour,
        minute,
      },
    });
  }
}

/**
 * Schedules a one-off snooze notification 10 minutes from now.
 */
export async function scheduleSnooze(medication: string, dose: number | null): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${medication} — ${doseLabel(dose)}`,
      body: 'Recordatorio pospuesto: es hora de tomar tu dosis.',
      categoryIdentifier: DOSE_REMINDER_CATEGORY,
      data: { type: 'dose-reminder-snooze' },
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: 'dose-reminders' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 600,
    },
  });
}

function doseLabel(dose: number | null): string {
  if (dose === null || dose === 0) return 'sin dosis';
  if (dose === 0.25) return '¼ comprimido';
  if (dose === 0.5) return '½ comprimido';
  if (dose === 0.75) return '¾ comprimido';
  if (dose === 1) return '1 comprimido';
  if (dose === 1.5) return '1½ comprimidos';
  return `${dose} comprimidos`;
}

// -- Android channel --

export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('dose-reminders', {
    name: 'Recordatorios de dosis',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}
