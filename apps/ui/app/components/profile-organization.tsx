import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button, Group, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useFetcher, useRevalidator } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';

import type { action } from '~/routes/profile.organization';
import Portal from '~/components/portal';
import { FormCard, FieldRow, StyledTextInput, SectionTitle, FormHeader } from '~/components/forms/styles';
import { useGet, useMutation } from '~/components/provider';

type Provider = 'openai' | 'anthropic';

interface ProfileOrganizationProps {
  currentOrg: { id: string; name: string; slug: string; settings?: Record<string, any> };
  showFormActions: boolean;
}

export function ProfileOrganization({ currentOrg, showFormActions }: ProfileOrganizationProps) {
  const { t } = useTranslation();
  const revalidator = useRevalidator();
  const orgFetcher = useFetcher<typeof action>();
  const { data: providerKeyStatus } = useGet('llm-provider-keys', 'current');
  const { create: loadModels, isLoading: isLoadingModels } = useMutation('llm-models');
  const [orgName, setOrgName] = useState(currentOrg.name);
  const [provider, setProvider] = useState<Provider>(
    currentOrg.settings?.llmChat?.preferredProvider === 'anthropic' ? 'anthropic' : 'openai'
  );
  const [model, setModel] = useState<string | null>(currentOrg.settings?.llmChat?.model || null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [providerApiKey, setProviderApiKey] = useState('');
  const [modelsMessage, setModelsMessage] = useState('');
  const [modelsReloadTick, setModelsReloadTick] = useState(0);

  const lastHandledData = useRef(orgFetcher.data);
  const loadModelsRef = useRef(loadModels);

  useEffect(() => {
    loadModelsRef.current = loadModels;
  }, [loadModels]);

  useEffect(() => {
    if (orgFetcher.data === lastHandledData.current) return;
    lastHandledData.current = orgFetcher.data;

    if (orgFetcher.data?.ok && orgFetcher.data.intent === 'update-organization') {
      notifications.show({ message: t('profile.org_saved'), color: 'green' });
      revalidator.revalidate();
    }
    if (orgFetcher.data?.ok && orgFetcher.data.intent === 'save-llm-provider-key') {
      notifications.show({ message: t('llm_settings.provider_key_saved'), color: 'green' });
      revalidator.revalidate();
      setProviderApiKey('');
      setModelsReloadTick(prev => prev + 1);
    }
    if (orgFetcher.data?.ok && orgFetcher.data.intent === 'remove-llm-provider-key') {
      notifications.show({ message: t('llm_settings.provider_key_removed'), color: 'green' });
      revalidator.revalidate();
      setModelsReloadTick(prev => prev + 1);
    }
    if (orgFetcher.data?.ok && orgFetcher.data.intent === 'update-llm-chat-settings') {
      notifications.show({ message: t('llm_settings.defaults_saved'), color: 'green' });
      revalidator.revalidate();
    }
    if (orgFetcher.data && !orgFetcher.data.ok && orgFetcher.data.intent === 'update-organization') {
      notifications.show({ message: t('profile.org_save_error'), color: 'red' });
    }
    if (
      orgFetcher.data &&
      !orgFetcher.data.ok &&
      ['save-llm-provider-key', 'remove-llm-provider-key', 'update-llm-chat-settings'].includes(
        String(orgFetcher.data.intent)
      )
    ) {
      notifications.show({ message: t('llm_settings.save_error'), color: 'red' });
    }
  }, [orgFetcher.data, revalidator, t]);

  const handleOrgNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setOrgName(e.currentTarget.value);
  }, []);

  const handleSaveOrg = useCallback(() => {
    orgFetcher.submit({ intent: 'update-organization', orgId: currentOrg.id, name: orgName }, { method: 'post' });
  }, [currentOrg.id, orgName, orgFetcher]);

  const handleProviderChange = useCallback((value: string | null) => {
    if (value === 'openai' || value === 'anthropic') {
      setProvider(value);
      setModel(null);
      setAvailableModels([]);
    }
  }, []);

  const handleModelChange = useCallback((value: string | null) => {
    setModel(value);
  }, []);

  const handleProviderApiKeyChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setProviderApiKey(e.currentTarget.value);
  }, []);

  const handleSaveProviderKey = useCallback(() => {
    orgFetcher.submit(
      { intent: 'save-llm-provider-key', provider, apiKey: providerApiKey },
      { method: 'post' }
    );
  }, [orgFetcher, provider, providerApiKey]);

  const handleRemoveProviderKey = useCallback(() => {
    orgFetcher.submit({ intent: 'remove-llm-provider-key', provider }, { method: 'post' });
  }, [orgFetcher, provider]);

  useEffect(() => {
    let cancelled = false;

    const loadModelsForProvider = async () => {
      try {
        const result = await loadModelsRef.current({
          provider,
        });
        if (cancelled) return;
        const models = Array.isArray((result as any)?.models)
          ? (result as any).models.map((item: any) => String(item))
          : [];
        setAvailableModels(models);
        const storageKey = `llm-chat-model:${currentOrg.id}:${provider}`;
        const storedModel =
          typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
        const defaultOrgModel = currentOrg.settings?.llmChat?.model
          ? String(currentOrg.settings.llmChat.model)
          : null;

        let nextModel: string | null = null;
        if (storedModel && models.includes(storedModel)) {
          nextModel = storedModel;
        } else if (defaultOrgModel && models.includes(defaultOrgModel)) {
          nextModel = defaultOrgModel;
        } else if (models.length > 0) {
          nextModel = models[0];
        }

        setModel(nextModel);
        setModelsMessage(
          models.length > 0 ? t('llm_settings.models_available', { count: models.length }) : t('llm_settings.no_models_returned')
        );
      } catch (_error) {
        if (cancelled) return;
        setAvailableModels([]);
        setModel(null);
        setModelsMessage(t('llm_settings.could_not_load_models'));
      }
    };

    loadModelsForProvider();

    return () => {
      cancelled = true;
    };
  }, [currentOrg.id, currentOrg.settings?.llmChat?.model, modelsReloadTick, provider, t]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storageKey = `llm-chat-model:${currentOrg.id}:${provider}`;
    if (!model) return;
    window.localStorage.setItem(storageKey, model);
  }, [currentOrg.id, model, provider]);

  const handleSaveLlmDefaults = useCallback(() => {
    orgFetcher.submit(
      {
        intent: 'update-llm-chat-settings',
        orgId: currentOrg.id,
        provider,
        model: model || '',
      },
      { method: 'post' }
    );
  }, [currentOrg.id, model, orgFetcher, provider]);

  const activeProviderConfigured = useMemo(() => {
    const providers = Array.isArray((providerKeyStatus as any)?.providers)
      ? (providerKeyStatus as any).providers
      : [];
    const active = providers.find((item: any) => item.provider === provider);
    return Boolean(active?.configured);
  }, [providerKeyStatus, provider]);

  const hasOrgSettingsChanges = useMemo(() => {
    const initialProvider =
      currentOrg.settings?.llmChat?.preferredProvider === 'anthropic' ? 'anthropic' : 'openai';
    const initialModel = currentOrg.settings?.llmChat?.model || null;
    return provider !== initialProvider || model !== initialModel;
  }, [currentOrg.settings, model, provider]);

  return (
    <>
      <FormHeader>
        <SectionTitle icon={<Building2 />}>
          {t('profile.tab_organization')}
        </SectionTitle>
      </FormHeader>
      <FormCard>
        <FieldRow label={`${t('profile.org_name')}:`} variant="stacked">
          <StyledTextInput value={orgName} onChange={handleOrgNameChange} />
        </FieldRow>
        <FieldRow label={`${t('llm_settings.ai_provider')}:`} variant="stacked">
          <Select
            value={provider}
            onChange={handleProviderChange}
            data={[
              { value: 'openai', label: 'OpenAI' },
              { value: 'anthropic', label: 'Anthropic' },
            ]}
          />
        </FieldRow>
        <FieldRow label={`${t('llm_settings.provider_api_key')}:`} variant="stacked">
          <Stack gap="xs">
            <StyledTextInput
              value={providerApiKey}
              onChange={handleProviderApiKeyChange}
              placeholder={t('llm_settings.provider_key_placeholder')}
              type="password"
            />
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                onClick={handleSaveProviderKey}
                loading={orgFetcher.state === 'submitting' && orgFetcher.formData?.get('intent') === 'save-llm-provider-key'}
                disabled={!providerApiKey.trim()}
              >
                {t('llm_settings.save_key')}
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={handleRemoveProviderKey}
                loading={orgFetcher.state === 'submitting' && orgFetcher.formData?.get('intent') === 'remove-llm-provider-key'}
              >
                {t('llm_settings.remove_key')}
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              {t('llm_settings.key_configured_status', {
                provider,
                status: activeProviderConfigured ? t('common.yes') : t('common.no'),
              })}
            </Text>
          </Stack>
        </FieldRow>
        <FieldRow label={`${t('llm_settings.ai_model')}:`} variant="stacked">
          <Stack gap="xs">
            <Select
              value={model}
              onChange={handleModelChange}
              data={availableModels.map(item => ({ value: item, label: item }))}
              placeholder={isLoadingModels ? t('llm_settings.loading_models') : t('llm_settings.no_models_available')}
              searchable
              clearable
              disabled={isLoadingModels}
            />
            {modelsMessage && (
              <Text size="xs" c="dimmed">
                {modelsMessage}
              </Text>
            )}
          </Stack>
        </FieldRow>
      </FormCard>
      <Portal id="form-actions">
        {showFormActions && (
          <Group>
            <Button
              size="sm"
              onClick={handleSaveOrg}
              loading={orgFetcher.state === 'submitting' && orgFetcher.formData?.get('intent') === 'update-organization'}
              disabled={orgName === currentOrg.name || !orgName.trim()}
            >
              {t('profile.save_organization')}
            </Button>
            <Button
              size="sm"
              variant="light"
              onClick={handleSaveLlmDefaults}
              loading={orgFetcher.state === 'submitting' && orgFetcher.formData?.get('intent') === 'update-llm-chat-settings'}
              disabled={!hasOrgSettingsChanges}
            >
              {t('llm_settings.save_ai_defaults')}
            </Button>
          </Group>
        )}
      </Portal>
    </>
  );
}
