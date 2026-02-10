import { useState, useEffect, useMemo, useCallback } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { useLoaderData, useParams, Outlet, useNavigate } from '@remix-run/react';
import { type LoaderFunctionArgs } from '@remix-run/node';
import { Drawer, Skeleton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

import { media } from '~/media';
import { generateEmptySlots } from '~/utils';
import { getAuthenticatedClient } from '~/utils/auth.server';
import { useFind } from '~/components/provider';
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

  return { medicId, appointments, holidays, medic, initialDate: params.date };
};

export default function AppointmentsForMedic() {
  const navigate = useNavigate();
  const { medicId, appointments, holidays, medic, initialDate } = useLoaderData<typeof loader>();
  const [workDays, setWorkDays] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(initialDate ? dayjs(initialDate) : null);
  const [date, setDate] = useState<Dayjs | null>(initialDate ? dayjs(initialDate) : dayjs());
  const memoizedDate = useMemo(() => date, [date]);
  const params = useParams();
  const emptySlots = useMemo(() => generateEmptySlots(selectedDate as Dayjs, medic), [selectedDate, medic]);
  const isTablet = useMediaQuery(media.lg);
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

  const events = useMemo(() => {
    const appointments = response?.map((appointment: any) => ({
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

    return [...appointments, ...holidays];
  }, [response, holidays]);

  const handleNavigate = useCallback((newDate: Dayjs) => setDate(newDate), []);
  const handleSelectDate = useCallback((newDate: Dayjs) => setSelectedDate(newDate), []);
  const handleSettingsClick = useCallback(() => navigate(`/appointments/${medicId}/settings`), [navigate, medicId]);

  useEffect(() => {
    setSelectedDate(params.date ? dayjs(params.date) : null);
  }, [params.date]);

  useEffect(() => {
    const daysOfWeek = [
      'sundayStart',
      'mondayStart',
      'tuesdayStart',
      'wednesdayStart',
      'thursdayStart',
      'fridayStart',
      'saturdayStart',
    ];

    const workDays = daysOfWeek
      .map((day, index) => (medic?.settings?.[day] ? index : null))
      .filter(index => index !== null);

    setWorkDays(workDays as number[]);
  }, [medic]);

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
      <Drawer
        opened={Boolean(selectedDate && isTablet)}
        onClose={() => setSelectedDate(null)}
        position="right"
        styles={{ content: { minWidth: '50vw' } }}
      >
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
      </Drawer>
      <Outlet />
    </div>
  );
}

export const ErrorBoundary = () => {
  return <div>Something went wrong</div>;
};
