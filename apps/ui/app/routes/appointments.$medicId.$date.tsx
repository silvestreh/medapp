import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useLoaderData } from '@remix-run/react';
import { type LoaderFunctionArgs, type LinksFunction } from '@remix-run/node';
import { Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import '@mantine/dates/styles.css';

import AppointmentsList from '~/components/appointments-list';
import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import { generateSlots } from '~/utils';
import { styled } from '~/styled-system/jsx';
import { css } from '~/styled-system/css';
import { media } from '~/media';
import type { Account } from '~/declarations';

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

  return { slots, date: params.date, medicId: params.medicId };
});

export default function AppointmentsForDate() {
  const { slots, date, medicId } = useLoaderData<typeof loader>();
  const isTablet = useMediaQuery(media.lg);
  const title = useMemo(() => dayjs(date).format('DD [de] MMMM, YYYY'), [date]);

  return (
    <Container>
      <Title order={2} mb="lg" display={isTablet ? 'block' : 'none'}>
        {title}
      </Title>
      <AppointmentsList
        slots={slots}
        medicId={medicId}
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
    </Container>
  );
}

export const ErrorBoundary = () => {
  const { t } = useTranslation();
  return <div>{t('common.something_went_wrong')}</div>;
};
