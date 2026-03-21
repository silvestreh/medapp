import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export function getPatientsSteps(t: TFunction): Step[] {
  return [
    {
      target: '[data-tour="patients-search"]',
      content: t('tour.patients.search'),
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="patients-new"]',
      content: t('tour.patients.new_patient'),
      placement: 'bottom',
      disableScrolling: true,
    },
  ];
}
