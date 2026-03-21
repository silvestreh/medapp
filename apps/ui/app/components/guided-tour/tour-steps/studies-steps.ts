import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export function getStudiesSteps(t: TFunction): Step[] {
  return [
    {
      target: '[data-tour="studies-search"]',
      content: t('tour.studies.search'),
      placement: 'bottom',
      disableBeacon: true,
      disableScrolling: true,
    },
    {
      target: '[data-tour="studies-filters"]',
      content: t('tour.studies.filters'),
      placement: 'bottom',
      disableScrolling: true,
    },
    {
      target: '[data-tour="studies-new"]',
      content: t('tour.studies.new_study'),
      placement: 'bottom',
      disableScrolling: true,
    },
    {
      target: '[data-tour="studies-pagination"]',
      content: t('tour.studies.pagination'),
      placement: 'top',
    },
  ];
}
