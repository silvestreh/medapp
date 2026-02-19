import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Flex } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { generateSlots } from '~/utils';
import { css } from '~/styled-system/css';
import { styled } from '~/styled-system/jsx';
import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import AppointmentsList from '~/components/appointments-list';
import PatientSearchTable from '~/components/patient-search-table';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const Container = styled(Flex, {
  base: {
    sm: {
      flexDirection: 'column-reverse',
    },
    lg: {
      alignItems: 'stretch',
      flexDirection: 'row',
      minHeight: 'calc(100vh - 5em)',
    },
  },
});

const LeftColumn = styled(Flex, {
  base: {
    flexDirection: 'column',

    lg: {
      minHeight: 0,
      width: '40%',
    },
  },
});

const MainColumn = styled(Flex, {
  base: {
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    backgroundColor: 'white',
  },
});

const HeaderContainer = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',

    sm: {
      padding: '1em',
    },
    md: {
      padding: '2em 2em 1em',
    },
  },
});

const Title = styled('h1', {
  base: {
    fontSize: '1.5rem',
    lineHeight: 1,
    fontWeight: 700,
    flex: 1,
    margin: 0,

    md: {
      fontSize: '2rem',
    },

    lg: {
      fontSize: '2.25rem',
    },
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

export default function EncountersIndex() {
  const { t } = useTranslation();
  const { slots } = useLoaderData<typeof loader>();

  return (
    <Container>
      <LeftColumn>
        <HeaderContainer>
          <Title>{t('appointments.today_schedule')}</Title>
        </HeaderContainer>
        <AppointmentsList
          slots={slots}
          readonly
          onAppointmentClick={console.log}
          className={css({
            borderTop: '1px solid var(--mantine-color-gray-2)',
            lg: {
              borderRight: '1px solid var(--mantine-color-gray-2)',
            },
          })}
        />
      </LeftColumn>
      <MainColumn>
        <PatientSearchTable />
      </MainColumn>
    </Container>
  );
}
