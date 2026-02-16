import { useEffect } from 'react';
import { Drawer, Tabs, Title } from '@mantine/core';
import '@mantine/dates/styles.css';
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import {
  useActionData,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
  useParams,
  useSubmit,
} from '@remix-run/react';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { showNotification } from '@mantine/notifications';

import { media } from '~/media';
import { getAuthenticatedClient } from '~/utils/auth.server';
import { SettingsTab, type MdSettingsRecord, type SettingsSavePayload } from '~/components/appointments/settings-tab';
import { TimeOffTab, type TimeOffEvent } from '~/components/appointments/time-off-tab';

type ActionData = {
  ok: boolean;
  intent: 'save-settings' | 'create-time-off' | 'remove-time-off' | 'unknown';
  error?: string;
};

const normalizeArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === 'object' && 'data' in value) {
    const data = (value as { data?: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }

  return [];
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const medicId = params.medicId as string | undefined;

  if (!medicId) {
    return json({ medicId: '', settingsRecord: null, timeOffEvents: [] as TimeOffEvent[] });
  }

  const mdSettingsResponse = await client.service('md-settings').find({
    query: { userId: medicId },
    paginate: false,
  });
  const timeOffResponse = await client.service('time-off-events').find({
    query: { medicId },
    paginate: false,
  });

  const settingsRecord = normalizeArray<MdSettingsRecord>(mdSettingsResponse)[0] ?? null;
  const timeOffEvents = normalizeArray<TimeOffEvent>(timeOffResponse);

  console.log('[appointments/settings loader] medic settings', {
    medicId,
    settingsRecord,
    timeOffCount: timeOffEvents.length,
  });

  return json({ medicId, settingsRecord, timeOffEvents });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const medicId = params.medicId as string | undefined;
  const formData = await request.formData();
  const intent = String(formData.get('_intent') || 'unknown') as ActionData['intent'];

  try {
    if (!medicId) {
      return json<ActionData>({ ok: false, intent, error: 'Missing medicId' }, { status: 400 });
    }

    if (intent === 'save-settings') {
      const rawPayload = String(formData.get('payload') || '{}');
      const payload = JSON.parse(rawPayload) as SettingsSavePayload;
      const settingsResponse = await client.service('md-settings').find({
        query: { userId: medicId },
        paginate: false,
      });
      const settingsRecord = normalizeArray<MdSettingsRecord>(settingsResponse)[0] ?? null;

      if (settingsRecord?.id) {
        await client.service('md-settings').patch(settingsRecord.id, payload);
      } else {
        await client.service('md-settings').create(payload);
      }

      return json<ActionData>({ ok: true, intent });
    }

    if (intent === 'create-time-off') {
      const rawPayload = String(formData.get('payload') || '{}');
      const payload = JSON.parse(rawPayload) as {
        startDate: string;
        endDate: string;
        type: 'vacation' | 'cancelDay' | 'other';
      };

      await client.service('time-off-events').create({
        medicId,
        startDate: payload.startDate,
        endDate: payload.endDate,
        type: payload.type,
      });

      return json<ActionData>({ ok: true, intent });
    }

    if (intent === 'remove-time-off') {
      const id = String(formData.get('id') || '');
      if (!id) {
        return json<ActionData>({ ok: false, intent, error: 'Missing event id' }, { status: 400 });
      }

      await client.service('time-off-events').remove(id);
      return json<ActionData>({ ok: true, intent });
    }

    return json<ActionData>({ ok: false, intent, error: 'Unknown intent' }, { status: 400 });
  } catch (error: any) {
    return json<ActionData>({ ok: false, intent, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
};

const AppointmentsSettings = () => {
  const { t } = useTranslation();
  const { medicId: medicIdFromLoader, settingsRecord, timeOffEvents } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const location = useLocation();
  const navigate = useNavigate();
  const { medicId: medicIdParam } = useParams();
  const isTablet = useMediaQuery(media.lg);
  const medicId = medicIdFromLoader || medicIdParam || '';
  const isSubmitting = navigation.state === 'submitting';
  const submittingIntent = navigation.formData?.get('_intent');
  const removingId = submittingIntent === 'remove-time-off' ? String(navigation.formData?.get('id') || '') : null;

  useEffect(() => {
    console.log('[appointments/settings route] loader settings snapshot', {
      medicId,
      settingsRecord,
      timeOffEvents,
    });
  }, [medicId, settingsRecord, timeOffEvents]);

  useEffect(() => {
    if (!actionData) {
      return;
    }

    if (actionData.ok && actionData.intent === 'save-settings') {
      showNotification({
        color: 'green',
        title: t('appointments.save_success_title'),
        message: t('appointments.save_success_message'),
      });
      return;
    }

    if (actionData.ok && actionData.intent === 'create-time-off') {
      showNotification({
        color: 'green',
        title: t('appointments.event_add_success_title'),
        message: t('appointments.event_add_success_message'),
      });
      return;
    }

    if (actionData.ok && actionData.intent === 'remove-time-off') {
      showNotification({
        color: 'green',
        title: t('appointments.event_remove_success_title'),
        message: t('appointments.event_remove_success_message'),
      });
      return;
    }

    if (!actionData.ok && actionData.intent === 'save-settings') {
      showNotification({
        color: 'red',
        title: t('appointments.save_error_title'),
        message: actionData.error || t('appointments.save_error_message'),
      });
      return;
    }

    if (!actionData.ok && actionData.intent === 'create-time-off') {
      showNotification({
        color: 'red',
        title: t('appointments.event_add_error_title'),
        message: actionData.error || t('appointments.event_add_error_message'),
      });
      return;
    }

    if (!actionData.ok && actionData.intent === 'remove-time-off') {
      showNotification({
        color: 'red',
        title: t('appointments.event_remove_error_title'),
        message: actionData.error || t('appointments.event_remove_error_message'),
      });
    }
  }, [actionData, t]);

  const handleClose = () => {
    const parent = location.pathname.split('/').slice(0, -1).join('/');
    navigate(parent, { preventScrollReset: isTablet });
  };

  const handleSaveSettings = (payload: SettingsSavePayload) => {
    if (!medicId) {
      return;
    }

    const formData = new FormData();
    formData.set('_intent', 'save-settings');
    formData.set('payload', JSON.stringify(payload));
    submit(formData, { method: 'post' });
  };

  const handleCreateTimeOff = (payload: {
    startDate: string;
    endDate: string;
    type: 'vacation' | 'cancelDay' | 'other';
  }) => {
    if (!medicId) {
      return;
    }

    const formData = new FormData();
    formData.set('_intent', 'create-time-off');
    formData.set('payload', JSON.stringify(payload));
    submit(formData, { method: 'post' });
  };

  const handleRemoveTimeOff = (id: string) => {
    const formData = new FormData();
    formData.set('_intent', 'remove-time-off');
    formData.set('id', id);
    submit(formData, { method: 'post' });
  };

  return (
    <Drawer
      opened={true}
      onClose={handleClose}
      position={isTablet ? 'right' : 'bottom'}
      styles={{ content: { minWidth: '50vw' } }}
    >
      <Title order={3} mb="md">
        {t('common.settings')}
      </Title>
      <Tabs defaultValue="settings" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="settings">{t('appointments.settings_tab_label')}</Tabs.Tab>
          <Tabs.Tab value="time-off-events">{t('appointments.time_off_tab_label')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="settings" pt="md">
          <SettingsTab
            medicId={medicId}
            initialSettings={settingsRecord}
            isSaving={isSubmitting && submittingIntent === 'save-settings'}
            onSave={handleSaveSettings}
          />
        </Tabs.Panel>
        <Tabs.Panel value="time-off-events" pt="md">
          <TimeOffTab
            events={timeOffEvents}
            isLoading={isSubmitting && submittingIntent === 'create-time-off'}
            removingId={removingId}
            onCreate={handleCreateTimeOff}
            onRemove={handleRemoveTimeOff}
          />
        </Tabs.Panel>
      </Tabs>
    </Drawer>
  );
};

export default AppointmentsSettings;
