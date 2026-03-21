import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export function getEncounterNewSteps(t: TFunction): Step[] {
  return [
    {
      target: '[data-tour="new-encounter-back"]',
      content: t('tour.encounter_new.back'),
      placement: 'bottom',
      disableBeacon: true,
      disableScrolling: true,
    },
    {
      target: '[data-tour="new-encounter-sidebar"]',
      content: t('tour.encounter_new.sidebar'),
      placement: 'right',
    },
    {
      target: '[data-tour="new-encounter-attach"]',
      content: t('tour.encounter_new.attach'),
      placement: 'bottom',
      disableScrolling: true,
    },
  ];
}
