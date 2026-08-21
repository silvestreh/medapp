import { useCallback } from 'react';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { Link, useLoaderData, useParams, useSearchParams } from '@remix-run/react';
import { Button, Group, Paper, Select, SegmentedControl, Stack, Table, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, WalletIcon } from '@phosphor-icons/react';
import dayjs from 'dayjs';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import { media } from '~/media';
import { styled } from '~/styled-system/jsx';
import PaymentStatusBadge, { type PaymentBadgeStatus } from '~/components/payments/payment-status-badge';
import RouteErrorFallback from '~/components/route-error-fallback';
import { formatMoneyMinor } from '~/utils/money';

interface PaymentRow {
  id: string;
  appointmentStartDate: string;
  patientName: string;
  amount: number;
  currency: string;
  chargePortionSnapshot: number;
  status: PaymentBadgeStatus;
  flagged: boolean;
  paidAt: string | null;
}

const PERIODS = ['month', 'last-month', '90d'] as const;
type Period = (typeof PERIODS)[number];

const resolvePeriod = (period: Period): { from: string; to: string } => {
  if (period === 'last-month') {
    const start = dayjs().subtract(1, 'month').startOf('month');
    return { from: start.toISOString(), to: start.endOf('month').toISOString() };
  }
  if (period === '90d') {
    return { from: dayjs().subtract(90, 'day').startOf('day').toISOString(), to: dayjs().endOf('day').toISOString() };
  }
  return { from: dayjs().startOf('month').toISOString(), to: dayjs().endOf('month').toISOString() };
};

export const loader = authenticatedLoader(async ({ request, params }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const { medicId } = params;

  if (!medicId) {
    throw new Response('Medic ID is required', { status: 400 });
  }

  const url = new URL(request.url);
  const period = (
    PERIODS.includes(url.searchParams.get('period') as Period) ? url.searchParams.get('period') : 'month'
  ) as Period;
  const status = url.searchParams.get('status') || 'all';
  const { from, to } = resolvePeriod(period);

  let rows: any[] = [];
  try {
    const response = await client.service('appointment-payments' as any).find({
      query: {
        medicId,
        appointmentStartDate: { $gte: from, $lte: to },
        ...(status !== 'all' && { status }),
        $sort: { appointmentStartDate: -1 },
        $limit: 200,
      },
      paginate: false,
    });
    rows = Array.isArray(response) ? response : (response as any)?.data || [];
  } catch {
    // appointment-payments table may not exist yet
  }

  // Resolve patient display names (payments only carry ids).
  const patientNames = new Map<string, string>();
  await Promise.all(
    [...new Set(rows.map(row => row.patientId))].map(async patientId => {
      try {
        const patient = (await client.service('patients').get(patientId)) as any;
        const pd = patient?.personalData;
        patientNames.set(patientId, pd ? [pd.firstName, pd.lastName].filter(Boolean).join(' ') : patientId);
      } catch {
        patientNames.set(patientId, '—');
      }
    })
  );

  const payments: PaymentRow[] = rows.map(row => ({
    id: row.id,
    appointmentStartDate: row.appointmentStartDate,
    patientName: patientNames.get(row.patientId) || '—',
    amount: row.amount,
    currency: row.currency,
    chargePortionSnapshot: row.chargePortionSnapshot,
    status: row.status,
    flagged: Boolean(row.flagged),
    paidAt: row.paidAt,
  }));

  const approved = payments.filter(payment => payment.status === 'approved' || payment.status === 'refunded');
  const totalApproved = payments
    .filter(payment => payment.status === 'approved')
    .reduce((sum, payment) => sum + payment.amount, 0);

  return json({ payments, totalApproved, approvedCount: approved.length, period, status });
});

const MobileCard = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid var(--mantine-color-gray-2)',
  },
});

