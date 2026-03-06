import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { json, redirect, type ActionFunctionArgs } from '@remix-run/node';
import { useFetcher, useRevalidator, useRouteLoaderData } from '@remix-run/react';
import { Button, Group, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { mutate as swrMutate } from 'swr';
import { Bot } from 'lucide-react';

import { getAuthenticatedClient } from '~/utils/auth.server';
import type { loader as settingsLoader } from '~/routes/settings';
import { FormCard, FieldRow, StyledTextInput, SectionTitle, FormHeader } from '~/components/forms/styles';
import { useGet, useMutation } from '~/components/provider';

type Provider = 'openai' | 'anthropic' | 'lmstudio';

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');

  let client;
  try {
    const authenticated = await getAuthenticatedClient(request);
    client = authenticated.client;
  } catch (error) {
    throw redirect('/login');
  }

  try {
    if (intent === 'save-llm-provider-key') {
      const provider = String(formData.get('provider') || '');
      const apiKey = String(formData.get('apiKey') || '');
      await client.service('llm-api-keys').create({ provider, apiKey });
      return json({ ok: true, intent });
    }

    if (intent === 'remove-llm-provider-key') {
      const provider = String(formData.get('provider') || '');
      await client.service('llm-api-keys').remove(provider);
      return json({ ok: true, intent });
    }

    if (intent === 'update-llm-chat-settings') {
      const orgId = String(formData.get('orgId') || '');
      const provider = String(formData.get('provider') || '');
      const model = String(formData.get('model') || '');
      const lmStudioBaseUrl = String(formData.get('lmStudioBaseUrl') || '');
      const org = await client.service('organizations').get(orgId);
      const settings = { ...((org as any)?.settings || {}) };
      settings.llmChat = {
        preferredProvider: provider || undefined,
        model: model || undefined,
        lmStudioBaseUrl: lmStudioBaseUrl || undefined,
      };
      await client.service('organizations').patch(orgId, { settings });
      return json({ ok: true, intent });
    }

    return json({ ok: false, intent, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error(`[settings.assistant] action "${intent}" failed:`, error?.message || error);
    return json({ ok: false, intent, error: error?.message || 'Operation failed' }, { status: 400 });
  }
};

export default function SettingsAssistantRoute() {
  const parentData = useRouteLoaderData<typeof settingsLoader>('routes/settings');
  const { t } = useTranslation();
  const revalidator = useRevalidator();
  const fetcher = useFetcher<typeof action>();
  const { data: providerKeyStatus } = useGet('llm-api-keys', 'current');
  const { create: loadModels, isLoading: isLoadingModels } = useMutation('llm-models');
  const lastHandledData = useRef(fetcher.data);
  const loadModelsRef = useRef(loadModels);

  const currentOrg = parentData?.currentOrg;

  const initialProvider = (['openai', 'anthropic', 'lmstudio'] as Provider[]).includes(
    currentOrg?.settings?.llmChat?.preferredProvider
  )
    ? (currentOrg?.settings?.llmChat?.preferredProvider as Provider)
    : 'lmstudio';
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [model, setModel] = useState<string | null>(currentOrg?.settings?.llmChat?.model || null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [providerApiKey, setProviderApiKey] = useState('');
  const [lmStudioBaseUrl, setLmStudioBaseUrl] = useState(
    currentOrg?.settings?.llmChat?.lmStudioBaseUrl || 'http://localhost:1234/v1'
  );
  const [modelsMessage, setModelsMessage] = useState('');
  const [modelsReloadTick, setModelsReloadTick] = useState(0);

  useEffect(() => {
    loadModelsRef.current = loadModels;
  }, [loadModels]);

  useEffect(() => {
    if (fetcher.data === lastHandledData.current) return;
    lastHandledData.current = fetcher.data;

    if (fetcher.data?.ok && fetcher.data.intent === 'save-llm-provider-key') {
      notifications.show({ message: t('llm_settings.provider_key_saved'), color: 'green' });
      revalidator.revalidate();
      swrMutate((key: unknown) => Array.isArray(key) && key[0] === 'llm-api-keys');
      setProviderApiKey('');
      setModelsReloadTick(prev => prev + 1);
    }
    if (fetcher.data?.ok && fetcher.data.intent === 'remove-llm-provider-key') {
      notifications.show({ message: t('llm_settings.provider_key_removed'), color: 'green' });
      revalidator.revalidate();
      swrMutate((key: unknown) => Array.isArray(key) && key[0] === 'llm-api-keys');
      setModelsReloadTick(prev => prev + 1);
    }
    if (fetcher.data?.ok && fetcher.data.intent === 'update-llm-chat-settings') {
      notifications.show({ message: t('llm_settings.defaults_saved'), color: 'green' });
      revalidator.revalidate();
    }
    if (
      fetcher.data &&
      !fetcher.data.ok &&
      ['save-llm-provider-key', 'remove-llm-provider-key', 'update-llm-chat-settings'].includes(
        String(fetcher.data.intent)
      )
    ) {
      const errorMsg = (fetcher.data as any)?.error;
      console.error(`[settings.assistant] ${fetcher.data.intent} error:`, errorMsg);
      notifications.show({
        message: errorMsg ? `${t('llm_settings.save_error')}: ${errorMsg}` : t('llm_settings.save_error'),
        color: 'red',
      });
    }
  }, [fetcher.data, revalidator, t]);

  useEffect(() => {
    if (!currentOrg) return;
    let cancelled = false;

    const loadModelsForProvider = async () => {
      try {
        const result = await loadModelsRef.current({ provider });
        if (cancelled) return;
        const models = Array.isArray((result as any)?.models)
          ? (result as any).models.map((item: any) => String(item))
          : [];
        setAvailableModels(models);
        const storageKey = `llm-chat-model:${currentOrg.id}:${provider}`;
        const storedModel = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
        const defaultOrgModel = currentOrg.settings?.llmChat?.model ? String(currentOrg.settings.llmChat.model) : null;

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
          models.length > 0
            ? t('llm_settings.models_available', { count: models.length })
            : t('llm_settings.no_models_returned')
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
  }, [currentOrg, modelsReloadTick, provider, t]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentOrg) return;
    const storageKey = `llm-chat-model:${currentOrg.id}:${provider}`;
    if (!model) return;
    window.localStorage.setItem(storageKey, model);
  }, [currentOrg, model, provider]);

  const handleProviderChange = useCallback((value: string | null) => {
    if (value === 'openai' || value === 'anthropic' || value === 'lmstudio') {
      setProvider(value);
      setModel(null);
      setAvailableModels([]);
    }
  }, []);

  const handleSaveProviderKey = useCallback(() => {
    fetcher.submit({ intent: 'save-llm-provider-key', provider, apiKey: providerApiKey }, { method: 'post' });
  }, [fetcher, provider, providerApiKey]);

  const handleRemoveProviderKey = useCallback(() => {
    fetcher.submit({ intent: 'remove-llm-provider-key', provider }, { method: 'post' });
  }, [fetcher, provider]);

  const handleSaveLlmDefaults = useCallback(() => {
    if (!currentOrg) return;
    fetcher.submit(
      {
        intent: 'update-llm-chat-settings',
        orgId: currentOrg.id,
        provider,
        model: model || '',
        lmStudioBaseUrl: provider === 'lmstudio' ? lmStudioBaseUrl : '',
      },
      { method: 'post' }
    );
  }, [currentOrg, fetcher, lmStudioBaseUrl, model, provider]);

  const activeProviderInfo = useMemo(() => {
    const providers = Array.isArray((providerKeyStatus as any)?.providers) ? (providerKeyStatus as any).providers : [];
    const active = providers.find((item: any) => item.provider === provider);
    const configured = Boolean(active?.configured);
    let maskedKey = '';
    if (configured && active?.keyHint) {
      const [lengthStr, last4] = String(active.keyHint).split('-');
      const len = parseInt(lengthStr, 10);
      if (!isNaN(len) && last4) {
        maskedKey = '*'.repeat(Math.max(len - 4, 4)) + last4;
      }
    }
    return { configured, maskedKey };
  }, [providerKeyStatus, provider]);

  const hasOrgSettingsChanges = useMemo(() => {
    const savedProvider = (['openai', 'anthropic', 'lmstudio'] as Provider[]).includes(
      currentOrg?.settings?.llmChat?.preferredProvider
    )
      ? (currentOrg?.settings?.llmChat?.preferredProvider as Provider)
      : 'lmstudio';
    const savedModel = currentOrg?.settings?.llmChat?.model || null;
    const savedUrl = currentOrg?.settings?.llmChat?.lmStudioBaseUrl || 'http://localhost:1234/v1';
    return provider !== savedProvider || model !== savedModel || lmStudioBaseUrl !== savedUrl;
  }, [currentOrg?.settings, lmStudioBaseUrl, model, provider]);

  if (!parentData?.isOrgOwner || !currentOrg) return null;

  return (
    <>
      <FormHeader>
        <SectionTitle icon={<Bot />}>{t('profile.tab_assistant')}</SectionTitle>
      </FormHeader>
      <FormCard>
        <FieldRow label={`${t('llm_settings.ai_provider')}:`} variant="stacked">
          <Select
            value={provider}
            onChange={handleProviderChange}
            variant="unstyled"
            data={[
              { value: 'lmstudio', label: 'LM Studio' },
              { value: 'openai', label: 'OpenAI' },
              { value: 'anthropic', label: 'Anthropic' },
            ]}
          />
        </FieldRow>
        {provider === 'lmstudio' && (
          <FieldRow label={`${t('llm_settings.lm_studio_url')}:`} variant="stacked">
            <StyledTextInput
              value={lmStudioBaseUrl}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setLmStudioBaseUrl(e.currentTarget.value)}
              placeholder="http://localhost:1234/v1"
            />
          </FieldRow>
        )}
        {provider !== 'lmstudio' && (
          <FieldRow label={`${t('llm_settings.provider_api_key')}:`} variant="stacked">
            <Stack gap="xs">
              <StyledTextInput
                value={providerApiKey}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setProviderApiKey(e.currentTarget.value)}
                placeholder={
                  activeProviderInfo.configured
                    ? activeProviderInfo.maskedKey || '••••••••••••••••'
                    : t('llm_settings.provider_key_placeholder')
                }
                type="password"
              />
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  onClick={handleSaveProviderKey}
                  loading={
                    fetcher.state === 'submitting' && fetcher.formData?.get('intent') === 'save-llm-provider-key'
                  }
                  disabled={!providerApiKey.trim()}
                >
                  {t('llm_settings.save_key')}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={handleRemoveProviderKey}
                  loading={
                    fetcher.state === 'submitting' && fetcher.formData?.get('intent') === 'remove-llm-provider-key'
                  }
                >
                  {t('llm_settings.remove_key')}
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                {t('llm_settings.key_configured_status', {
                  provider,
                  status: activeProviderInfo.configured ? t('common.yes') : t('common.no'),
                })}
              </Text>
            </Stack>
          </FieldRow>
        )}
        <FieldRow label={`${t('llm_settings.ai_model')}:`} variant="stacked">
          <Stack gap="xs">
            <Select
              value={model}
              onChange={(value: string | null) => setModel(value)}
              data={availableModels.map(item => ({ value: item, label: item }))}
              placeholder={isLoadingModels ? t('llm_settings.loading_models') : t('llm_settings.no_models_available')}
              searchable
              clearable
              disabled={isLoadingModels}
              variant="unstyled"
            />
            {modelsMessage && (
              <Text size="xs" c="dimmed">
                {modelsMessage}
              </Text>
            )}
          </Stack>
        </FieldRow>
        <FieldRow label="" variant="stacked">
          <Button
            size="sm"
            variant="light"
            onClick={handleSaveLlmDefaults}
            loading={fetcher.state === 'submitting' && fetcher.formData?.get('intent') === 'update-llm-chat-settings'}
            disabled={!hasOrgSettingsChanges}
          >
            {t('llm_settings.save_ai_defaults')}
          </Button>
        </FieldRow>
      </FormCard>
    </>
  );
}
