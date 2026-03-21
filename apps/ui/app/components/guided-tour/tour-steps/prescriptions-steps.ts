import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export function getPrescriptionsSteps(t: TFunction): Step[] {
  return [
    {
      target: '[data-tour="prescriptions-medic"]',
      content: t('tour.prescriptions.medic'),
      placement: 'bottom',
      disableBeacon: true,
      disableScrolling: true,
    },
    {
      target: '[data-tour="prescriptions-type"]',
      content: t('tour.prescriptions.type_filter'),
      placement: 'bottom',
      disableScrolling: true,
    },
    {
      target: '[data-tour="prescriptions-patient-search"]',
      content: t('tour.prescriptions.patient_search'),
      placement: 'bottom',
      disableScrolling: true,
    },
    {
      target: '[data-tour="prescriptions-new"]',
      content: t('tour.prescriptions.new_prescription'),
      placement: 'bottom',
      disableScrolling: true,
    },
    {
      target: '[data-tour="prescriptions-pagination"]',
      content: t('tour.prescriptions.pagination'),
      placement: 'top',
    },
    {
      target: '[data-tour="prescriptions-repeat"]',
      content: t('tour.prescriptions.repeat'),
      placement: 'left',
    },
  ];
}
