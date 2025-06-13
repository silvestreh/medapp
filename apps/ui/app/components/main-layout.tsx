import React, { PropsWithChildren, useEffect, useState } from 'react';
import { Flex, Box, LoadingOverlay } from '@mantine/core';

import { styled } from '~/stitches';
import SideNav from '~/components/side-nav';
import TopNav from '~/components/top-nav';

const MainLayoutContainer = styled(Flex, {
  minHeight: '100vh',
  backgroundColor: 'var(--mantine-color-gray-0)',
  containerType: 'inline-size',
  '@sm': {
    flexDirection: 'column-reverse',
  },
  '@md': {
    flexDirection: 'row',
  },
});

const ContentContainer = styled(Box, {
  maxWidth: '1440px',
  margin: '0 auto',
  position: 'relative',
  backgroundColor: 'rgba(255, 255, 255, 0.25)',

  '&::after, &::before': {
    content: '',
    display: 'block',
    position: 'absolute',
    top: 0,
    width: '1px',
    height: '100%',
    backgroundColor: 'var(--mantine-color-gray-2)',
    maskImage: 'linear-gradient(to bottom, var(--mantine-color-gray-2), transparent)',
    zIndex: 2,
  },
  '&::before': {
    left: -1,
  },
  '&::after': {
    right: -1,
  },

  '@container (max-width: 1520px)': {
    '&::after, &::before': {
      display: 'none',
    },
  },

  '@sm': {
    minHeight: 'unset',
  },
  '@lg': {
    minHeight: 'calc(100vh - 5em)',
  },
});

const MainLayout: React.FC<PropsWithChildren> = ({ children }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <LoadingOverlay visible />;
  }

  return (
    <MainLayoutContainer>
      <SideNav />
      <Box flex={1}>
        <TopNav />
        <ContentContainer>{children}</ContentContainer>
      </Box>
    </MainLayoutContainer>
  );
};

export default MainLayout;
