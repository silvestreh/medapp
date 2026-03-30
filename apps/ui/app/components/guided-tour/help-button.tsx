import React, { useCallback } from 'react';
import { ActionIcon, Menu, Tooltip } from '@mantine/core';
import { QuestionIcon, ArrowCounterClockwiseIcon, BookOpenIcon } from '@phosphor-icons/react';
import { useLocation, useNavigate } from '@remix-run/react';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';

import { media } from '~/media';
import { useTour } from './tour-provider';

const ROUTE_TOUR_MAP: Record<string, string> = {
  '/encounters': 'encounters',
  '/studies': 'studies',
  '/patients': 'patients',
  '/prescriptions': 'prescriptions',
  '/users': 'users',
  '/stats': 'stats',
  '/settings': 'settings',
  '/accounting': 'accounting',
};

function getTourIdFromPath(pathname: string): string | null {
  // Check for nested encounter routes first
  if (/^\/encounters\/[^/]+\/new/.test(pathname)) return 'encounter-new';
  if (/^\/encounters\/[^/]+/.test(pathname)) return 'encounter-detail';

  // Check for accounting settings
  if (/^\/accounting\/[^/]+\/settings/.test(pathname)) return 'accounting-settings';
  if (/^\/accounting\/[^/]+/.test(pathname)) return 'accounting';

  // Match top-level routes
  for (const [route, tourId] of Object.entries(ROUTE_TOUR_MAP)) {
    if (pathname.startsWith(route)) return tourId;
  }

  return null;
}

interface HelpButtonProps {
  asMenuItem?: boolean;
}

const HelpButton: React.FC<HelpButtonProps> = ({ asMenuItem = false }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(media.sm);
  const { resetTour } = useTour();

  const currentTourId = getTourIdFromPath(location.pathname);

  const handleStartTour = useCallback(() => {
    if (currentTourId) {
      resetTour(currentTourId);
    }
  }, [currentTourId, resetTour]);

  const handleReadDocs = useCallback(() => {
    navigate('/docs');
  }, [navigate]);

  if (asMenuItem) {
    return (
      <>
        <Menu.Item
          leftSection={<ArrowCounterClockwiseIcon size={16} />}
          onClick={handleStartTour}
          disabled={!currentTourId}
        >
          {t('tour.start_tour')}
        </Menu.Item>
        <Menu.Item
          leftSection={<BookOpenIcon size={16} />}
          onClick={handleReadDocs}
        >
          {t('tour.read_docs')}
        </Menu.Item>
      </>
    );
  }

  return (
    <Menu withArrow position={isMobile ? 'right-end' : 'right-end'} shadow="xs">
      <Menu.Target>
        <Tooltip label={t('tour.help_tooltip')} position="right">
          <ActionIcon variant="subtle" size="3em">
            <QuestionIcon size={isMobile ? 18 : 22} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<ArrowCounterClockwiseIcon size={16} />}
          onClick={handleStartTour}
          disabled={!currentTourId}
        >
          {t('tour.start_tour')}
        </Menu.Item>
        <Menu.Item
          leftSection={<BookOpenIcon size={16} />}
          onClick={handleReadDocs}
        >
          {t('tour.read_docs')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default HelpButton;
