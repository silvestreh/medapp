import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { Card, Title, Text, Stack } from '@mantine/core';
import { getPatientToken } from '~/session.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const token = await getPatientToken(request);
  if (!token) {
    return redirect(`/${params.slug}/auth`);
  }
  return json({});
};

export default function BookingPage() {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md" align="center">
        <Title order={3}>Booking</Title>
        <Text c="dimmed">Your booking page is coming soon.</Text>
      </Stack>
    </Card>
  );
}
