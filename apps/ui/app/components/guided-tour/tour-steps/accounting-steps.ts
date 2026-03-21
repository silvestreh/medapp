import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export function getAccountingSteps(t: TFunction): Step[] {
  return [
    {
      target: '[data-tour="accounting-medic"]',
      content: t('tour.accounting.medic'),
      placement: 'bottom',
      disableBeacon: true,
      disableScrolling: true,
    },
    {
      target: '[data-tour="accounting-insurer-filter"]',
      content: t('tour.accounting.insurer_filter'),
      placement: 'bottom',
      disableScrolling: true,
    },
    {
      target: '[data-tour="accounting-date-range"]',
      content: t('tour.accounting.date_range'),
      placement: 'bottom',
      disableScrolling: true,
    },
    {
      target: '[data-tour="accounting-revenue"]',
      content: t('tour.accounting.revenue'),
      placement: 'bottom',
    },
    {
      target: '[data-tour="accounting-chart"]',
      content: t('tour.accounting.chart'),
      placement: 'top',
    },
    {
      target: '[data-tour="accounting-table"]',
      content: t('tour.accounting.table'),
      placement: 'top',
    },
    {
      target: '[data-tour="accounting-untracked"]',
      content: t('tour.accounting.untracked'),
      placement: 'top',
    },
    {
      target: '[data-tour="accounting-backfill"]',
      content: t('tour.accounting.backfill'),
      placement: 'top',
    },
  ];
}
