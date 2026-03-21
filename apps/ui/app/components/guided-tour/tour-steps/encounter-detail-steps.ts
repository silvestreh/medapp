import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export function getEncounterDetailSteps(t: TFunction): Step[] {
  return [
    {
      target: '[data-tour="encounter-back"]',
      content: t('tour.encounter_detail.back'),
      placement: 'bottom',
      disableBeacon: true,
      disableScrolling: true,
    },
    {
      target: '[data-tour="encounter-tree"]',
      content: t('tour.encounter_detail.tree'),
      placement: 'right',
    },
    {
      target: '[data-tour="encounter-actions"]',
      content: t('tour.encounter_detail.actions'),
      placement: 'left',
    },
    {
      target: '[data-tour="encounter-new"]',
      content: t('tour.encounter_detail.new_encounter'),
      placement: 'left',
    },
  ];
}
