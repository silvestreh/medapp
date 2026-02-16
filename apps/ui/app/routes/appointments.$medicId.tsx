import { useState, useEffect, useMemo, useCallback } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { useLoaderData, useParams, Outlet, useNavigate, useRouteError } from '@remix-run/react';
import { type LoaderFunctionArgs } from '@remix-run/node';
import { Skeleton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';

import { media } from '~/media';
import { generateEmptySlots, getWorkDaysFromSettings } from '~/utils';
import { getAuthenticatedClient } from '~/utils/auth.server';
import { useFind } from '~/components/provider';
import { RouteDrawer } from '~/components/route-drawer';
import Calendar from '~/components/calendar';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const icsResponse = await fetch(`${new URL(request.url).origin}/ics`);
  const holidays = await icsResponse.json();
  const { client } = await getAuthenticatedClient(request);
  const { medicId } = params;
  let medic = null;

  if (medicId) {
    medic = await client.service('users').get(medicId as string);
  }

  const appointments = await client.service('appointments').find({
    query: {
      medicId,
      startDate: {
        $gte: dayjs().startOf('month').toISOString(),
        $lte: dayjs().endOf('month').toISOString(),
      },
    },
  });

  let timeOffEvents: any[] = [];

  try {
    timeOffEvents = await client.service('time-off-events').find({
      query: {
        medicId,
        startDate: {
          $lte: dayjs().endOf('month').toISOString(),
        },
        endDate: {
          $gte: dayjs().startOf('month').toISOString(),
        },
      },
      paginate: false,
    });
  } catch (error) {
    // Keep appointments usable even if time-off service/permissions are not ready.
    timeOffEvents = [];
  }

  return { medicId, appointments, holidays, medic, timeOffEvents, initialDate: params.date };
};

