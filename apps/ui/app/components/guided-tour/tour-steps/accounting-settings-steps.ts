import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export function getAccountingSettingsSteps(t: TFunction): Step[] {
  return [
    {
      target: '[data-tour="acct-settings-search"]',
      content: t('tour.accounting_settings.search'),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="acct-settings-add-insurer"]',
      content: t('tour.accounting_settings.add_insurer'),
      placement: 'right',
    },
    {
      target: '[data-tour="acct-settings-add-past"]',
      content: t('tour.accounting_settings.add_past'),
      placement: 'right',
    },
    {
      target: '[data-tour="acct-settings-pricing-mode"]',
      content: t('tour.accounting_settings.pricing_mode'),
      placement: 'bottom',
    },
    {
      target: '[data-tour="acct-settings-practice-type"]',
      content: t('tour.accounting_settings.practice_type'),
      placement: 'right',
    },
    {
      target: '[data-tour="acct-settings-practice-code"]',
      content: t('tour.accounting_settings.practice_code'),
      placement: 'right',
    },
    {
      target: '[data-tour="acct-settings-base-value"]',
      content: t('tour.accounting_settings.base_value'),
      placement: 'bottom',
      disableScrolling: true,
    },
    {
      target: '[data-tour="acct-settings-copy-from"]',
      content: t('tour.accounting_settings.copy_from'),
      placement: 'bottom',
      disableScrolling: true,
    },
    {
      target: '[data-tour="acct-settings-save"]',
      content: t('tour.accounting_settings.save'),
      placement: 'bottom',
      disableScrolling: true,
    },
    {
      target: '[data-tour="acct-settings-visibility"]',
      content: t('tour.accounting_settings.visibility'),
      placement: 'left',
    },
    {
      target: '[data-tour="acct-settings-backfill"]',
      content: t('tour.accounting_settings.backfill'),
      placement: 'right',
    },
  ];
}
