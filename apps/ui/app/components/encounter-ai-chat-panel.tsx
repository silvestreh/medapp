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
import { Copy, Bot, Minimize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useMutation, useOrganization } from '~/components/provider';
import { media } from '~/media';

type Role = 'assistant' | 'user';
interface Suggestion {
  title: string;
  detail: string;
  confidence?: number;
}

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  fullContent?: string;
  isStreaming?: boolean;
  isThinking?: boolean;
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

interface EncounterAiChatPanelProps {
  patientId: string;
  encounterDraft: Record<string, any>;
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

export function EncounterAiChatPanel({ patientId, encounterDraft }: EncounterAiChatPanelProps) {
  const { t } = useTranslation();
  const { create, isLoading, error } = useMutation('encounter-ai-chat');
  const { create: loadModels, isLoading: isLoadingModels } = useMutation('llm-models');
  const { currentOrganizationId } = useOrganization();
  const loadModelsRef = useRef(loadModels);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messageIdRef = useRef(0);
  const isDesktop = useMediaQuery(media.md);
  const [isOpen, setIsOpen] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<{ id: string; fullContent: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-0',
      role: 'assistant',
      content: t('ai_chat.initial_message'),
    },
  ]);

  const nextMessageId = useCallback(() => {
    messageIdRef.current += 1;
    return `msg-${messageIdRef.current}`;
  }, []);

  const requestMessages = useMemo(
    () =>
      messages
        .filter(message => !message.isThinking)
        .map(message => ({ role: message.role, content: message.fullContent || message.content })),
    [messages]
  );

  const handleSend = useCallback(async () => {
    const content = draftMessage.trim();
    if (!content || isLoading) return;

    const thinkingId = nextMessageId();
    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: nextMessageId(), role: 'user', content },
      { id: thinkingId, role: 'assistant', content: t('ai_chat.thinking'), isThinking: true },
    ];
    setMessages(nextMessages);
    setDraftMessage('');

    try {
      const result = await create({
        patientId,
        encounterDraft,
        model: selectedModel || undefined,
        messages: [...requestMessages, { role: 'user', content }],
      });

      const assistantMessageId = thinkingId;
      const assistantMessage = String(result?.message || t('ai_chat.no_response'));
      setMessages(previous =>
        previous.map(message =>
          message.id === assistantMessageId
            ? {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                fullContent: assistantMessage,
                isStreaming: true,
                isThinking: false,
                suggestions: {
                  differentials: Array.isArray(result?.differentials) ? result.differentials : [],
                  suggestedNextSteps: Array.isArray(result?.suggestedNextSteps) ? result.suggestedNextSteps : [],
                  treatmentIdeas: Array.isArray(result?.treatmentIdeas) ? result.treatmentIdeas : [],
                  warnings: Array.isArray(result?.warnings) ? result.warnings : [],
                  rationale: String(result?.rationale || ''),
                  confidence: typeof result?.confidence === 'number' ? result.confidence : 0,
                  citations: Array.isArray(result?.citations) ? result.citations : [],
                },
              }
            : message
        )
      );
      setStreamingMessage({ id: assistantMessageId, fullContent: assistantMessage });
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
    create,
    draftMessage,
    encounterDraft,
    isLoading,
    messages,
    nextMessageId,
    patientId,
    requestMessages,
    selectedModel,
    t,
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

  const handleToggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleCloseChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const storageKey = useMemo(() => {
    const orgPart = currentOrganizationId || 'no-org';
    return `encounter-ai-chat-model:${orgPart}`;
  }, [currentOrganizationId]);

  useEffect(() => {
    loadModelsRef.current = loadModels;
  }, [loadModels]);

  useEffect(() => {
    if (!isDesktop || !isOpen) return;
    let cancelled = false;

    const run = async () => {
      try {
        const result = await loadModelsRef.current({});
        if (cancelled) return;
        const models = Array.isArray((result as any)?.models)
          ? (result as any).models.map((item: any) => String(item))
          : [];
        setAvailableModels(models);
        if (!models.length) {
          setSelectedModel(null);
          return;
        }

        const storedModel = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;

        if (storedModel && models.includes(storedModel)) {
          setSelectedModel(storedModel);
          return;
        }

        setSelectedModel(prev => (prev && models.includes(prev) ? prev : models[0]));
      } catch (_error) {
        if (cancelled) return;
        setAvailableModels([]);
        setSelectedModel(null);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [isDesktop, isOpen, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!selectedModel) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, selectedModel);
  }, [selectedModel, storageKey]);

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
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, messages]);

  if (!isDesktop) {
    return null;
  }

  return (
    <>
      {!isOpen && (
        <ActionIcon
          size={56}
          radius="xl"
          variant="filled"
          color="violet"
          onClick={handleToggleChat}
          style={{
            position: 'fixed',
            right: '1.5rem',
            bottom: '1.5rem',
            zIndex: 1300,
            boxShadow: '0 10px 24px rgba(0,0,0,0.2)',
          }}
          aria-label={t('ai_chat.open_assistant')}
        >
          <Bot size={24} />
        </ActionIcon>
      )}

      {isOpen && (
        <Paper
          withBorder
          radius="md"
          style={{
            position: 'fixed',
            right: '1.5rem',
            bottom: '1.5rem',
            width: 'min(420px, calc(100vw - 3rem))',
            height: 'min(72vh, 720px)',
            zIndex: 1300,
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
              onClick={handleCloseChat}
              aria-label={t('ai_chat.minimize_assistant')}
            >
              <Minimize2 size={16} />
            </ActionIcon>
          </Group>

          <Stack gap={0} style={{ flex: 1, minHeight: 0 }}>
            <Group align="end" px="md">
              <Select
                // label={t('ai_chat.model_label', { provider: modelsProvider })}
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
              style={{
                overflowY: 'auto',
                flex: 1,
                borderBottom: '1px solid var(--mantine-color-gray-2)',
              }}
            >
              <Box style={{ marginTop: 'auto' }} />
              {messages.map(message => (
                <Box key={message.id}>
                  <Paper withBorder p="sm" radius="md" bg={message.role === 'assistant' ? 'gray.0' : 'blue.0'}>
                    <Text size="sm" fw={600} mb={4}>
                      {message.role === 'assistant' ? t('ai_chat.assistant') : t('ai_chat.you')}
                    </Text>
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
                      <SuggestionGroup
                        title={t('ai_chat.treatment_ideas')}
                        items={message.suggestions.treatmentIdeas}
                      />
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
      )}
    </>
  );
}
