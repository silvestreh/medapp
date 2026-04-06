import { useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import { useLoaderData, useRouteLoaderData } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { type LoaderFunctionArgs, type LinksFunction } from '@remix-run/node';
import { Button, Title, Text, Alert } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import '@mantine/dates/styles.css';
import { CalendarDotsIcon, PrinterIcon } from '@phosphor-icons/react';

import AppointmentsList from '~/components/appointments-list';
import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import { fetchHolidays } from '~/utils/holidays.server';
import RouteErrorFallback from '~/components/route-error-fallback';
import { generateSlots, formatInLocale } from '~/utils';
import { printAppointments } from '~/utils/print-appointments';
import { Fab } from '~/components/fab';
import { styled } from '~/styled-system/jsx';
import { css } from '~/styled-system/css';
import { media } from '~/media';
import type { Account, Slot } from '~/declarations';

export const links: LinksFunction = () => [];

const Container = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',

    sm: {
      maxWidth: 'unset',
    },
    md: {
      maxWidth: 'calc(100vw - 5.25em)',
    },
    lg: {
      maxWidth: 'unset',
    },
  },
});

export const loader = authenticatedLoader(async ({ request, params }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const date = dayjs(params.date);

  if (!params.medicId) {
    throw new Error('medicId is required');
  }

  const medic = (await client.service('users').get(params.medicId)) as Account;
  const appointments = await client.service('appointments').find({
    query: {
      medicId: params.medicId,
      startDate: {
        $gte: date.startOf('month').toISOString(),
        $lte: date.endOf('month').toISOString(),
      },
    },
  });
  const slots = generateSlots(date, appointments, medic);

  let hasTimeOff = false;
  try {
    const timeOffResponse = await client.service('time-off-events').find({
      query: {
        medicId: params.medicId,
        startDate: { $lte: date.endOf('day').toISOString() },
        endDate: { $gte: date.startOf('day').toISOString() },
      },
      paginate: false,
    });
    hasTimeOff = Array.isArray(timeOffResponse) ? timeOffResponse.length > 0 : (timeOffResponse?.data?.length ?? 0) > 0;
  } catch {
    // Keep appointments usable even if time-off service/permissions are not ready.
  }

  let holiday: { title: string } | null = null;
  try {
    const holidays = await fetchHolidays();
    const dateStart = date.startOf('day').toISOString();
    const dateEnd = date.endOf('day').toISOString();
    const matchingHoliday = holidays.find(h => h.startDate <= dateEnd && h.endDate >= dateStart);
    holiday = matchingHoliday ? { title: matchingHoliday.title } : null;
  } catch {
    // Non-blocking: appointments remain usable if ICS fetch fails.
  }

  return { slots, date: params.date, medicId: params.medicId, hasTimeOff, holiday };
});

export default function AppointmentsForDate() {
  const { slots, date, medicId, hasTimeOff, holiday } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const rootData = useRouteLoaderData('root') as { locale?: string } | undefined;
  const locale = rootData?.locale ?? 'es';
  const isTablet = useMediaQuery(media.lg);
  const title = useMemo(
    () => formatInLocale(date, locale === 'es' ? 'DD [de] MMMM, YYYY' : 'MMMM D, YYYY', locale),
    [date, locale]
  );
  const isPastDate = dayjs(date).startOf('day').isBefore(dayjs().startOf('day'));

  const handlePrint = useCallback(() => {
    printAppointments(slots as Slot[], title, t('appointments.free'), t('appointments.private'));
  }, [slots, title, t]);

  return (
    <Container>
      {isTablet && (
        <styled.div display="flex" alignItems="center" mb="4">
          <Title flex={1}>{title}</Title>
          <Button variant="outline" onClick={handlePrint} leftSection={<PrinterIcon size={20} />} aria-label="Print">
            {t('print_pdf.print')}
          </Button>
        </styled.div>
      )}
      {!isTablet && <Fab icon={<PrinterIcon size={22} />} onClick={handlePrint} />}
      {hasTimeOff && (
        <Text variant="light" ta="center" py="xl">
          {t('appointments.time_off_day')}
        </Text>
      )}
      {!hasTimeOff && (
        <>
          {holiday && (
            <Alert icon={<CalendarDotsIcon size={16} />} color="yellow" variant="light" mb="md" title={holiday.title}>
              {t('appointments.holiday_warning', { name: holiday.title })}
            </Alert>
          )}
          <AppointmentsList
            slots={slots}
            medicId={medicId}
            currentDate={date}
            readonly={isPastDate}
            className={css({
              borderTopWidth: 0,
              borderBottomWidth: 0,

              lg: {
                borderRadius: 8,
                border: '1px solid var(--mantine-color-gray-2)',

                '& .slot': {
                  '&:last-child': {
                    borderBottomWidth: 0,
                  },
                },

                '& .slot:first-child .slot-time': {
                  borderTopLeftRadius: '8px',
                },

                '& .slot:last-child .slot-time': {
                  borderBottomLeftRadius: '8px',
                },
              },
            })}
          />
        </>
      )}
    </Container>
  );
}

export const ErrorBoundary = RouteErrorFallback;