export default function AccountingPaymentsRoute() {
  const { payments, totalApproved, period, status } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const params = useParams();
  const [, setSearchParams] = useSearchParams();
  const isDesktop = useMediaQuery(media.md);

  const handlePeriodChange = useCallback(
    (value: string) => {
      setSearchParams(prev => {
        prev.set('period', value);
        return prev;
      });
    },
    [setSearchParams]
  );

  const handleStatusChange = useCallback(
    (value: string | null) => {
      setSearchParams(prev => {
        prev.set('status', value || 'all');
        return prev;
      });
    },
    [setSearchParams]
  );

  const approvedTotalLine = t('payments.reconciliation.period_total', {
    total: formatMoneyMinor(totalApproved),
    count: payments.filter((payment: PaymentRow) => payment.status === 'approved').length,
  });

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm">
          <WalletIcon size={22} />
          <Title order={3}>{t('payments.reconciliation.title')}</Title>
        </Group>
        <Button
          component={Link}
          to={`/accounting/${params.medicId}`}
          variant="subtle"
          leftSection={<ArrowLeftIcon size={16} />}
        >
          {t('common.back')}
        </Button>
      </Group>

      <Group gap="sm" wrap="wrap">
        <SegmentedControl
          value={period}
          onChange={handlePeriodChange}
          data={[
            { value: 'month', label: t('payments.reconciliation.period_this_month') },
            { value: 'last-month', label: t('payments.reconciliation.period_last_month') },
            { value: '90d', label: t('payments.reconciliation.period_90d') },
          ]}
        />
        <Select
          value={status}
          onChange={handleStatusChange}
          w={180}
          data={[
            { value: 'all', label: t('payments.reconciliation.filter_status_all') },
            { value: 'approved', label: t('payments.reconciliation.filter_status_approved') },
            { value: 'pending', label: t('payments.reconciliation.filter_status_pending') },
            { value: 'rejected', label: t('payments.reconciliation.filter_status_rejected') },
            { value: 'refunded', label: t('payments.reconciliation.filter_status_refunded') },
          ]}
        />
      </Group>

      <Paper withBorder radius="md">
        {payments.length === 0 && (
          <Text c="dimmed" ta="center" p="xl">
            {t('payments.reconciliation.empty')}
          </Text>
        )}

        {payments.length > 0 && isDesktop && (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('payments.reconciliation.col_date')}</Table.Th>
                <Table.Th>{t('payments.reconciliation.col_patient')}</Table.Th>
                <Table.Th>{t('payments.reconciliation.col_amount')}</Table.Th>
                <Table.Th>{t('payments.reconciliation.col_portion')}</Table.Th>
                <Table.Th>{t('payments.reconciliation.col_status')}</Table.Th>
                <Table.Th>{t('payments.reconciliation.col_paid_at')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {payments.map((payment: PaymentRow) => (
                <Table.Tr key={payment.id}>
                  <Table.Td>{dayjs(payment.appointmentStartDate).format('DD/MM/YYYY HH:mm')}</Table.Td>
                  <Table.Td>{payment.patientName}</Table.Td>
                  <Table.Td>{formatMoneyMinor(payment.amount, payment.currency)}</Table.Td>
                  <Table.Td>
                    {payment.chargePortionSnapshot < 100 &&
                      t('payments.reconciliation.portion_deposit', { portion: payment.chargePortionSnapshot })}
                    {payment.chargePortionSnapshot >= 100 && t('payments.reconciliation.portion_full')}
                  </Table.Td>
                  <Table.Td>
                    <PaymentStatusBadge
                      status={payment.status}
                      chargePortion={payment.chargePortionSnapshot}
                      flagged={payment.flagged}
                    />
                  </Table.Td>
                  <Table.Td>{payment.paidAt ? dayjs(payment.paidAt).format('DD/MM/YYYY HH:mm') : '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {payments.length > 0 && !isDesktop && (
          <div>
            {payments.map((payment: PaymentRow) => (
              <MobileCard key={payment.id}>
                <Group justify="space-between">
                  <Text fw={500} size="sm">
                    {dayjs(payment.appointmentStartDate).format('DD/MM HH:mm')}
                  </Text>
                  <PaymentStatusBadge
                    status={payment.status}
                    chargePortion={payment.chargePortionSnapshot}
                    flagged={payment.flagged}
                    size="xs"
                  />
                </Group>
                <Text size="sm">{payment.patientName}</Text>
                <Text size="sm" c="dimmed">
                  {formatMoneyMinor(payment.amount, payment.currency)}
                </Text>
              </MobileCard>
            ))}
          </div>
        )}
      </Paper>

      <Text size="sm" fw={500}>
        {approvedTotalLine}
      </Text>
      <Text size="xs" c="dimmed">
        {t('payments.reconciliation.hint_non_fiscal')}
      </Text>
    </Stack>
  );
}

export const ErrorBoundary = RouteErrorFallback;
