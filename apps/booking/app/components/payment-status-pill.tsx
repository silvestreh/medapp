import { Badge } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import type { BookingPayment } from '~/api.server';
import { formatMoneyMinor } from '~/utils/money';

interface PaymentStatusPillProps {
  payment: Pick<BookingPayment, 'status' | 'isDeposit' | 'remainderAmount' | 'currency' | 'refundStatus'>;
}

export default function PaymentStatusPill({ payment }: PaymentStatusPillProps) {
  const { t } = useTranslation();

  if (payment.status === 'approved' && payment.isDeposit) {
    return (
      <Badge variant="light" color="teal" size="sm">
        {t('booking.payment.pill_deposit_paid', {
          remainder: formatMoneyMinor(payment.remainderAmount, payment.currency),
        })}
      </Badge>
    );
  }

  if (payment.status === 'approved') {
    return (
      <Badge variant="light" color="green" size="sm">
        {t('booking.payment.pill_paid')}
      </Badge>
    );
  }

  if (payment.status === 'refunded' || payment.refundStatus === 'requested') {
    return (
      <Badge variant="light" color="blue" size="sm">
        {payment.status === 'refunded' && t('booking.payment.refunded_title')}
        {payment.status !== 'refunded' && t('booking.payment.refund_pending')}
      </Badge>
    );
  }

  if (payment.status === 'pending' || payment.status === 'in_process') {
    return (
      <Badge variant="light" color="yellow" size="sm">
        {t('booking.payment.pill_pending')}
      </Badge>
    );
  }

  return null;
}
