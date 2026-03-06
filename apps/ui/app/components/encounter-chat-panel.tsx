import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Badge, Box, Button, Group, Loader, Paper, Stack, Text, Textarea, Title } from '@mantine/core';
import { useClickOutside, useMediaQuery } from '@mantine/hooks';
import { useNavigate } from '@remix-run/react';
import { Bot, ChevronDown, Copy, ExternalLink, X, ArrowDownRight } from 'lucide-react';
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
  patientId: string;
  role: Role;
  content: string;
  model?: string | null;
  suggestions?: ChatMessage['suggestions'] | null;
  createdAt?: string;
}

interface EncounterChatPanelProps {
  patientId: string;
  patientName: string;
  accentColor: string;
  encounterDraft: Record<string, any>;
  isActive: boolean;
  onMinimize: () => void;
  onClose: () => void;
}

const CARD_WIDTH = 280;

function SuggestionCard({ item }: { item: Suggestion }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const cardRef = useClickOutside(() => setExpanded(false));
  const handleCopy = useCallback(async (text: string) => {
    if (!navigator?.clipboard) return;
    await navigator.clipboard.writeText(text);
  }, []);

  return (
    <Box
      ref={cardRef}
      style={{
        width: CARD_WIDTH,
        minWidth: CARD_WIDTH,
        flexShrink: 0,
        scrollSnapAlign: 'start',
        position: 'relative',
        alignSelf: 'flex-end',
      }}
    >
      <Paper
        withBorder
        p={8}
        radius="md"
        bg="white"
        onClick={expanded ? () => setExpanded(false) : undefined}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: CARD_WIDTH,
          zIndex: expanded ? 10 : 0,
          cursor: expanded ? 'pointer' : undefined,
          transform: expanded ? 'scale(1.1)' : 'scale(1)',
          transformOrigin: 'bottom left',
          transition: expanded
            ? 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease'
            : 'transform 250ms ease, box-shadow 200ms ease',
        }}
      >
        <Group justify="space-between" align="start" wrap="nowrap" gap={2}>
          <Text fw={500} size="xs" lineClamp={expanded ? undefined : 1} style={{ flex: 1, minWidth: 0 }}>
            {item.title}
          </Text>
          <ActionIcon
            size={16}
            variant="subtle"
            color="gray"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              handleCopy(`${item.title}: ${item.detail}`);
            }}
            style={{ flexShrink: 0 }}
          >
            <Copy size={10} />
          </ActionIcon>
        </Group>
        {typeof item.confidence === 'number' && (
          <Badge variant="light" color="blue" size="xs" mt={2}>
            {Math.round(item.confidence * 100)}%
          </Badge>
        )}
        {item.detail && (
          <Box
            mt={4}
            style={{
              overflow: 'hidden',
              transition: 'max-height 250ms ease',
              maxHeight: expanded ? 500 : 36,
            }}
          >
            <Text size="xs" c="dimmed">
              {item.detail}
            </Text>
          </Box>
        )}
        {!expanded && item.detail && (
          <Text size="xs" c="blue" mt={2} style={{ cursor: 'pointer' }} onClick={() => setExpanded(true)}>
            {t('ai_chat.read_more', 'Ver más')} <ChevronDown size={10} style={{ verticalAlign: 'middle' }} />
          </Text>
        )}
      </Paper>
    </Box>
  );
}

