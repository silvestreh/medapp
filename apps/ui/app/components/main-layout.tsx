import React, { PropsWithChildren, useCallback, useEffect, useState } from 'react';
import { Flex, Box, LoadingOverlay, Alert, CloseButton, Anchor } from '@mantine/core';
import { Link } from '@remix-run/react';
import { ShieldWarningIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { SALES_EMAIL } from '@athelas/brand';

import { styled } from '~/styled-system/jsx';
import SideNav from '~/components/side-nav';
import TopNav from '~/components/top-nav';
import { useAccount, useOrganization } from '~/components/provider';
import { VerificationBanner } from '~/components/verification-banner';
import { NewVersionBanner } from '~/components/new-version-banner';
import { ChatManagerProvider } from '~/components/chat-manager';
import { ChatHeadsContainer } from '~/components/chat-heads';
import { ChatProvider } from '~/components/chat/chat-provider';
import { TourProvider } from '~/components/guided-tour/tour-provider';

const MainLayoutContainer = styled(Flex, {
  base: {
    minHeight: '100vh',
    backgroundColor: 'var(--mantine-color-gray-0)',
    containerType: 'inline-size',
    sm: {
      flexDirection: 'column-reverse',
    },
    md: {
      flexDirection: 'row',
    },
  },
});

const ContentContainer = styled(Box, {
  base: {
    maxWidth: '1440px',
    margin: '0 auto',
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',

    '&::after, &::before': {
      content: '""',
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
      left: '-1px',
    },
    '&::after': {
      right: '-1px',
    },

    '@container (max-width: 1520px)': {
      '&::after, &::before': {
        display: 'none',
      },
    },

    sm: {
      minHeight: 'unset',
    },
    lg: {
      minHeight: 'calc(100vh - 5em)',
    },
  },
});

const MainLayout: React.FC<PropsWithChildren> = ({ children }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { user } = useAccount();
  const { currentOrganizationId, organizations } = useOrganization();
  const { t } = useTranslation();
  const [isVerified, setIsVerified] = useState<boolean | undefined>(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!user) {
      setIsVerified(true);
      return;
    }

    const currentOrg = (user as any)?.organizations?.[0];
    const orgRoleIds: string[] = currentOrg?.roleIds || [];
    if (!orgRoleIds.includes('medic')) {
      setIsVerified(true);
    } else {
      setIsVerified((user as any)?.settings?.isVerified === true);
    }
  }, [user]);

  const handleDismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  if (!isMounted) {
    return <LoadingOverlay visible />;
  }

  const showWeakPasswordBanner = !!user?.hasWeakPassword && !bannerDismissed;
  const currentOrg = organizations.find(o => o.id === currentOrganizationId);
  const isOrgActive = currentOrg?.isActive !== false;

  return (
    <ChatProvider>
      <TourProvider>
      <ChatManagerProvider>
        <MainLayoutContainer>
          <SideNav />
          <Box flex={1}>
            <VerificationBanner isVerified={isVerified} />
            <TopNav />
            <NewVersionBanner />
            {!isOrgActive && (
              <Alert color="orange" icon={<ShieldWarningIcon size={18} />} py="sm" px="md" radius={0}>
                {t(
                  'organization.inactive_banner',
                  'Your organization is not yet activated. Please contact sales to get started.'
                )}{' '}
                <Anchor href={`mailto:${SALES_EMAIL}`} fw={600}>
                  {SALES_EMAIL}
                </Anchor>
              </Alert>
            )}
            {showWeakPasswordBanner && (
              <Alert
                color="orange"
                icon={<ShieldWarningIcon size={18} />}
                py="sm"
                px="md"
                radius={0}
                styles={{ root: { position: 'relative' } }}
              >
                {t('common.weak_password_warning', "Your password doesn't meet the current security policy.")}{' '}
                <Anchor component={Link} to="/settings/security" fw={600}>
                  {t('common.update_password', 'Update it now')}
                </Anchor>
                <CloseButton
                  onClick={handleDismissBanner}
                  size="sm"
                  style={{ position: 'absolute', top: 8, right: 8 }}
                />
              </Alert>
            )}
            <ContentContainer>{children}</ContentContainer>
          </Box>
        </MainLayoutContainer>
        {user && <ChatHeadsContainer />}
      </ChatManagerProvider>
      </TourProvider>
    </ChatProvider>
  );
};

export default MainLayout;
