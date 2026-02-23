import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useFetcher, useRevalidator } from '@remix-run/react';
import { useTranslation } from 'react-i18next';

import type { action } from '~/routes/profile.organization';
import Portal from '~/components/portal';
import { FormCard, FieldRow, StyledTextInput, StyledTitle, FormHeader } from '~/components/forms/styles';

interface ProfileOrganizationProps {
  currentOrg: { id: string; name: string; slug: string };
  showFormActions: boolean;
}

export function ProfileOrganization({ currentOrg, showFormActions }: ProfileOrganizationProps) {
  const { t } = useTranslation();
  const revalidator = useRevalidator();
  const orgFetcher = useFetcher<typeof action>();
  const [orgName, setOrgName] = useState(currentOrg.name);

  const lastHandledData = useRef(orgFetcher.data);

  useEffect(() => {
    if (orgFetcher.data === lastHandledData.current) return;
    lastHandledData.current = orgFetcher.data;

    if (orgFetcher.data?.ok && orgFetcher.data.intent === 'update-organization') {
      notifications.show({ message: t('profile.org_saved'), color: 'green' });
      revalidator.revalidate();
    }
    if (orgFetcher.data && !orgFetcher.data.ok && orgFetcher.data.intent === 'update-organization') {
      notifications.show({ message: t('profile.org_save_error'), color: 'red' });
    }
  }, [orgFetcher.data, revalidator, t]);

  const handleOrgNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setOrgName(e.currentTarget.value);
  }, []);

  const handleSaveOrg = useCallback(() => {
    orgFetcher.submit({ intent: 'update-organization', orgId: currentOrg.id, name: orgName }, { method: 'post' });
  }, [currentOrg.id, orgName, orgFetcher]);

  return (
    <>
      <FormHeader>
        <StyledTitle>{t('profile.tab_organization')}</StyledTitle>
      </FormHeader>
      <FormCard>
        <FieldRow label={`${t('profile.org_name')}:`} variant="stacked">
          <StyledTextInput value={orgName} onChange={handleOrgNameChange} />
        </FieldRow>
      </FormCard>
      <Portal id="form-actions">
        {showFormActions && (
          <Button
            size="sm"
            onClick={handleSaveOrg}
            loading={orgFetcher.state === 'submitting'}
            disabled={orgName === currentOrg.name || !orgName.trim()}
          >
            {t('profile.save_organization')}
          </Button>
        )}
      </Portal>
    </>
  );
}