function SuggestionsCarousel({ tabs }: { tabs: { label: string; items: Suggestion[] }[] }) {
  const activeTabs = tabs.filter(t => t.items.length > 0);
  if (!activeTabs.length) return null;

  return (
    <Box
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        overflowY: 'visible',
        scrollSnapType: 'x mandatory',
        scrollPaddingInlineStart: '1rem',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        paddingTop: 200,
        marginTop: -60,
        paddingBottom: 4,
        paddingInline: '1rem',
        alignItems: 'flex-end',
        marginLeft: '-1rem',
        width: 'calc(100% + 2rem)',
      }}
    >
      {activeTabs.map(tab => (
        <Box
          key={tab.label}
          style={{
            flexShrink: 0,
            scrollSnapAlign: 'start',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <Text
            size="10px"
            fw={700}
            c="dimmed"
            tt="uppercase"
            px={2}
            style={{ letterSpacing: '0.05em', position: 'relative', top: -120 }}
          >
            {tab.label}
          </Text>
          <Box style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            {tab.items.map((item, i) => (
              <SuggestionCard key={`${tab.label}-${item.title}-${i}`} item={item} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function EncounterChatPanel({
  patientId,
  patientName,
  accentColor,
  encounterDraft,
  isActive,
  onMinimize,
  onClose,
}: EncounterChatPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = useFeathers();
  const { create, isLoading, error } = useMutation('encounter-ai-chat');
  const { create: loadModels } = useMutation('llm-models');
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

      if (ordered.length) {
        // If the last message is from the user, the server may still be
        // processing the LLM response. Show a thinking indicator — the
        // real-time listener below will replace it when the response arrives.
        if (ordered[ordered.length - 1].role === 'user') {
          setMessages([
            ...ordered,
            { id: 'msg-pending', role: 'assistant' as Role, content: t('ai_chat.thinking'), isThinking: true },
          ]);
        } else {
          setMessages(ordered);
        }
      } else {
        setMessages([
          {
            id: 'msg-0',
            role: 'assistant',
            content: t('ai_chat.initial_message'),
            isLocalOnly: true,
          },
        ]);
      }
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

      const assistantMessage = String(result?.message || t('ai_chat.no_response'));
      const assistantModel = String((result as any)?.meta?.model || '');
      const persistedAssistantId = String((result as any)?.meta?.persistedMessageId || thinkingId);
      const assistantSuggestions = {
        differentials: Array.isArray(result?.differentials) ? result.differentials : [],
        suggestedNextSteps: Array.isArray(result?.suggestedNextSteps) ? result.suggestedNextSteps : [],
        treatmentIdeas: Array.isArray(result?.treatmentIdeas) ? result.treatmentIdeas : [],
        warnings: Array.isArray(result?.warnings) ? result.warnings : [],
        rationale: String(result?.rationale || ''),
        confidence: typeof result?.confidence === 'number' ? result.confidence : 0,
        citations: Array.isArray(result?.citations) ? result.citations : [],
      };

      setMessages(previous =>
        previous.map(message =>
          message.id === thinkingId
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

  const handleDraftChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftMessage(event.currentTarget.value);
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
        boxShadow: '0 1px 2px rgba(0,0,0,0.075), 0 8px 32px rgba(0,0,0,0.075), 0 24px 48px rgba(0,0,0,0.075)',
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
        bg={`${accentColor}.5`}
        style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
      >
        <Group gap="xs" align="center" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Bot size={20} color="white" style={{ flexShrink: 0 }} />
          <Title size="h4" c="white" lineClamp={1}>
            {patientName}
          </Title>
        </Group>
        <Group gap={4}>
          <ActionIcon variant="subtle" color="white" onClick={onMinimize} aria-label={t('ai_chat.minimize_assistant')}>
            <ArrowDownRight size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="white" onClick={onClose} aria-label={t('ai_chat.close', 'Cerrar')}>
            <X size={16} />
          </ActionIcon>
        </Group>
      </Group>

      <Stack gap={0} style={{ flex: 1, minHeight: 0 }}>
        <Group px="md" py={6} style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <Button
            variant="subtle"
            color="gray"
            size="compact-xs"
            rightSection={<ExternalLink size={12} />}
            onClick={() => navigate(`/encounters/${patientId}`)}
            style={{ flex: 1 }}
          >
            {t('ai_chat.view_encounters', 'Ver encuentros')}
          </Button>
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
                <SuggestionsCarousel
                  tabs={[
                    { label: t('ai_chat.differentials'), items: message.suggestions.differentials },
                    { label: t('ai_chat.suggested_next_steps'), items: message.suggestions.suggestedNextSteps },
                    { label: t('ai_chat.treatment_ideas'), items: message.suggestions.treatmentIdeas },
                  ]}
                />
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
