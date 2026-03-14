import { useCallback, useState } from 'react';
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link, useFetcher } from '@remix-run/react';
import { Button, Title, Text, Modal, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { CalendarPlusIcon, CalendarIcon, ClockIcon, XIcon } from '@phosphor-icons/react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

import { styled } from '~/styled-system/jsx';
import { getPatientToken } from '~/session.server';
import { findBookings, cancelBooking, type PatientBooking } from '~/api.server';

dayjs.locale('es');

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const token = await getPatientToken(request);

  if (!token) {
    return redirect(`/${params.slug}/auth`);
  }

  try {
    const bookings = await findBookings(token);
    return json({ bookings, slug: params.slug! });
  } catch {
    return redirect(`/${params.slug}/auth`);
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const token = await getPatientToken(request);

  if (!token) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'cancel-booking') {
    const appointmentId = formData.get('appointmentId') as string;

    try {
      await cancelBooking(token, appointmentId);
      return json({ ok: true });
    } catch {
      return json({ ok: false, error: 'cancel_failed' });
    }
  }

  return json({ ok: false });
};

// -- Styled components --

const Page = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '59vh',
    width: 'auto',
  },
});

const Header = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '2rem',
    gap: '1rem',
  },
});

const CardList = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
});

const AppointmentCard = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.25rem',
    borderRadius: '0.75rem',
    border: '1px solid var(--mantine-color-gray-2)',
    background: 'white',
    transition: 'box-shadow 0.15s',

    '&:hover': {
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    },
  },
});

const DateBadge = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '4rem',
    height: '4rem',
    borderRadius: '0.75rem',
    background: 'var(--mantine-primary-color-0)',
    color: 'var(--mantine-primary-color-filled)',
    flexShrink: 0,
  },
});

const DateDay = styled('span', {
  base: {
    fontSize: '1.5rem',
    fontWeight: 700,
    lineHeight: 1,
  },
});

const DateMonth = styled('span', {
  base: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    fontWeight: 600,
    marginTop: '2px',
  },
});

const AppointmentInfo = styled('div', {
  base: {
    flex: 1,
    minWidth: 0,
  },
});

const MedicName = styled('span', {
  base: {
    display: 'block',
    fontWeight: 600,
    fontSize: '1rem',
    lineHeight: 1.3,
  },
});

const Specialty = styled('span', {
  base: {
    display: 'block',
    fontSize: '0.85rem',
    color: 'var(--mantine-color-dimmed)',
    marginBottom: '0.35rem',
  },
});

const MetaRow = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    fontSize: '0.8rem',
    color: 'var(--mantine-color-gray-6)',
  },
});

const MetaItem = styled('span', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
});

const CancelButton = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: 'var(--mantine-color-gray-5)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.15s',

    '&:hover': {
      background: 'var(--mantine-color-red-0)',
      color: 'var(--mantine-color-red-6)',
    },
  },
});

const EmptyState = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem',
    padding: '4rem 1rem',
    textAlign: 'center',
    flex: 1,
  },
});

const EmptyIcon = styled('div', {
  base: {
    width: '4rem',
    height: '4rem',
    borderRadius: '50%',
    background: 'var(--mantine-color-gray-1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--mantine-color-gray-5)',
  },
});

// -- Component --

