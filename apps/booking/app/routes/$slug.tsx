import { Outlet } from '@remix-run/react';
import { Container } from '@mantine/core';

export default function SlugLayout() {
  return (
    <Container size="xs" py="xl" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <Outlet />
    </Container>
  );
}
