import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Flex } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

import { generateSlots } from '~/utils';
import { styled, media } from '~/stitches';
import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import AppointmentsList from '~/components/appointments-list';
import PatientSearchTable from '~/components/patient-search-table';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const Container = styled(Flex, {
  '@sm': {
    flexDirection: 'column-reverse',
  },
  '@lg': {
    flexDirection: 'row',
    padding: '2rem',
    gap: '1rem',
  },
});

const LeftColumn = styled(Flex, {
  '@lg': {
    width: '40%',
  },
});

const MainColumn = styled(Flex, {
  flex: 1,
});

export const loader = authenticatedLoader(async ({ request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const date = dayjs('2024-11-27');
  const appointments = await client.service('appointments').find({
    query: {
      medicId: user?.id,
      startDate: {
        $gte: date.startOf('month').toISOString(),
        $lte: date.endOf('month').toISOString(),
      },
    },
  });
  const slots = generateSlots(date, appointments, user);

  return { slots };
});

export default function EncountersIndex() {
  const { slots } = useLoaderData<typeof loader>();
  const isTablet = useMediaQuery(media.lg);

  return (
    <Container>
      <LeftColumn>
        <AppointmentsList slots={slots} readonly onAppointmentClick={console.log} borderRadius={isTablet} />
      </LeftColumn>
      <MainColumn>
        <PatientSearchTable />
      </MainColumn>
    </Container>
  );
}
