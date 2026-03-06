import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Copy, Minimize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useFeathers, useMutation, useOrganization } from '~/components/provider';
import { media } from '~/media';

type Role = 'assistant' | 'user';
const CHAT_PAGE_SIZE = 20;
interface Suggestion {
  title: string;
  detail: string;
  confidence?: number;
}

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  model?: string | null;
  fullContent?: string;
  isStreaming?: boolean;
  isThinking?: boolean;
  isLocalOnly?: boolean;
  suggestions?: {
    differentials: Suggestion[];
    suggestedNextSteps: Suggestion[];
    treatmentIdeas: Suggestion[];
    warnings: string[];
    rationale: string;
    confidence: number;
    citations: string[];
  };
}

interface PersistedChatMessage {
  id: string;
  role: Role;
  content: string;
  model?: string | null;
  suggestions?: ChatMessage['suggestions'] | null;
  createdAt?: string;
}

interface EncounterChatPanelProps {
  patientId: string;
  encounterDraft: Record<string, any>;
  isActive: boolean;
  onMinimize: () => void;
}

function SuggestionGroup({ title, items }: { title: string; items: Suggestion[] }) {
  const { t } = useTranslation();
  const handleCopy = useCallback(async (text: string) => {
    if (!navigator?.clipboard) return;
    await navigator.clipboard.writeText(text);
  }, []);

  if (!items.length) return null;

  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        {title}
      </Text>
      {items.map((item, index) => (
        <Paper key={`${item.title}-${index}`} withBorder p="sm" radius="md">
          <Group justify="space-between" align="start" wrap="nowrap">
            <Stack gap={4} style={{ flex: 1 }}>
              <Text fw={500} size="sm">
                {item.title}
              </Text>
              <Text size="sm" c="dimmed">
                {item.detail}
              </Text>
              {typeof item.confidence === 'number' && (
                <Badge variant="light" color="blue" w="fit-content">
                  {t('ai_chat.confidence')}: {Math.round(item.confidence * 100)}%
                </Badge>
              )}
            </Stack>
            <Button
              size="xs"
              variant="subtle"
              leftSection={<Copy size={12} />}
              onClick={() => handleCopy(`${item.title}: ${item.detail}`)}
            >
              {t('ai_chat.copy')}
            </Button>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}

export function EncounterChatPanel({ patientId, encounterDraft, isActive, onMinimize }: EncounterChatPanelProps) {
  const { t } = useTranslation();
  const client = useFeathers();
  const { create, isLoading, error } = useMutation('encounter-ai-chat');
  const { create: loadModels, isLoading: isLoadingModels } = useMutation('llm-models');
  const { currentOrganizationId } = useOrganization();
  const loadModelsRef = useRef(loadModels);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messageIdRef = useRef(0);
  const isPrependingHistoryRef = useRef(false);
  const hasLoadedHistoryRef = useRef(false);
  const hasLoadedModelsRef = useRef(false);
  const isDesktop = useMediaQuery(media.md);
  const [draftMessage, setDraftMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsProvider, setModelsProvider] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<{ id: string; fullContent: string } | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-0',
      role: 'assistant',
      content: t('ai_chat.initial_message'),
      isLocalOnly: true,
    },
  ]);

  const nextMessageId = useCallback(() => {
    messageIdRef.current += 1;
    return `msg-${messageIdRef.current}`;
  }, []);

  const toChatMessage = useCallback((record: PersistedChatMessage): ChatMessage => {
    return {
      id: String(record.id),
      role: record.role,
      content: String(record.content || ''),
      model: record.model ? String(record.model) : null,
      suggestions: record.suggestions || undefined,
    };
  }, []);

  const mergeUniqueById = useCallback((items: ChatMessage[]): ChatMessage[] => {
    const seen = new Set<string>();
    return items.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, []);

  const appendMessage = useCallback(
    (message: ChatMessage) => {
      setMessages(previous => {
        const withoutLocalOnly = previous.filter(item => !item.isLocalOnly);
        return mergeUniqueById([...withoutLocalOnly, message]);
      });
    },
    [mergeUniqueById]
  );

  const requestMessages = useMemo(
    () =>
      messages
        .filter(message => !message.isThinking && !message.isLocalOnly)
        .map(message => ({ role: message.role, content: message.fullContent || message.content })),
    [messages]
  );

  const fetchHistory = useCallback(
    async (before?: string) => {
      const response = await client.service('encounter-ai-chat-messages').find({
        query: {
          patientId,
          $limit: CHAT_PAGE_SIZE,
          $sort: { createdAt: -1 },
          ...(before ? { createdAt: { $lt: before } } : {}),
        },
      } as any);

      const page = Array.isArray(response) ? response : (response as any)?.data || [];
      const rows = page as PersistedChatMessage[];
      const nextOldest = rows.length ? String(rows[rows.length - 1]?.createdAt || '') : '';
      return {
        rows,
        nextOldest: nextOldest || null,
        hasMore: rows.length === CHAT_PAGE_SIZE,
      };
    },
    [client, patientId]
  );

  const loadInitialHistory = useCallback(async () => {
    if (!isDesktop || !isActive || !patientId || hasLoadedHistoryRef.current) return;
    hasLoadedHistoryRef.current = true;
    setIsHistoryLoading(true);
    try {
      const { rows, nextOldest, hasMore } = await fetchHistory();
      const ordered = rows.slice().reverse().map(toChatMessage);
      setMessages(
        ordered.length
          ? ordered
          : [
              {
                id: 'msg-0',
                role: 'assistant',
                content: t('ai_chat.initial_message'),
                isLocalOnly: true,
              },
            ]
      );
      setOldestCursor(nextOldest);
      setHasMoreHistory(hasMore);
    } catch (_error) {
      hasLoadedHistoryRef.current = false;
      setMessages([
        {
          id: 'msg-0',
          role: 'assistant',
          content: t('ai_chat.initial_message'),
          isLocalOnly: true,
        },
      ]);
      setOldestCursor(null);
      setHasMoreHistory(false);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [fetchHistory, isDesktop, isActive, patientId, t, toChatMessage]);

  const loadOlderHistory = useCallback(async () => {
    if (!isActive || !oldestCursor || isLoadingOlder || !hasMoreHistory || !messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const previousHeight = container.scrollHeight;
    const previousTop = container.scrollTop;
    setIsLoadingOlder(true);
    try {
      const { rows, nextOldest, hasMore } = await fetchHistory(oldestCursor);
      if (!rows.length) {
        setHasMoreHistory(false);
        return;
      }
      const older = rows.slice().reverse().map(toChatMessage);
      isPrependingHistoryRef.current = true;
      setMessages(previous => mergeUniqueById([...older, ...previous]));
      setOldestCursor(nextOldest);
      setHasMoreHistory(hasMore);
      window.requestAnimationFrame(() => {
        const current = messagesContainerRef.current;
        if (!current) return;
        current.scrollTop = current.scrollHeight - previousHeight + previousTop;
        isPrependingHistoryRef.current = false;
      });
    } catch (_error) {
      // keep existing messages on transient failures
    } finally {
      setIsLoadingOlder(false);
    }
  }, [fetchHistory, hasMoreHistory, isLoadingOlder, isActive, mergeUniqueById, oldestCursor, toChatMessage]);

  const handleSend = useCallback(async () => {
    const content = draftMessage.trim();
    if (!content || isLoading || !patientId) return;

    let persistedUserMessage: ChatMessage;
    try {
      const saved = await client.service('encounter-ai-chat-messages').create({
        patientId,
        role: 'user',
        content,
      });
      persistedUserMessage = toChatMessage(saved as PersistedChatMessage);
    } catch (_error) {
      persistedUserMessage = { id: nextMessageId(), role: 'user', content };
    }

    appendMessage(persistedUserMessage);

    const thinkingId = nextMessageId();
    appendMessage({ id: thinkingId, role: 'assistant', content: t('ai_chat.thinking'), isThinking: true });
    setDraftMessage('');

    try {
      const result = await create({
        patientId,
        encounterDraft,
        model: selectedModel || undefined,
        preferredProvider: modelsProvider || undefined,
        messages: [...requestMessages, { role: 'user', content }],
      });

      const assistantMessageId = thinkingId;
      const assistantMessage = String(result?.message || t('ai_chat.no_response'));
      const assistantModel = String((result as any)?.meta?.model || '');
      const assistantSuggestions = {
        differentials: Array.isArray(result?.differentials) ? result.differentials : [],
        suggestedNextSteps: Array.isArray(result?.suggestedNextSteps) ? result.suggestedNextSteps : [],
        treatmentIdeas: Array.isArray(result?.treatmentIdeas) ? result.treatmentIdeas : [],
        warnings: Array.isArray(result?.warnings) ? result.warnings : [],
        rationale: String(result?.rationale || ''),
        confidence: typeof result?.confidence === 'number' ? result.confidence : 0,
        citations: Array.isArray(result?.citations) ? result.citations : [],
      };

      let persistedAssistantId = assistantMessageId;
      try {
        const savedAssistant = await client.service('encounter-ai-chat-messages').create({
          patientId,
          role: 'assistant',
          content: assistantMessage,
          model: assistantModel || null,
          suggestions: assistantSuggestions,
        });
        persistedAssistantId = String((savedAssistant as PersistedChatMessage).id || assistantMessageId);
      } catch (_error) {
        // keep temporary message id when persistence fails
      }

      setMessages(previous =>
        previous.map(message =>
          message.id === assistantMessageId
            ? {
                id: persistedAssistantId,
                role: 'assistant',
                content: '',
                model: assistantModel || null,
                fullContent: assistantMessage,
                isStreaming: true,
                isThinking: false,
                suggestions: assistantSuggestions,
              }
            : message
        )
      );
      setStreamingMessage({ id: persistedAssistantId, fullContent: assistantMessage });
    } catch (_error) {
      setMessages(previous =>
        previous.map(message =>
          message.id === thinkingId
            ? {
                id: thinkingId,
                role: 'assistant',
                content: t('ai_chat.request_error'),
                isThinking: false,
              }
            : message
        )
      );
    }
  }, [
    appendMessage,
    client,
    create,
    draftMessage,
    encounterDraft,
    isLoading,
    modelsProvider,
    nextMessageId,
    patientId,
    requestMessages,
    selectedModel,
    t,
    toChatMessage,
  ]);

  const handleDraftChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setDraftMessage(event.currentTarget.value);
  }, []);

  const handleModelChange = useCallback((value: string | null) => {
    setSelectedModel(value);
  }, []);

  const handleTextareaKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) return;
      if (event.key !== 'Enter') return;
      if (event.shiftKey) return;
      event.preventDefault();
      handleSend();
    },
    [handleSend]
  );

  const storageKey = useMemo(() => {
    const orgPart = currentOrganizationId || 'no-org';
    return `encounter-ai-chat-model:${orgPart}`;
  }, [currentOrganizationId]);

  useEffect(() => {
    loadModelsRef.current = loadModels;
  }, [loadModels]);

  useEffect(() => {
    if (!isDesktop || !isActive || hasLoadedModelsRef.current) return;
    hasLoadedModelsRef.current = true;
    let cancelled = false;

    const run = async () => {
      try {
        const result = await loadModelsRef.current({});
        if (cancelled) return;
        const models = Array.isArray((result as any)?.models)
          ? (result as any).models.map((item: any) => String(item))
          : [];
        const defaultModel = (result as any)?.defaultModel ? String((result as any).defaultModel) : null;
        const provider = (result as any)?.provider ? String((result as any).provider) : null;
        setAvailableModels(models);
        setModelsProvider(provider);
        if (!models.length) {
          setSelectedModel(null);
          return;
        }

        const storedModel = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;

        if (storedModel && models.includes(storedModel)) {
          setSelectedModel(storedModel);
          return;
        }

        if (defaultModel && models.includes(defaultModel)) {
          setSelectedModel(defaultModel);
          return;
        }

        setSelectedModel(prev => (prev && models.includes(prev) ? prev : models[0]));
      } catch (_error) {
        if (cancelled) return;
        hasLoadedModelsRef.current = false;
        setAvailableModels([]);
        setSelectedModel(null);
        setModelsProvider(null);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [isDesktop, isActive, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!selectedModel) return;
    window.localStorage.setItem(storageKey, selectedModel);
  }, [selectedModel, storageKey]);

  useEffect(() => {
    loadInitialHistory();
  }, [loadInitialHistory]);

  useEffect(() => {
    if (!streamingMessage) return;
    const tokens = streamingMessage.fullContent.split(/(\s+)/).filter(Boolean);
    if (tokens.length === 0) {
      setMessages(previous =>
        previous.map(message =>
          message.id === streamingMessage.id
            ? {
                ...message,
                content: streamingMessage.fullContent,
                isStreaming: false,
                fullContent: undefined,
              }
            : message
        )
      );
      setStreamingMessage(null);
      return;
    }

    let tokenIndex = 0;
    const intervalId = window.setInterval(() => {
      tokenIndex = Math.min(tokens.length, tokenIndex + 1);
      const nextContent = tokens.slice(0, tokenIndex).join('');
      const isDone = tokenIndex >= tokens.length;
      setMessages(previous =>
        previous.map(message =>
          message.id === streamingMessage.id
            ? {
                ...message,
                content: nextContent,
                isStreaming: !isDone,
                fullContent: isDone ? undefined : message.fullContent,
              }
            : message
        )
      );
      if (isDone) {
        window.clearInterval(intervalId);
        setStreamingMessage(null);
      }
    }, 24);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [streamingMessage]);

  useEffect(() => {
    if (!isActive) return;
    if (isPrependingHistoryRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isActive, messages]);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (container.scrollTop > 40) return;
    loadOlderHistory();
  }, [loadOlderHistory]);

  if (!isDesktop) {
    return null;
  }

  return (
    <Paper
      withBorder
      radius="md"
      style={{
        width: 'min(420px, calc(100vw - 6rem))',
        height: 'min(72vh, 720px)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'white',
      }}
    >
      <Group
        justify="space-between"
        align="center"
        px="md"
        py="sm"
        bg="violet.5"
        style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
      >
        <Group gap="xs" align="center">
          <Title size="h4" c="white">
            {t('ai_chat.title')}
          </Title>
        </Group>
        <ActionIcon
          variant="subtle"
          color="white"
          onClick={onMinimize}
          aria-label={t('ai_chat.minimize_assistant')}
        >
          <Minimize2 size={16} />
        </ActionIcon>
      </Group>

      <Stack gap={0} style={{ flex: 1, minHeight: 0 }}>
        <Group align="end" px="md">
          <Select
            value={selectedModel}
            onChange={handleModelChange}
            data={availableModels.map(model => ({ value: model, label: model }))}
            placeholder={isLoadingModels ? t('ai_chat.loading_models') : t('ai_chat.no_models')}
            searchable
            clearable
            disabled={isLoadingModels || availableModels.length === 0}
            variant="unstyled"
            style={{
              borderBottom: '1px solid var(--mantine-color-gray-2)',
              marginLeft: '-1rem',
              marginRight: '-1rem',
              padding: '.5rem 1rem',
              flex: 1,
            }}
          />
        </Group>
        <Stack
          ref={messagesContainerRef}
          gap="sm"
          px="md"
          pb="md"
          onScroll={handleMessagesScroll}
          style={{
            overflowY: 'auto',
            flex: 1,
            borderBottom: '1px solid var(--mantine-color-gray-2)',
          }}
        >
          {isLoadingOlder && (
            <Group justify="center" pt="xs">
              <Loader size="xs" />
              <Text size="xs" c="dimmed">
                {t('ai_chat.loading_previous_messages')}
              </Text>
            </Group>
          )}
          <Box style={{ marginTop: 'auto' }} />
          {isHistoryLoading && (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          )}
          {messages.map(message => (
            <Box key={message.id}>
              <Paper withBorder p="sm" radius="md" bg={message.role === 'assistant' ? 'gray.0' : 'blue.0'}>
                <Group justify="space-between" align="center" mb={4}>
                  <Text size="sm" fw={600}>
                    {message.role === 'assistant' ? t('ai_chat.assistant') : t('ai_chat.you')}
                  </Text>
                  {message.role === 'assistant' && !!message.model && (
                    <Badge variant="light" color="grape" size="sm">
                      {t('ai_chat.model_badge', { model: message.model })}
                    </Badge>
                  )}
                </Group>
                {message.role === 'assistant' && message.isThinking && (
                  <Group gap="xs">
                    <Loader size="xs" />
                    <Text size="sm" c="dimmed">
                      {t('ai_chat.thinking')}
                    </Text>
                  </Group>
                )}
                {message.role === 'assistant' && (
                  <Box
                    style={{
                      display: message.isThinking ? 'none' : 'block',
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </Box>
                )}
                {message.role === 'user' && <Text size="sm">{message.content}</Text>}
              </Paper>

              {message.suggestions && !message.isStreaming && !message.isThinking && (
                <Stack mt="xs" gap="xs">
                  <SuggestionGroup title={t('ai_chat.differentials')} items={message.suggestions.differentials} />
                  <SuggestionGroup
                    title={t('ai_chat.suggested_next_steps')}
                    items={message.suggestions.suggestedNextSteps}
                  />
                  <SuggestionGroup title={t('ai_chat.treatment_ideas')} items={message.suggestions.treatmentIdeas} />
                </Stack>
              )}
            </Box>
          ))}
        </Stack>

        <Textarea
          value={draftMessage}
          onChange={handleDraftChange}
          onKeyDown={handleTextareaKeyDown}
          minRows={1}
          placeholder={t('ai_chat.ask_placeholder')}
          variant="unstyled"
          autosize
          px="md"
        />
        <Group justify="space-between" align="center" px="md" mb="sm">
          <Text size="xs" c="gray.5">
            {t('ai_chat.assistive_warning')}
          </Text>
        </Group>
        {error && (
          <Text size="xs" c="red">
            {String((error as any)?.message || t('ai_chat.error_requesting_suggestions'))}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
