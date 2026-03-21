import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export function getSettingsSteps(t: TFunction): Step[] {
  return [
    {
      target: '[data-tour="settings-whatsapp"]',
      content: t('tour.settings.whatsapp'),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="settings-practices"]',
      content: t('tour.settings.practices'),
      placement: 'right',
    },
  ];
}