export default function BookingsIndexPage() {
  const { t } = useTranslation();
  const { bookings, slug } = useLoaderData<typeof loader>();
  const cancelFetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [cancelTarget, setCancelTarget] = useState<PatientBooking | null>(null);
  const [confirmOpen, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);

  const handleCancelClick = useCallback((booking: PatientBooking) => {
    setCancelTarget(booking);
    openConfirm();
  }, [openConfirm]);

  const handleConfirmCancel = useCallback(() => {
    if (!cancelTarget) return;
    cancelFetcher.submit(
      { intent: 'cancel-booking', appointmentId: cancelTarget.id },
      { method: 'post' }
    );
    closeConfirm();
    setCancelTarget(null);
  }, [cancelTarget, cancelFetcher, closeConfirm]);

  const isCancelling = cancelFetcher.state !== 'idle';
  const visibleBookings = bookings.filter(
    (b: PatientBooking) => !(cancelFetcher.data?.ok && cancelTarget?.id === b.id)
  );

  return (
    <Page>
      <Header>
        <div>
          <Title order={2}>{t('booking.my_appointments')}</Title>
          <Text c="dimmed" size="sm" mt={4}>
            {visibleBookings.length > 0
              ? `${visibleBookings.length} ${visibleBookings.length === 1 ? 'turno' : 'turnos'}`
              : ''}
          </Text>
        </div>
        <Button component={Link} to={`/${slug}/new-appointment`} leftSection={<CalendarPlusIcon size={16} />}>
          {t('booking.new_appointment')}
        </Button>
      </Header>

      {visibleBookings.length === 0 && (
        <EmptyState>
          <EmptyIcon>
            <CalendarIcon size={24} />
          </EmptyIcon>
          <div>
            <Text fw={500} mb={4}>{t('booking.no_appointments')}</Text>
            <Text c="dimmed" size="sm">
              {t('booking.choose_medic_subtitle')}
            </Text>
          </div>
          <Button component={Link} to={`/${slug}/new-appointment`} leftSection={<CalendarPlusIcon size={16} />}>
            {t('booking.new_appointment')}
          </Button>
        </EmptyState>
      )}

      {visibleBookings.length > 0 && (
        <CardList>
          {visibleBookings.map((booking: PatientBooking) => {
            const date = dayjs(booking.startDate);
            return (
              <AppointmentCard key={booking.id}>
                <DateBadge>
                  <DateDay>{date.format('D')}</DateDay>
                  <DateMonth>{date.format('MMM')}</DateMonth>
                </DateBadge>
                <AppointmentInfo>
                  <MedicName>
                    {booking.medic.lastName.toUpperCase()}, {booking.medic.firstName}
                  </MedicName>
                  <Specialty>{booking.medic.specialty}</Specialty>
                  <MetaRow>
                    <MetaItem>
                      <CalendarIcon size={13} />
                      {date.format('dddd D [de] MMMM')}
                    </MetaItem>
                    <MetaItem>
                      <ClockIcon size={13} />
                      {date.format('HH:mm')} hs
                    </MetaItem>
                  </MetaRow>
                </AppointmentInfo>
                <CancelButton
                  onClick={() => handleCancelClick(booking)}
                  aria-label={t('booking.cancel_appointment')}
                  disabled={isCancelling}
                >
                  <XIcon size={18} />
                </CancelButton>
              </AppointmentCard>
            );
          })}
        </CardList>
      )}

      {cancelFetcher.data?.error && (
        <Text c="red" size="sm" mt="md" ta="center">
          {t(`booking.${cancelFetcher.data.error}`, t('booking.cancel_failed'))}
        </Text>
      )}

      <Modal opened={confirmOpen} onClose={closeConfirm} centered size="sm" title={t('booking.cancel_confirm_title')}>
        {cancelTarget && (
          <>
            <Text size="sm" mb="lg">
              {t('booking.cancel_confirm_message', {
                medic: `${cancelTarget.medic.lastName.toUpperCase()}, ${cancelTarget.medic.firstName}`,
                date: dayjs(cancelTarget.startDate).format('DD/MM/YYYY'),
                time: dayjs(cancelTarget.startDate).format('HH:mm'),
                interpolation: { escapeValue: false },
              })}
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={closeConfirm}>
                {t('booking.cancel_confirm_no')}
              </Button>
              <Button color="red" onClick={handleConfirmCancel}>
                {t('booking.cancel_confirm_yes')}
              </Button>
            </Group>
          </>
        )}
      </Modal>
    </Page>
  );
}
