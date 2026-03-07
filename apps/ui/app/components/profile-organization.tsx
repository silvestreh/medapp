import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, Flex, FileInput, Image, Group } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useFetcher, useRevalidator } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Building2, Upload } from 'lucide-react';

import { useFeathers } from '~/components/provider';
import type { action } from '~/routes/settings.organization';
import Portal from '~/components/portal';
import { FormCard, FieldRow, StyledTextInput, SectionTitle, FormHeader } from '~/components/forms/styles';

interface ProfileOrganizationProps {
  currentOrg: { id: string; name: string; slug: string; settings?: Record<string, any> };
  showFormActions: boolean;
}

export function ProfileOrganization({ currentOrg, showFormActions }: ProfileOrganizationProps) {
  const { t } = useTranslation();
  const client = useFeathers();
  const revalidator = useRevalidator();
  const orgFetcher = useFetcher<typeof action>();
  const [orgName, setOrgName] = useState(currentOrg.name);
  const [isUploading, setIsUploading] = useState(false);
  const [orgAddress, setOrgAddress] = useState(currentOrg.settings?.healthCenter?.address || '');
  const [orgPhone, setOrgPhone] = useState(currentOrg.settings?.healthCenter?.phone || '');
  const [orgEmail, setOrgEmail] = useState(currentOrg.settings?.healthCenter?.email || '');
  const [orgLogoUrl, setOrgLogoUrl] = useState(currentOrg.settings?.healthCenter?.logoUrl || '');

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

  const handleOrgNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setOrgName(e.currentTarget.value);
  }, []);

  const handleSaveOrg = useCallback(() => {
    orgFetcher.submit(
      {
        intent: 'update-organization',
        orgId: currentOrg.id,
        name: orgName,
        address: orgAddress,
        phone: orgPhone,
        email: orgEmail,
        logoUrl: orgLogoUrl,
      },
      { method: 'post' }
    );
  }, [currentOrg.id, orgName, orgAddress, orgPhone, orgEmail, orgLogoUrl, orgFetcher]);

  useHotkeys([['mod+S', handleSaveOrg]], []);

  return (
    <>
      <FormHeader>
        <SectionTitle icon={<Building2 />}>{t('profile.tab_organization')}</SectionTitle>
      </FormHeader>
      <FormCard>
        <FieldRow label={`${t('profile.org_name')}:`} variant="stacked">
          <StyledTextInput value={orgName} onChange={handleOrgNameChange} />
        </FieldRow>
        <FieldRow label={`${t('profile.org_address')}:`} variant="stacked">
          <StyledTextInput
            value={orgAddress}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setOrgAddress(e.currentTarget.value)}
          />
        </FieldRow>
        <FieldRow label={`${t('profile.org_phone')}:`} variant="stacked">
          <StyledTextInput
            value={orgPhone}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setOrgPhone(e.currentTarget.value)}
          />
        </FieldRow>
        <FieldRow label={`${t('profile.org_email')}:`} variant="stacked">
          <StyledTextInput
            value={orgEmail}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setOrgEmail(e.currentTarget.value)}
          />
        </FieldRow>
        <FieldRow label={`${t('profile.org_logo')}:`} variant="stacked">
          <Flex align="center" gap="sm">
            {orgLogoUrl && <Image src={orgLogoUrl} alt="Logo" h={32} w="auto" fit="contain" />}
            <FileInput
              accept="image/*"
              placeholder={orgLogoUrl ? t('profile.org_logo_change') : t('profile.org_logo_upload')}
              description={orgLogoUrl || undefined}
              leftSection={<Upload size={16} />}
              style={{ flex: 1 }}
              disabled={isUploading}
              onChange={async file => {
                if (!file) return;
                setIsUploading(true);
                try {
                  const formData = new FormData();
                  formData.append('file', file);

                  const token = await (client as any).authentication?.getAccessToken?.();
                  const orgId = (client as any).organizationId;
                  const headers: Record<string, string> = {};
                  if (token) headers['Authorization'] = `Bearer ${token}`;
                  if (orgId) headers['organization-id'] = orgId;

                  const response = await fetch('/api/file-uploads', {
                    method: 'POST',
                    headers,
                    body: formData,
                  });

                  if (response.ok) {
                    const { url } = await response.json();
                    setOrgLogoUrl(url);
                    orgFetcher.submit(
                      {
                        intent: 'update-organization',
                        orgId: currentOrg.id,
                        name: orgName,
                        address: orgAddress,
                        phone: orgPhone,
                        email: orgEmail,
                        logoUrl: url,
                      },
                      { method: 'post' }
                    );
                  } else {
                    notifications.show({ message: t('profile.org_save_error'), color: 'red' });
                  }
                } catch {
                  notifications.show({ message: t('profile.org_save_error'), color: 'red' });
                } finally {
                  setIsUploading(false);
                }
              }}
            />
          </Flex>
        </FieldRow>
      </FormCard>

      <Portal id="form-actions">
        {showFormActions && (
          <Group>
            <Button
              size="sm"
              onClick={handleSaveOrg}
              loading={
                orgFetcher.state === 'submitting' && orgFetcher.formData?.get('intent') === 'update-organization'
              }
              disabled={
                !orgName.trim() ||
                (orgName === currentOrg.name &&
                  orgAddress === (currentOrg.settings?.healthCenter?.address || '') &&
                  orgPhone === (currentOrg.settings?.healthCenter?.phone || '') &&
                  orgEmail === (currentOrg.settings?.healthCenter?.email || '') &&
                  orgLogoUrl === (currentOrg.settings?.healthCenter?.logoUrl || ''))
              }
            >
              {t('common.save')}
            </Button>
          </Group>
        )}
      </Portal>
    </>
  );
}
