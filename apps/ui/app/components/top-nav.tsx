import { Group, Image } from '@mantine/core';

import { styled } from '~/stitches';
import { useAccount } from '~/components/provider';
import LogoutButton from '~/components/logout-button';

const Logo = styled(Image, {
  aspectRatio: '1',
  width: '2.25em',

  '@sm': {
    display: 'block !important',
  },
  '@md': {
    display: 'none !important',
  },
}) as unknown as typeof Image;

const Toolbar = styled(Group, {
  alignItems: 'center',
  flex: 1,
});

const Container = styled('div', {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '1em',
  backgroundColor: 'var(--mantine-color-body)',
  borderBottom: '1px solid var(--mantine-color-gray-2)',
  width: '100%',
  position: 'sticky',
  padding: '1em',
  top: 0,
  zIndex: 10,

  '&:empty': {
    display: 'none',
  },

  '@md': {
    padding: '1em',
  },
  '@lg': {
    padding: '1.25em',
  },
});

export default function TopNav() {
  const { user } = useAccount();

  if (!user) return <Container />;

  return (
    <Container>
      <Logo src="/logo.webp" alt="Logo" />
      <Toolbar id="toolbar" />
      <LogoutButton />
    </Container>
  );
}