export default function AppointmentsForMedic() {
  const navigate = useNavigate();
  const {
    medicId,
    appointments,
    holidays,
    medic,
    timeOffEvents: initialTimeOffEvents,
    initialDate,
  } = useLoaderData<typeof loader>();
  const [workDays, setWorkDays] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(initialDate ? dayjs(initialDate) : null);
  const [date, setDate] = useState<Dayjs | null>(initialDate ? dayjs(initialDate) : dayjs());
  const memoizedDate = useMemo(() => date, [date]);
  const params = useParams();
  const emptySlots = useMemo(() => generateEmptySlots(selectedDate as Dayjs, medic), [selectedDate, medic]);
  const isTablet = useMediaQuery(media.lg);
  const hasDateChild = Boolean(params.date);
  const [dateDrawerOpen, setDateDrawerOpen] = useState(false);
  const query = useMemo(
    () => ({
      medicId: medicId,
      startDate: {
        $gte: memoizedDate?.startOf('month').subtract(1, 'week').toISOString(),
        $lte: memoizedDate?.endOf('month').add(1, 'week').toISOString(),
      },
    }),
    [medicId, memoizedDate] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const { response } = useFind('appointments', query, { paginate: false }, appointments);
  const timeOffQuery = useMemo(
    () => ({
      medicId,
      startDate: {
        $lte: memoizedDate?.endOf('month').add(1, 'week').toISOString(),
      },
      endDate: {
        $gte: memoizedDate?.startOf('month').subtract(1, 'week').toISOString(),
      },
    }),
    [medicId, memoizedDate]
  );
  const { response: timeOffResponse } = useFind(
    'time-off-events',
    timeOffQuery,
    { paginate: false },
    initialTimeOffEvents
  );

  const events = useMemo(() => {
    const appointmentsList = Array.isArray(response) ? response : response?.data || [];
    const timeOffList = Array.isArray(timeOffResponse) ? timeOffResponse : timeOffResponse?.data || [];
    const holidaysList = Array.isArray(holidays) ? holidays : [];

    const appointments = appointmentsList.map((appointment: any) => ({
      id: appointment.id,
      title: `${appointment.patient.personalData.lastName.toUpperCase()}, ${appointment.patient.personalData.firstName}`,
      extra: appointment.extra,
      variant: appointment.extra ? 'yellow' : 'blue',
      startDate: appointment.extra
        ? dayjs(appointment.startDate)
            .endOf('day')
            .subtract(appointment.duration || 20, 'minutes')
            .toISOString()
        : appointment.startDate,
      endDate: appointment.extra
        ? dayjs(appointment.startDate).endOf('day').subtract(1, 'minute').toISOString()
        : dayjs(appointment.startDate)
            .add(appointment.duration || 20, 'minutes')
            .toISOString(),
    }));

    const timeOffEvents = timeOffList.map((event: any) => ({
      id: `time-off-${event.id}`,
      title:
        event.type === 'vacation'
          ? 'Vacaciones'
          : event.type === 'cancelDay'
            ? 'Suspende consultorio'
            : 'Tiempo fuera de consultorio',
      startDate: dayjs(event.startDate).startOf('day').toISOString(),
      endDate: dayjs(event.endDate).endOf('day').toISOString(),
      allDay: true,
      variant: 'pink',
    }));

    return [...appointments, ...holidaysList, ...timeOffEvents];
  }, [response, holidays, timeOffResponse]);

  const handleNavigate = useCallback((newDate: Dayjs) => setDate(newDate), []);
  const handleSelectDate = useCallback((newDate: Dayjs) => setSelectedDate(newDate), []);
  const handleSettingsClick = useCallback(() => navigate(`/appointments/${medicId}/settings`), [navigate, medicId]);

  useEffect(() => {
    setSelectedDate(params.date ? dayjs(params.date) : null);
  }, [params.date]);

  useEffect(() => {
    if (selectedDate && isTablet) {
      setDateDrawerOpen(true);
    }
  }, [selectedDate, isTablet]);

  useEffect(() => {
    setWorkDays(getWorkDaysFromSettings(medic?.settings));
  }, [medic]);

  const handleDateDrawerClose = useCallback(() => {
    setDateDrawerOpen(false);
  }, []);

  const handleDateDrawerExited = useCallback(() => {
    setSelectedDate(null);
    if (params.date) {
      navigate(`/appointments/${medicId}`, { preventScrollReset: isTablet });
    }
  }, [params.date, navigate, medicId, isTablet]);

  return (
    <div>
      <Calendar
        events={events}
        date={memoizedDate}
        onChange={handleSelectDate}
        onNavigate={handleNavigate}
        workDays={workDays}
        selectedDate={selectedDate}
        medicId={medicId as string}
        onSettingsClick={handleSettingsClick}
      />
      {isTablet && (hasDateChild || dateDrawerOpen) && (
        <RouteDrawer
          opened={dateDrawerOpen}
          onClose={handleDateDrawerClose}
          onExited={handleDateDrawerExited}
          position="right"
          styles={{ content: { minWidth: '50vw' } }}
          skeleton={
            <>
              <Skeleton h={36} w={300} mb="md" />
              {emptySlots.map((_, index) => {
                const isFirst = index === 0;
                const isLast = index === emptySlots.length - 1;

                return (
                  <Skeleton
                    key={index}
                    w="100%"
                    h={63.5}
                    styles={{
                      root: {
                        marginBottom: 1,
                        borderTopLeftRadius: isFirst ? 10 : 0,
                        borderTopRightRadius: isFirst ? 10 : 0,
                        borderBottomLeftRadius: isLast ? 10 : 0,
                        borderBottomRightRadius: isLast ? 10 : 0,
                      },
                    }}
                  />
                );
              })}
            </>
          }
        >
          <Outlet />
        </RouteDrawer>
      )}
      {(!isTablet || !hasDateChild) && <Outlet />}
    </div>
  );
}

export const ErrorBoundary = () => {
  const { t } = useTranslation();
  const error = useRouteError() as any;

  return (
    <div>
      <div>{t('common.something_went_wrong')}</div>
      {process.env.NODE_ENV !== 'production' && error && (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{error?.message || JSON.stringify(error, null, 2)}</pre>
      )}
    </div>
  );
};
