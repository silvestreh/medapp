import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Card, Title, Text, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { getPatientToken } from '~/session.server';
import { findBookings } from '~/api.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const token = await getPatientToken(request);
  if (!token) {
    return redirect(`/${params.slug}/auth`);
  }

  try {
    const booking = await findBookings(token);
    return json({ booking });
  } catch {
    return redirect(`/${params.slug}/auth`);
  }
};

export default function BookingPage() {
  const { t } = useTranslation();
  const { booking } = useLoaderData<typeof loader>();

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md" align="center">
        <Title order={3}>{t('booking.title')}</Title>
        <Text c="dimmed">{t('booking.coming_soon')}</Text>
      </Stack>
    </Card>
  );
}
