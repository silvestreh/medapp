import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export function getUsersSteps(t: TFunction): Step[] {
  return [
    {
      target: '[data-tour="users-invite"]',
      content: t('tour.users.invite'),
      placement: 'bottom',
      disableBeacon: true,
      disableScrolling: true,
    },
    {
      target: '[data-tour="users-roles"]',
      content: t('tour.users.roles'),
      placement: 'bottom',
    },
    {
      target: '[data-tour="users-remove"]',
      content: t('tour.users.remove'),
      placement: 'bottom',
    },
  ];
}
