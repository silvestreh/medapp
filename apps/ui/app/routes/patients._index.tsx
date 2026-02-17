import { Link } from '@remix-run/react';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Button, ActionIcon, Group } from '@mantine/core';
import { Plus } from 'lucide-react';

import { authenticatedLoader } from '~/utils/auth.server';
import PatientSearchTable from '~/components/patient-search-table';
import Portal from '~/components/portal';
import { media } from '~/media';

export const loader = authenticatedLoader();

export default function PatientsIndex() {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery(media.md);

  return (
    <>
      <Portal id="form-actions">
        <Group>
          {isDesktop && (
            <Button component={Link} to="/patients/new" leftSection={<Plus size={16} />}>
              {t('patients.new_patient')}
            </Button>
          )}
          {!isDesktop && (
            <ActionIcon component={Link} to="/patients/new">
              <Plus size={16} />
            </ActionIcon>
          )}
        </Group>
      </Portal>

      <PatientSearchTable basePath="/patients" />
    </>
  );
}
