import { useEffect, useState, useMemo, type FC } from 'react';
import dayjs from 'dayjs';
import { useLoaderData, useNavigate, useLocation } from '@remix-run/react';
import { type LoaderFunctionArgs } from '@remix-run/node';
import { Drawer, Title, DrawerProps } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

import AppointmentsList from '~/components/appointments-list';
import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import { generateSlots } from '~/utils';
import { styled, media } from '~/stitches';
import type { Account } from '~/declarations';

const Container = styled('div', {
  display: 'flex',
  flexDirection: 'column',

  '@sm': {
    maxWidth: 'unset',
  },
  '@md': {
    maxWidth: 'calc(100vw - 5.25em)',
  },
  '@lg': {
    maxWidth: 'unset',
  },
});

const DummyDrawer: FC<DrawerProps> = ({ children }) => children;

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
  const [isMounted, setIsMounted] = useState(false);
  const isTablet = useMediaQuery(media.lg);
  const Wrapper = isTablet ? Drawer : DummyDrawer;
  const location = useLocation();
  const navigate = useNavigate();
  const title = useMemo(() => dayjs(date).format('DD [de] MMMM, YYYY'), [date]);

  const handleClose = () => {
    const parent = location.pathname.split('/').slice(0, -1).join('/');
    navigate(parent, { preventScrollReset: isTablet });
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <Wrapper
      opened={isMounted}
      onClose={handleClose}
      position="right"
      key={date}
      keepMounted
      styles={{
        content: { minWidth: '50vw' },
        overlay: { backgroundColor: 'transparent' },
      }}
    >
      <Container>
        <Title order={2} mb="lg" display={isTablet ? 'block' : 'none'}>
          {title}
        </Title>
        <AppointmentsList slots={slots} borderRadius={isTablet} medicId={medicId} />
      </Container>
    </Wrapper>
  );
}

export const ErrorBoundary = () => {
  return <div>Something went wrong</div>;
};
