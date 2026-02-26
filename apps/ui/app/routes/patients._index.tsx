import { Link } from '@remix-run/react';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Button, Group } from '@mantine/core';
import { Plus } from 'lucide-react';

import { authenticatedLoader } from '~/utils/auth.server';
import PatientSearchTable from '~/components/patient-search-table';
import Portal from '~/components/portal';
import { media } from '~/media';
import { displayDocumentValue } from '~/utils';
import { Fab } from '~/components/fab';
import { getMedicareLabel } from '~/components/medicare-display';

export const loader = authenticatedLoader();

export default function PatientsIndex() {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery(media.md);

  return (
    <>
      {isDesktop && (
        <Portal id="form-actions">
          <Group>
            <Button component={Link} to="/patients/new" leftSection={<Plus size={16} />}>
              {t('patients.new_patient')}
            </Button>
          </Group>
        </Portal>
      )}

      {!isDesktop && <Fab to="/patients/new" />}

      <PatientSearchTable
        basePath="/patients"
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
