import { useCallback, useEffect, useRef } from 'react';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Link, useFetcher, useLoaderData, useRevalidator } from '@remix-run/react';
import { Button, Loader, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ArrowsClockwiseIcon, CheckCircleIcon, ClockIcon, WarningCircleIcon, XCircleIcon } from '@phosphor-icons/react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

import { styled } from '~/styled-system/jsx';
import { getPatientToken } from '~/session.server';
import { getAppointmentPayment, skipPayment, type AppointmentPaymentStatus } from '~/api.server';
import { resolveBookingContext } from '~/host.server';
import { formatMoneyMinor } from '~/utils/money';

dayjs.locale('es');

export const meta: MetaFunction = () => [{ title: 'Estado del pago' }];

// Checkout return target (Mercado Pago back_urls all point here). The truth is
// ALWAYS the server-fetched status — the provider's redirect query params are
// deliberately ignored.
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { basePath } = resolveBookingContext(request, params);
  const token = await getPatientToken(request);

  if (!token) {
    // Session expired during a long checkout: after re-auth the appointment
    // state is visible in "Mis turnos".
    return redirect(`${basePath}/auth`);
  }

  const appointmentId = params.appointmentId as string;

  try {
    const status = await getAppointmentPayment(token, appointmentId);
    return json({ status, basePath, appointmentId, error: false });
  } catch {
    return json({ status: null as AppointmentPaymentStatus | null, basePath, appointmentId, error: true });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  resolveBookingContext(request, params);
  const token = await getPatientToken(request);

  if (!token) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();

  if (formData.get('intent') === 'skip-payment') {
    try {
      await skipPayment(token, params.appointmentId as string);
      return json({ ok: true });
    } catch {
      return json({ ok: false, error: 'skip_failed' });
    }
  }

  return json({ ok: false });
};

const Page = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '55vh',
    textAlign: 'center',
    padding: '2rem 1rem',
  },
});

