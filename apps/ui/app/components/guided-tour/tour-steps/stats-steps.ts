import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export function getStatsSteps(t: TFunction): Step[] {
  return [
    {
      target: '[data-tour="stats-date-range"]',
      content: t('tour.stats.date_range'),
      placement: 'bottom',
      disableBeacon: true,
    },
  ];
}
