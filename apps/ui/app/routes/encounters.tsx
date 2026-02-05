import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { type LoaderFunctionArgs, type MetaFunction, type LinksFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Flex } from '@mantine/core';
import datesStyles from '@mantine/dates/styles.css?url';

import { generateSlots } from '~/utils';
import { styled } from '~/stitches';
import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import AppointmentsList from '~/components/appointments-list';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: datesStyles }];

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Encuentros' }];
};

const Container = styled(Flex, {
  '@sm': {
    flexDirection: 'column',
  },
  '@md': {
    flexDirection: 'row',
  },
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

export default function Encounters() {
  const { slots } = useLoaderData<typeof loader>();

  return (
    <Container>
      <AppointmentsList slots={slots} readonly onAppointmentClick={console.log} />
    </Container>
  );
}
