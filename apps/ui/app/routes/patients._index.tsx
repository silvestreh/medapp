import { Link } from '@remix-run/react';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Button, Group } from '@mantine/core';
import { PlusIcon } from '@phosphor-icons/react';
import Joyride from 'react-joyride';

import { authenticatedLoader } from '~/utils/auth.server';
import PatientSearchTable from '~/components/patient-search-table';
import Portal from '~/components/portal';
import { media } from '~/media';
import { displayDocumentValue } from '~/utils';
import { Fab } from '~/components/fab';
import { getMedicareLabel } from '~/components/medicare-display';
import { useSectionTour } from '~/components/guided-tour/use-section-tour';
import { getPatientsSteps } from '~/components/guided-tour/tour-steps/patients-steps';
import TourTooltip from '~/components/guided-tour/tour-tooltip';

export const loader = authenticatedLoader();

export default function PatientsIndex() {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery(media.md);
  const steps = getPatientsSteps(t);
  const { run, stepIndex, handleCallback } = useSectionTour('patients', steps);

  return (
    <>
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        callback={handleCallback}
        continuous
        showSkipButton
        disableOverlayClose={false}
        tooltipComponent={TourTooltip}
        styles={{ options: { zIndex: 10000 } }}
      />
      {isDesktop && (
        <Portal id="form-actions">
          <Group>
            <Button data-tour="patients-new" component={Link} to="/patients/new" leftSection={<PlusIcon size={16} />}>
              {t('patients.new_patient')}
            </Button>
          </Group>
        </Portal>
      )}

      {!isDesktop && <Fab to="/patients/new" />}

      <PatientSearchTable
        basePath="/patients"
        searchTourId="patients-search"
        columns={[
          { key: 'personalData.firstName' },
          { key: 'personalData.lastName' },
          { key: 'personalData.documentValue', render: v => displayDocumentValue(v as string) },
          { key: 'medicare', render: (_v, patient) => getMedicareLabel(patient) || 'Particular' },
        ]}
      />
    </>
  );
}
