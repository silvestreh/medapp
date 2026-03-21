import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export function getEncountersSteps(t: TFunction): Step[] {
  return [
    {
      target: '[data-tour="encounters-schedule"]',
      content: t('tour.encounters.schedule'),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="encounters-search"]',
      content: t('tour.encounters.search'),
      placement: 'bottom',
    },
    {
      target: '[data-tour="encounters-results"]',
      content: t('tour.encounters.results'),
      placement: 'left',
    },
    {
      target: '[data-tour="user-menu"]',
      content: t('tour.encounters.user_menu'),
      placement: 'bottom-end',
      disableScrolling: true,
    },
  ];
}