const IconCircle = styled('div', {
  base: {
    width: '4rem',
    height: '4rem',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  variants: {
    tone: {
      success: { background: 'var(--mantine-color-green-0)', color: 'var(--mantine-color-green-7)' },
      pending: { background: 'var(--mantine-color-yellow-0)', color: 'var(--mantine-color-yellow-8)' },
      error: { background: 'var(--mantine-color-red-0)', color: 'var(--mantine-color-red-7)' },
      neutral: { background: 'var(--mantine-color-gray-1)', color: 'var(--mantine-color-gray-6)' },
    },
  },
});

const PENDING_POLL_MS = 4000;
const PENDING_POLL_MAX = 30;

export default function AppointmentPaymentPage() {
  const { status, basePath, error } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const revalidator = useRevalidator();
  const skipFetcher = useFetcher<{ ok: boolean; error?: string }>();
  const pollCountRef = useRef(0);

  const payment = status?.payment ?? null;
  const appointment = status?.appointment ?? null;
  const appointmentStatus = status?.appointmentStatus ?? 'expired';

  const isPaid = payment?.status === 'approved' && !payment.slotLost;
  const isSlotLost = Boolean(payment?.slotLost);
  const isPending = !isSlotLost && (payment?.status === 'pending' || payment?.status === 'in_process');
  const isRejected = !isSlotLost && payment?.status === 'rejected';
  const isRefunded = payment?.status === 'refunded';
  const holdAlive = Boolean(payment?.expiresAt && dayjs(payment.expiresAt).isAfter(dayjs()));
  const isExpired =
    !isSlotLost && !isPaid && !isRefunded && (appointmentStatus === 'expired' || (isRejected && !holdAlive));
  const pollTimedOut = pollCountRef.current >= PENDING_POLL_MAX;

  // Webhook lag: poll the loader while the payment is pending, then reassure.
  useEffect(() => {
    if (!isPending || pollCountRef.current >= PENDING_POLL_MAX) return;

    const timer = setTimeout(() => {
      pollCountRef.current += 1;
      revalidator.revalidate();
    }, PENDING_POLL_MS);

    return () => clearTimeout(timer);
  }, [isPending, revalidator, status]);

  const handleRetry = useCallback(() => {
    if (payment?.checkoutUrl) {
      window.location.assign(payment.checkoutUrl);
    }
  }, [payment?.checkoutUrl]);

  const handleSkip = useCallback(() => {
    skipFetcher.submit({ intent: 'skip-payment' }, { method: 'post' });
  }, [skipFetcher]);

  const skipSucceeded = skipFetcher.data?.ok === true;

  return (
    <Page>
      {error && (
        <Stack align="center" gap="sm">
          <IconCircle tone="neutral">
            <WarningCircleIcon size={28} />
          </IconCircle>
          <Title order={3}>{t('common.something_went_wrong')}</Title>
          <Text c="dimmed">{t('common.try_again')}</Text>
          <Button component={Link} to={basePath || '/'} variant="default">
            {t('booking.payment.back_to_appointments')}
          </Button>
        </Stack>
      )}

      {!error && (isPaid || skipSucceeded) && (
        <Stack align="center" gap="sm" maw={440}>
          <IconCircle tone="success">
            <CheckCircleIcon size={30} />
          </IconCircle>
          {isPaid && (
            <>
              <Title order={3}>{t('booking.payment.confirmed_paid_title')}</Title>
              {appointment && (
                <Text c="dimmed">
                  {dayjs(appointment.startDate).format('dddd D [de] MMMM, HH:mm')} hs
                </Text>
              )}
              {payment && (
                <Text fw={600} size="lg">
                  {formatMoneyMinor(payment.amount, payment.currency)}
                </Text>
              )}
              {payment && payment.isDeposit && payment.remainderAmount > 0 && (
                <Text size="sm">
                  {t('booking.payment.remainder_note', {
                    remainder: formatMoneyMinor(payment.remainderAmount, payment.currency),
                  })}
                </Text>
              )}
              <Text size="xs" c="dimmed">
                {t('booking.payment.receipt_non_fiscal')}
              </Text>
            </>
          )}
          {!isPaid && skipSucceeded && (
            <Title order={3}>{t('booking.confirmed_title')}</Title>
          )}
          <Button component={Link} to={basePath || '/'} mt="sm">
            {t('booking.payment.back_to_appointments')}
          </Button>
        </Stack>
      )}

      {!error && !skipSucceeded && isPending && (
        <Stack align="center" gap="sm" maw={440}>
          {!pollTimedOut && <Loader size="md" />}
          {pollTimedOut && (
            <IconCircle tone="pending">
              <ClockIcon size={28} />
            </IconCircle>
          )}
          <Title order={3}>{t('booking.payment.confirming')}</Title>
          {pollTimedOut && <Text c="dimmed">{t('booking.payment.pending_long')}</Text>}
          {payment?.checkoutUrl && holdAlive && (
            <Button onClick={handleRetry} variant="default" leftSection={<ArrowsClockwiseIcon size={16} />}>
              {t('booking.payment.retry_payment')}
            </Button>
          )}
          <Button component={Link} to={basePath || '/'} variant="subtle">
            {t('booking.payment.back_to_appointments')}
          </Button>
        </Stack>
      )}

      {!error && !skipSucceeded && isRejected && !isExpired && (
        <Stack align="center" gap="sm" maw={440}>
          <IconCircle tone="error">
            <XCircleIcon size={30} />
          </IconCircle>
          <Title order={3}>{t('booking.payment.rejected_title')}</Title>
          <Text c="dimmed">{t('booking.payment.rejected_message')}</Text>
          {payment?.checkoutUrl && (
            <Button onClick={handleRetry} leftSection={<ArrowsClockwiseIcon size={16} />}>
              {t('booking.payment.retry_payment')}
            </Button>
          )}
          {appointmentStatus === 'confirmed' && (
            <Button onClick={handleSkip} variant="default" loading={skipFetcher.state !== 'idle'}>
              {t('booking.payment.pay_in_person')}
            </Button>
          )}
          {skipFetcher.data?.error && (
            <Text c="red" size="sm">
              {t('booking.payment.skip_failed')}
            </Text>
          )}
        </Stack>
      )}

      {!error && !skipSucceeded && isExpired && !isPaid && !isSlotLost && !isRefunded && !isPending && (
        <Stack align="center" gap="sm" maw={440}>
          <IconCircle tone="neutral">
            <ClockIcon size={28} />
          </IconCircle>
          <Title order={3}>{t('booking.payment.expired_title')}</Title>
          <Text c="dimmed">{t('booking.payment.expired_message')}</Text>
          <Button component={Link} to={`${basePath}/new-appointment`}>
            {t('booking.payment.rebook')}
          </Button>
        </Stack>
      )}

      {!error && isSlotLost && (
        <Stack align="center" gap="sm" maw={440}>
          <IconCircle tone="error">
            <WarningCircleIcon size={30} />
          </IconCircle>
          <Title order={3}>{t('booking.payment.slot_lost_title')}</Title>
          <Text c="dimmed">{t('booking.payment.slot_lost_message')}</Text>
          {payment?.refundStatus === 'requested' && (
            <Text size="sm">{t('booking.payment.refund_pending')}</Text>
          )}
          <Button component={Link} to={`${basePath}/new-appointment`} variant="default">
            {t('booking.payment.rebook')}
          </Button>
        </Stack>
      )}

      {!error && isRefunded && !isSlotLost && (
        <Stack align="center" gap="sm" maw={440}>
          <IconCircle tone="neutral">
            <CheckCircleIcon size={28} />
          </IconCircle>
          <Title order={3}>{t('booking.payment.refunded_title')}</Title>
          {payment && (
            <Text c="dimmed">
              {t('booking.payment.refunded_message', {
                amount: formatMoneyMinor(payment.refundStatus === 'completed' ? payment.amount : payment.amount, payment.currency),
              })}
            </Text>
          )}
          <Button component={Link} to={basePath || '/'} variant="default">
            {t('booking.payment.back_to_appointments')}
          </Button>
        </Stack>
      )}
    </Page>
  );
}
