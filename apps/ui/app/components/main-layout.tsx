import React, { PropsWithChildren, useCallback, useEffect, useState } from 'react';
import { Flex, Box, LoadingOverlay, Alert, CloseButton, Anchor } from '@mantine/core';
import { Link } from '@remix-run/react';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { styled } from '~/styled-system/jsx';
import SideNav from '~/components/side-nav';
import TopNav from '~/components/top-nav';
import { useAccount, useFeathers } from '~/components/provider';
import { VerificationBanner } from '~/components/verification-banner';

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
  const { t } = useTranslation();
  const feathers = useFeathers();
  const [isVerified, setIsVerified] = useState<boolean | undefined>(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!user) {
      setIsVerified(true); // Hide banner when logged out
      return;
    }

    const checkVerification = async () => {
      const currentOrg = (user as any)?.organizations?.[0];
      const orgRoleIds: string[] = currentOrg?.roleIds || [];
      if (orgRoleIds.includes('medic')) {
        try {
          const mdSettingsResponse = await feathers.service('md-settings').find({
            query: { userId: user.id },
            paginate: false,
          });
          const settings = Array.isArray(mdSettingsResponse)
            ? mdSettingsResponse[0]
            : (mdSettingsResponse as any)?.data?.[0];
          setIsVerified(settings?.isVerified);
        } catch (error) {
          console.error('Error checking verification status:', error);
        }
      } else {
        setIsVerified(true); // Don't show banner for non-medics
      }
    };

    if (isMounted) {
      checkVerification();
    }
  }, [isMounted, user, feathers]);

  const handleDismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  if (!isMounted) {
    return <LoadingOverlay visible />;
  }

  const showWeakPasswordBanner = !!user?.hasWeakPassword && !bannerDismissed;

  return (
    <MainLayoutContainer>
      <SideNav />
      <Box flex={1}>
        <VerificationBanner isVerified={isVerified} />
        <TopNav />
        {showWeakPasswordBanner && (
          <Alert
            color="orange"
            icon={<ShieldAlert size={18} />}
            py="sm"
            px="md"
            radius={0}
            styles={{ root: { position: 'relative' } }}
          >
            {t('common.weak_password_warning', "Your password doesn't meet the current security policy.")}{' '}
            <Anchor component={Link} to="/profile/security" fw={600}>
              {t('common.update_password', 'Update it now')}
            </Anchor>
            <CloseButton onClick={handleDismissBanner} size="sm" style={{ position: 'absolute', top: 8, right: 8 }} />
          </Alert>
        )}
        <ContentContainer>{children}</ContentContainer>
      </Box>
    </MainLayoutContainer>
  );
};

export default MainLayout;
