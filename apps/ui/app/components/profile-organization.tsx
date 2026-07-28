import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, Flex, FileInput, Image, Group } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useFetcher, useRevalidator } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { BuildingsIcon, UploadIcon } from '@phosphor-icons/react';

import { useFeathers } from '~/components/provider';
import type { action } from '~/routes/settings.organization';
import Portal from '~/components/portal';
import { RefesSearch } from '~/components/refes-search';
import { FormCard, FieldRow, StyledTextInput, SectionTitle, FormHeader } from '~/components/forms/styles';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isValidSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 63 && SLUG_RE.test(slug);
}

interface ProfileOrganizationProps {
  currentOrg: { id: string; name: string; slug: string; settings?: Record<string, any> };
  bookingHostSuffix: string;
  showFormActions: boolean;
}

export function ProfileOrganization({ currentOrg, bookingHostSuffix, showFormActions }: ProfileOrganizationProps) {
  const { t } = useTranslation();
  const client = useFeathers();
  const revalidator = useRevalidator();
  const orgFetcher = useFetcher<typeof action>();
  const [orgName, setOrgName] = useState(currentOrg.name);
  const [orgSlug, setOrgSlug] = useState(currentOrg.slug);
  const [isUploading, setIsUploading] = useState(false);
  const [orgAddress, setOrgAddress] = useState(currentOrg.settings?.healthCenter?.address || '');
  const [orgPhone, setOrgPhone] = useState(currentOrg.settings?.healthCenter?.phone || '');
  const [orgEmail, setOrgEmail] = useState(currentOrg.settings?.healthCenter?.email || '');
  const [orgLogoUrl, setOrgLogoUrl] = useState(currentOrg.settings?.healthCenter?.logoUrl || '');
  const [orgRefesId, setOrgRefesId] = useState(currentOrg.settings?.refesId || '');

  const lastHandledData = useRef(orgFetcher.data);

  useEffect(() => {
    if (orgFetcher.data === lastHandledData.current) return;
    lastHandledData.current = orgFetcher.data;

    if (orgFetcher.data?.ok && orgFetcher.data.intent === 'update-organization') {
      notifications.show({ message: t('profile.org_saved'), color: 'green' });
      revalidator.revalidate();
    }
    if (orgFetcher.data && !orgFetcher.data.ok && orgFetcher.data.intent === 'update-organization') {
      const slugError = (orgFetcher.data as { slugError?: string }).slugError;
      if (slugError === 'taken') {
        notifications.show({ message: t('profile.org_slug_taken'), color: 'red' });
      } else if (slugError === 'reserved') {
        notifications.show({ message: t('profile.org_slug_reserved'), color: 'red' });
      } else if (slugError === 'invalid') {
        notifications.show({ message: t('profile.org_slug_invalid'), color: 'red' });
      } else {
        notifications.show({ message: t('profile.org_save_error'), color: 'red' });
      }
    }
  }, [orgFetcher.data, revalidator, t]);

  const handleOrgNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setOrgName(e.currentTarget.value);
  }, []);

  const handleOrgSlugChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setOrgSlug(cleaned);
  }, []);

  const handleRefesChange = useCallback((refesId: string) => {
    setOrgRefesId(refesId);
  }, []);

  const slugValid = isValidSlug(orgSlug);

  const handleSaveOrg = useCallback(() => {
    orgFetcher.submit(
      {
        intent: 'update-organization',
        orgId: currentOrg.id,
        name: orgName,
        slug: orgSlug,
        address: orgAddress,
        phone: orgPhone,
        email: orgEmail,
        logoUrl: orgLogoUrl,
        refesId: orgRefesId,
      },
      { method: 'post' }
    );
  }, [currentOrg.id, orgName, orgSlug, orgAddress, orgPhone, orgEmail, orgLogoUrl, orgRefesId, orgFetcher]);

  useHotkeys([['mod+S', handleSaveOrg]], []);

  return (
    <>
      <FormHeader>
        <SectionTitle icon={<BuildingsIcon />}>{t('profile.tab_organization')}</SectionTitle>
      </FormHeader>
      <FormCard>
        <FieldRow label={`${t('profile.org_name')}:`} variant="stacked">
          <StyledTextInput value={orgName} onChange={handleOrgNameChange} />
        </FieldRow>
        <FieldRow label={`${t('profile.org_slug')}:`} variant="stacked">
          <StyledTextInput
            value={orgSlug}
            onChange={handleOrgSlugChange}
            error={!slugValid ? t('profile.org_slug_invalid') : undefined}
            description={
              slugValid
                ? `https://${orgSlug}.${bookingHostSuffix} — ${t('profile.org_slug_warning')}`
                : t('profile.org_slug_warning')
            }
          />
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
        <FieldRow label={`${t('profile.org_refes_id', 'Establecimiento (REFES)')}:`} variant="stacked">
          <RefesSearch
            value={orgRefesId}
            onChange={handleRefesChange}
            description={t(
              'profile.org_refes_id_description',
              'Establecimiento del Registro Federal de Establecimientos de Salud (REFES) donde se brinda la atención'
            )}
          />
        </FieldRow>
        <FieldRow label={`${t('profile.org_logo')}:`} variant="stacked">
          <Flex align="center" gap="sm">
            {orgLogoUrl && <Image src={orgLogoUrl} alt="Logo" h={32} w="auto" fit="contain" />}
            <FileInput
              accept="image/*"
              placeholder={orgLogoUrl ? t('profile.org_logo_change') : t('profile.org_logo_upload')}
              description={orgLogoUrl || undefined}
              leftSection={<UploadIcon size={16} />}
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
                        slug: orgSlug,
                        address: orgAddress,
                        phone: orgPhone,
                        email: orgEmail,
                        logoUrl: url,
                        refesId: orgRefesId,
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
                !slugValid ||
                (orgName === currentOrg.name &&
                  orgSlug === currentOrg.slug &&
                  orgAddress === (currentOrg.settings?.healthCenter?.address || '') &&
                  orgPhone === (currentOrg.settings?.healthCenter?.phone || '') &&
                  orgEmail === (currentOrg.settings?.healthCenter?.email || '') &&
                  orgLogoUrl === (currentOrg.settings?.healthCenter?.logoUrl || '') &&
                  orgRefesId === (currentOrg.settings?.refesId || ''))
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
