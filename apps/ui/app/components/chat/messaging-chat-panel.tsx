import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@remix-run/react';
import {
  ActionIcon,
  Autocomplete,
  Avatar,
  Box,
  Group,
  Image,
  Loader,
  Menu,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  ArrowBendUpLeftIcon,
  ArrowDownRightIcon,
  CopyIcon,
  ImageIcon,
  PaperclipIcon,
  PencilSimpleIcon,
  StethoscopeIcon,
  TrashIcon,
  UserPlusIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { EmojiInlineSuggest, countEmojiResults, getEmojiAtIndex } from '~/components/chat/emoji-inline-suggest';
import { EmojiPicker } from '~/components/chat/emoji-picker';
import { replaceEmojiShortcodes } from '~/components/chat/emoji-shortcodes';
import { GifPicker } from '~/components/chat/gif-picker';
import { ImageLightbox } from '~/components/chat/image-lightbox';
import { useChat } from '~/components/chat/chat-provider';
import { useAccount, useFeathers, useFind } from '~/components/provider';
import { media } from '~/media';
import { deterministicColor, type ChatParticipant } from '~/components/chat-manager';
import { useChatManager } from '~/components/chat-manager';
import type { Patient } from '~/declarations';
import { displayDocumentValue } from '~/utils';

interface ReplySnippet {
  id: string;
  senderId: string;
  content: string;
}

interface SharedEncounterMetadata {
  type: 'shared-encounter-access';
  patientId: string;
  patientName: string;
}

interface ChatAttachment {
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

interface AttachmentMetadata {
  type: 'attachments';
  attachments: ChatAttachment[];
}

type MessageMetadata = SharedEncounterMetadata | AttachmentMetadata;

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'system';
  createdAt: string;
  updatedAt: string;
  replyToId?: string | null;
  replyTo?: ReplySnippet | null;
  metadata?: MessageMetadata | null;
  deleted?: boolean;
}

const MEDIA_URL_PATTERN = /^https?:\/\/.+\.(jpe?g|png|gif|webp)(\?.*)?$/i;
const GIPHY_COMMAND_PATTERN = /^\/giphy(?:\s+(.*))?$/i;

interface SlashCommand {
  name: string;
  /** When selected, this text replaces the draft */
  template: string;
}

const SLASH_COMMANDS: SlashCommand[] = [{ name: 'giphy', template: '/giphy ' }];

// Matches emoji characters (including modifiers, ZWJ sequences, flags, etc.)
const EMOJI_REGEX = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

function isEmojiOnly(text: string): boolean {
  const stripped = text.replace(EMOJI_REGEX, '').trim();
  return stripped.length === 0 && text.trim().length > 0;
}

function isMediaUrl(text: string): boolean {
  try {
    new URL(text);
    return MEDIA_URL_PATTERN.test(text);
  } catch {
    return false;
  }
}

export interface MessagingChatPanelProps {
  chatKey: string;
  conversationId: string;
  participants?: ChatParticipant[];
  accentColor: string;
  isActive: boolean;
  onMinimize: () => void;
  onClose: () => void;
}

const PAGE_SIZE = 25;

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function ParticipantAvatars({
  participants,
  currentUserId,
  accentColor,
}: {
  participants: ChatParticipant[];
  currentUserId: string;
  accentColor: string;
  groupLabel: string;
}) {
  const others = participants.filter(p => p.userId !== currentUserId);
  const size = 24;
  const overlap = 8;

  return (
    <ScrollArea scrollbarSize={0} style={{ flexShrink: 1, minWidth: 0 }} type="scroll">
      <Group gap={0} wrap="nowrap" style={{ flexShrink: 0 }}>
        <Box
          style={{
            display: 'flex',
            position: 'relative',
            height: size,
            width: size + (others.length - 1) * (size - overlap),
            flexShrink: 0,
          }}
        >
          {others.map((p, idx) => {
            const pColor = deterministicColor(p.userId);
            return (
              <Avatar
                key={p.userId}
                size={size}
                radius="xl"
                color={pColor}
                variant="filled"
                style={{
                  position: 'absolute',
                  left: idx * (size - overlap),
                  zIndex: others.length - idx,
                  border: `2px solid var(--mantine-color-${accentColor}-5)`,
                  fontSize: 10,
                }}
              >
                {p.initials}
              </Avatar>
            );
          })}
        </Box>
      </Group>
    </ScrollArea>
  );
}

export function MessagingChatPanel({
  chatKey,
  conversationId,
  participants,
  accentColor,
  isActive,
  onMinimize,
  onClose,
}: MessagingChatPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { chatClient, orgUsers, typingUsers, sendTyping } = useChat();
  const { user } = useAccount();
  const { updateChatParticipants } = useChatManager();
  const isDesktop = useMediaQuery(media.md);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const isPrependingRef = useRef(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserQuery, setAddUserQuery] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showShareEncounters, setShowShareEncounters] = useState(false);
  const [sharePatientQuery, setSharePatientQuery] = useState('');
  const [debouncedShareQuery] = useDebouncedValue(sharePatientQuery, 500);
  const [pendingSharePatient, setPendingSharePatient] = useState<Patient | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiInlineQuery, setEmojiInlineQuery] = useState<string | null>(null);
  const [emojiInlineIndex, setEmojiInlineIndex] = useState(0);
  const emojiColonPosRef = useRef<number>(-1);
  const loadedRef = useRef(false);
  const addUserInputRef = useRef<HTMLInputElement | null>(null);
  const shareInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const feathersClient = useFeathers();

  const sharePatientSearchQuery = useMemo(
    () => ({
      firstName: debouncedShareQuery,
      lastName: debouncedShareQuery,
      documentValue: debouncedShareQuery,
    }),
    [debouncedShareQuery]
  );

  const {
    response: { data: sharePatients = [] },
    isLoading: isLoadingPatients,
  } = useFind('patients', sharePatientSearchQuery, { enabled: showShareEncounters });

  const sharePatientOptions = useMemo(() => {
    const map = new Map<string, Patient>();
    const data: string[] = [];

    for (const patient of sharePatients as Patient[]) {
      const name = `${patient.personalData.firstName} ${patient.personalData.lastName}`.trim();
      const doc = displayDocumentValue(patient.personalData.documentValue);
      const display = doc !== '—' ? `${name} — ${doc}` : name;
      map.set(display, patient);
      data.push(display);
    }

    return { data, patientByValue: map };
  }, [sharePatients]);

  const recipientUserId = useMemo(() => {
    if (!participants || participants.length === 0) return null;
    const other = participants.find(p => p.userId !== user?.id);
    return other?.userId ?? null;
  }, [participants, user?.id]);

  const handleToggleShareEncounters = useCallback(() => {
    setShowShareEncounters(prev => !prev);
    setSharePatientQuery('');
  }, []);

  const handleShareEncounterSelect = useCallback(
    (value: string) => {
      const patient = sharePatientOptions.patientByValue.get(value);
      if (!patient) return;

      setPendingSharePatient(patient);
      setShowShareEncounters(false);
      setSharePatientQuery('');
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [sharePatientOptions.patientByValue]
  );

  const handleCancelShareEncounter = useCallback(() => {
    setPendingSharePatient(null);
  }, []);

  // Slash command menu: show when input starts with "/" but hasn't resolved to a known command yet
  const slashCommandFilter = useMemo(() => {
    if (!draftMessage.startsWith('/')) return null;
    // If it already matched a full command (like /giphy term), don't show the menu
    if (GIPHY_COMMAND_PATTERN.test(draftMessage) && draftMessage.trim() !== '/giphy') return null;
    const typed = draftMessage.slice(1).toLowerCase();
    return SLASH_COMMANDS.filter(cmd => cmd.name.startsWith(typed));
  }, [draftMessage]);

  const showSlashMenu = slashCommandFilter !== null && slashCommandFilter.length > 0;

  const [slashMenuIndex, setSlashMenuIndex] = useState(0);

  // Reset selection index when the filtered list changes
  useEffect(() => {
    setSlashMenuIndex(0);
  }, [slashCommandFilter?.length]);

  const handleSlashCommandSelect = useCallback((cmd: SlashCommand) => {
    setDraftMessage(cmd.template);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  // Giphy command: derive search term from draft message
  const giphyMatch = useMemo(() => GIPHY_COMMAND_PATTERN.exec(draftMessage), [draftMessage]);
  const isGiphyActive = giphyMatch !== null;
  const giphySearchTerm = giphyMatch?.[1] ?? '';

  const handleGifSelect = useCallback(
    async (gif: { url: string; previewUrl: string; title: string; fileSize: number }) => {
      if (!chatClient || isSending) return;

      // Ensure we scroll to bottom when the message arrives
      isNearBottomRef.current = true;
      setNewMessageCount(0);
      setIsSending(true);
      setDraftMessage('');

      if (isTypingRef.current) {
        isTypingRef.current = false;
        sendTyping(conversationId, false);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      }

      try {
        const metadata: AttachmentMetadata = {
          type: 'attachments',
          attachments: [
            {
              url: gif.url,
              fileName: gif.title || 'giphy.gif',
              mimeType: 'image/gif',
              fileSize: gif.fileSize,
            },
          ],
        };

        await chatClient.service('messages').create({
          conversationId,
          content: ' ',
          metadata,
        });
      } catch {
        // Restore draft on failure
        setDraftMessage(`/giphy ${giphySearchTerm}`);
      } finally {
        setIsSending(false);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    },
    [chatClient, conversationId, giphySearchTerm, isSending, sendTyping]
  );

  const handleGifPickerClose = useCallback(() => {
    setDraftMessage('');
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const handleGiphyCreatorSearch = useCallback((username: string) => {
    setDraftMessage(`/giphy @${username}`);
  }, []);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      setIsUploading(true);
      try {
        const token = await (feathersClient as any).authentication?.getAccessToken?.();
        const orgId = (feathersClient as any).organizationId;
        const authHeaders: Record<string, string> = {};
        if (token) authHeaders['Authorization'] = `Bearer ${token}`;
        if (orgId) authHeaders['organization-id'] = orgId;

        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/file-uploads?encrypted=true', {
            method: 'POST',
            headers: authHeaders,
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Upload failed');
          }

          const { url } = await res.json();
          setPendingAttachments(prev => [
            ...prev,
            { url, fileName: file.name, mimeType: file.type, fileSize: file.size },
          ]);
        }
      } catch (err: any) {
        notifications.show({ message: err.message || t('common.error_unexpected'), color: 'red' });
      } finally {
        setIsUploading(false);
      }
    },
    [feathersClient, t]
  );

  const fetchAndAttachUrl = useCallback(
    async (url: string) => {
      setIsUploading(true);
      try {
        const token = await (feathersClient as any).authentication?.getAccessToken?.();
        const orgId = (feathersClient as any).organizationId;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (orgId) headers['organization-id'] = orgId;

        const res = await fetch('/api/url-fetch', {
          method: 'POST',
          headers,
          body: JSON.stringify({ url }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to fetch media');
        }

        const attachment: ChatAttachment = await res.json();
        setPendingAttachments(prev => [...prev, attachment]);
      } catch (err: any) {
        notifications.show({ message: err.message || t('common.error_unexpected'), color: 'red' });
        // Let the URL remain as text — don't block the user
        setDraftMessage(prev => (prev ? `${prev} ${url}` : url));
      } finally {
        setIsUploading(false);
      }
    },
    [feathersClient, t]
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData.items;

      // Check for image files in clipboard (screenshots, copied images)
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        uploadFiles(imageFiles);
        return;
      }

      // Check for pasted text that is a media URL
      const text = e.clipboardData.getData('text/plain');
      if (text && isMediaUrl(text.trim())) {
        e.preventDefault();
        fetchAndAttachUrl(text.trim());
      }
      // Otherwise, let default paste behavior handle plain text
    },
    [uploadFiles, fetchAndAttachUrl]
  );

  const handleRemoveAttachment = useCallback((index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleOpenLightbox = useCallback((url: string) => {
    setLightboxUrl(url);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    setLightboxUrl(null);
  }, []);

  const handleToggleEmojiPicker = useCallback(() => {
    setEmojiPickerOpen(prev => !prev);
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setDraftMessage(prev => prev + emoji);
    setEmojiPickerOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const handleOpenFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleEmojiInlineSelect = useCallback((emoji: string) => {
    setDraftMessage(prev => {
      const colonPos = emojiColonPosRef.current;
      if (colonPos < 0) return prev + emoji;
      // Find the end of the shortcode query (everything after `:` that's a word char)
      const afterColon = prev.slice(colonPos + 1);
      const queryLen = /^\w*/.exec(afterColon)?.[0].length ?? 0;
      const before = prev.slice(0, colonPos);
      const after = prev.slice(colonPos + 1 + queryLen);
      return before + emoji + after;
    });
    setEmojiInlineQuery(null);
    emojiColonPosRef.current = -1;
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      e.target.value = '';
      uploadFiles(Array.from(files));
    },
    [uploadFiles]
  );

  const isGroup = (participants?.length ?? 0) > 2;
  const recipientName = useMemo(() => {
    if (!participants || participants.length === 0) return '';
    if (isGroup) return '';
    const other = participants.find(p => p.userId !== user?.id);
    return other?.name ?? '';
  }, [participants, isGroup, user?.id]);

  const canShareEncounters = useMemo(() => {
    if (isGroup || !recipientUserId) return false;
    const recipientOrgUser = orgUsers.find(u => u.userId === recipientUserId);
    return recipientOrgUser?.roleIds.includes('medic') ?? false;
  }, [isGroup, recipientUserId, orgUsers]);

  // Load initial messages
  useEffect(() => {
    if (!chatClient || !conversationId || !isActive || loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const response = await chatClient.service('messages').find({
          query: {
            conversationId,
            $sort: { createdAt: -1 },
            $limit: PAGE_SIZE,
          },
        });
        if (cancelled) return;

        const items: Message[] = Array.isArray(response) ? response : ((response as any)?.data ?? []);
        setMessages(items.slice().reverse());
        setHasMore(items.length === PAGE_SIZE);
      } catch {
        // Non-fatal
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      loadedRef.current = false;
      setIsLoading(false);
    };
  }, [chatClient, conversationId, isActive]);

  // Real-time message listener
  useEffect(() => {
    if (!chatClient) return;

    const handleCreated = (message: Message) => {
      if (message.conversationId !== conversationId) return;
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    const handlePatched = (message: Message) => {
      if (message.conversationId !== conversationId) return;
      setMessages(prev => prev.map(m => (m.id === message.id ? { ...m, ...message } : m)));
    };

    const handleRemoved = (message: Message) => {
      if (message.conversationId !== conversationId) return;
      setMessages(prev => prev.map(m => (m.id === message.id ? { ...m, deleted: true } : m)));
    };

    const service = chatClient.service('messages');
    service.on('created', handleCreated);
    service.on('patched', handlePatched);
    service.on('removed', handleRemoved);
    return () => {
      service.removeListener('created', handleCreated);
      service.removeListener('patched', handlePatched);
      service.removeListener('removed', handleRemoved);
    };
  }, [chatClient, conversationId]);

  const [newMessageCount, setNewMessageCount] = useState(0);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  // Track whether user is near the bottom of the scroll container
  const updateNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 100; // px from bottom
    isNearBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    if (isNearBottomRef.current) {
      setNewMessageCount(0);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, []);

  // Auto-scroll on new messages (only if near bottom), otherwise count new messages
  useEffect(() => {
    if (!isActive || isPrependingRef.current) return;

    const count = messages.length;
    const added = count - prevMessageCountRef.current;
    prevMessageCountRef.current = count;

    // No new messages (deletion, patch, or no change) — don't scroll
    if (added <= 0) return;

    // Initial load (0 → N) — always scroll to bottom
    const isInitialLoad = added === count;

    if (isInitialLoad || isNearBottomRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom();
        isNearBottomRef.current = true;
      });
      return;
    }

    // User is scrolled up — increment unread count
    setNewMessageCount(prev => prev + added);
  }, [isActive, messages, scrollToBottom]);

  // Keep scroll pinned to bottom when content height changes (images loading, etc.)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (isNearBottomRef.current && !isPrependingRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    });

    // Observe the scroll container's internal content — any child resize
    // (e.g., an <img> going from 0 to intrinsic height) triggers a callback.
    for (const child of container.children) {
      observer.observe(child);
    }
    // Also observe the container itself for size changes
    observer.observe(container);

    return () => observer.disconnect();
  }, [messages]); // re-attach when messages change so new children are observed

  const handleScrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    setNewMessageCount(0);
  }, []);

  const handleLoadOlder = useCallback(async () => {
    if (!chatClient || !hasMore || isLoadingOlder || messages.length === 0) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    const prevHeight = container.scrollHeight;
    const prevTop = container.scrollTop;
    setIsLoadingOlder(true);

    try {
      const oldest = messages[0];
      const response = await chatClient.service('messages').find({
        query: {
          conversationId,
          $sort: { createdAt: -1 },
          $limit: PAGE_SIZE,
          createdAt: { $lt: oldest.createdAt },
        },
      });

      const items: Message[] = Array.isArray(response) ? response : ((response as any)?.data ?? []);

      if (items.length === 0) {
        setHasMore(false);
        return;
      }

      isPrependingRef.current = true;
      setMessages(prev => [...items.slice().reverse(), ...prev]);
      setHasMore(items.length === PAGE_SIZE);

      window.requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight - prevHeight + prevTop;
        }
        isPrependingRef.current = false;
      });
    } catch {
      // Non-fatal
    } finally {
      setIsLoadingOlder(false);
    }
  }, [chatClient, conversationId, hasMore, isLoadingOlder, messages]);

  const handleScroll = useCallback(() => {
    updateNearBottom();
    const container = messagesContainerRef.current;
    if (!container || container.scrollTop > 40) return;
    handleLoadOlder();
  }, [handleLoadOlder, updateNearBottom]);

  const handleSend = useCallback(async () => {
    const content = replaceEmojiShortcodes(draftMessage.trim());
    const hasAttachments = pendingAttachments.length > 0;
    if ((!content && !hasAttachments) || !chatClient || isSending) return;

    // Ensure we scroll to bottom when our own message arrives
    isNearBottomRef.current = true;
    setNewMessageCount(0);
    setIsSending(true);
    setDraftMessage('');
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(conversationId, false);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    }
    const currentEditId = editingMessageId;
    setEditingMessageId(null);
    const replyToId = replyTo?.id ?? undefined;
    setReplyTo(null);
    const sharePatient = pendingSharePatient;
    setPendingSharePatient(null);
    const attachments = hasAttachments ? [...pendingAttachments] : [];
    setPendingAttachments([]);
    try {
      if (currentEditId) {
        await chatClient.service('messages').patch(currentEditId, { content });
        setMessages(prev => prev.map(m => (m.id === currentEditId ? { ...m, content } : m)));
      } else {
        // Create shared access grant if a patient was attached
        if (sharePatient && recipientUserId) {
          await feathersClient.service('shared-encounter-access').create({
            grantedMedicId: recipientUserId,
            patientId: sharePatient.id,
          });
        }

        let metadata: MessageMetadata | undefined;
        if (attachments.length > 0) {
          metadata = { type: 'attachments', attachments };
        } else if (sharePatient) {
          metadata = {
            type: 'shared-encounter-access',
            patientId: sharePatient.id,
            patientName: `${sharePatient.personalData.firstName} ${sharePatient.personalData.lastName}`.trim(),
          };
        }

        await chatClient.service('messages').create({
          conversationId,
          content: content || ' ',
          ...(replyToId ? { replyToId } : {}),
          ...(metadata ? { metadata } : {}),
        });
      }
    } catch (err) {
      // Failed to send — restore draft
      setDraftMessage(content);
      if (sharePatient) setPendingSharePatient(sharePatient);
      if (attachments.length > 0) setPendingAttachments(attachments);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chatClient,
    conversationId,
    draftMessage,
    isSending,
    replyTo,
    editingMessageId,
    pendingSharePatient,
    pendingAttachments,
    recipientUserId,
    feathersClient,
  ]);

  const handleDraftChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.currentTarget.value;
      const cursor = e.currentTarget.selectionStart ?? value.length;
      setDraftMessage(value);

      // Detect inline emoji query: space (or start) + `:` + optional word chars at cursor
      // Dismiss if there's a space after `:` or no match
      const textBeforeCursor = value.slice(0, cursor);
      const colonMatch = /(?:^|\s):(\w*)$/.exec(textBeforeCursor);
      if (colonMatch) {
        setEmojiInlineQuery(colonMatch[1]);
        emojiColonPosRef.current = cursor - colonMatch[1].length - 1; // position of the `:`
        setEmojiInlineIndex(0);
      } else {
        setEmojiInlineQuery(null);
      }

      if (value.length > 0 && !isTypingRef.current) {
        isTypingRef.current = true;
        sendTyping(conversationId, true);
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          sendTyping(conversationId, false);
        }
      }, 2000);

      if (value.length === 0 && isTypingRef.current) {
        isTypingRef.current = false;
        sendTyping(conversationId, false);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      }
    },
    [conversationId, sendTyping]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return;

      // Inline emoji suggest navigation
      if (emojiInlineQuery !== null) {
        const resultCount = countEmojiResults(emojiInlineQuery);
        if (resultCount > 0) {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            setEmojiInlineIndex(prev => (prev >= resultCount - 1 ? 0 : prev + 1));
            return;
          }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            setEmojiInlineIndex(prev => (prev <= 0 ? resultCount - 1 : prev - 1));
            return;
          }
          if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            const emoji = getEmojiAtIndex(emojiInlineQuery, emojiInlineIndex);
            if (emoji) handleEmojiInlineSelect(emoji);
            return;
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setEmojiInlineQuery(null);
          return;
        }
      }

      // Slash command menu navigation
      if (showSlashMenu && slashCommandFilter) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSlashMenuIndex(prev => (prev <= 0 ? slashCommandFilter.length - 1 : prev - 1));
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSlashMenuIndex(prev => (prev >= slashCommandFilter.length - 1 ? 0 : prev + 1));
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          handleSlashCommandSelect(slashCommandFilter[slashMenuIndex]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setDraftMessage('');
          return;
        }
      }

      // Escape cancels editing
      if (e.key === 'Escape' && editingMessageId) {
        e.preventDefault();
        setEditingMessageId(null);
        setDraftMessage('');
        return;
      }

      // ArrowUp on empty input → edit last own message
      if (e.key === 'ArrowUp' && !draftMessage && !editingMessageId) {
        const lastOwn = [...messages].reverse().find(m => m.senderId === user?.id && m.type !== 'system');
        if (lastOwn) {
          e.preventDefault();
          setEditingMessageId(lastOwn.id);
          setDraftMessage(lastOwn.content);
        }
        return;
      }

      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      // Don't send when /giphy command is active — the picker handles it
      if (isGiphyActive) return;
      handleSend();
    },
    [
      handleSend,
      editingMessageId,
      draftMessage,
      messages,
      user?.id,
      isGiphyActive,
      showSlashMenu,
      slashCommandFilter,
      slashMenuIndex,
      handleSlashCommandSelect,
      emojiInlineQuery,
      emojiInlineIndex,
      handleEmojiInlineSelect,
    ]
  );

  // Add user autocomplete data
  const addUserOptions = useMemo(() => {
    const currentIds = new Set(participants?.map(p => p.userId) ?? []);
    return orgUsers
      .filter(u => !currentIds.has(u.userId))
      .filter(u => {
        if (!addUserQuery) return true;
        const q = addUserQuery.toLowerCase();
        return u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
      })
      .map(u => ({ value: u.fullName, userId: u.userId, user: u }));
  }, [orgUsers, participants, addUserQuery]);

  const handleReply = useCallback((msg: Message) => {
    setReplyTo(msg);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const [contextMenu, setContextMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    setContextMenu({ msg, x: e.clientX, y: e.clientY });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopyMessage = useCallback(() => {
    if (!contextMenu) return;
    navigator.clipboard.writeText(contextMenu.msg.content);
    notifications.show({ message: t('chat.copied'), color: 'green' });
    setContextMenu(null);
  }, [contextMenu, t]);

  const handleEditFromContext = useCallback(() => {
    if (!contextMenu) return;
    setEditingMessageId(contextMenu.msg.id);
    setDraftMessage(contextMenu.msg.content);
    setContextMenu(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [contextMenu]);

  const handleReplyFromContext = useCallback(() => {
    if (!contextMenu) return;
    handleReply(contextMenu.msg);
    setContextMenu(null);
  }, [contextMenu, handleReply]);

  const deleteAttachmentFiles = useCallback(
    async (attachments: ChatAttachment[]) => {
      const client = feathersClient as unknown as Record<string, unknown>;
      const auth = client.authentication as { getAccessToken?: () => Promise<string> } | undefined;
      const token = await auth?.getAccessToken?.();
      const orgId = client.organizationId as string | undefined;
      for (const att of attachments) {
        // Only delete uploaded files (skip external URLs like Giphy)
        if (!att.url.startsWith('/api/file-uploads/')) continue;
        const fileId = att.url.split('/').pop();
        if (!fileId) continue;
        try {
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          if (orgId) headers['organization-id'] = orgId;
          await fetch(`/api/file-uploads/${fileId}`, { method: 'DELETE', headers });
        } catch {
          // Best-effort — don't block the UI
        }
      }
    },
    [feathersClient]
  );

  const handleDeleteAttachment = useCallback(async () => {
    if (!contextMenu || !chatClient) return;
    const msg = contextMenu.msg;
    setContextMenu(null);

    if (msg.metadata?.type !== 'attachments') return;

    try {
      // Delete the attachment files
      await deleteAttachmentFiles(msg.metadata.attachments);

      // If message has no text content, delete the whole message
      if (!msg.content.trim()) {
        await chatClient.service('messages').remove(msg.id);
        setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, deleted: true } : m)));
      } else {
        // Otherwise just remove the attachment metadata
        await chatClient.service('messages').patch(msg.id, { metadata: null });
        setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, metadata: null } : m)));
      }
    } catch {
      notifications.show({ message: t('common.error_unexpected'), color: 'red' });
    }
  }, [contextMenu, chatClient, deleteAttachmentFiles, t]);

  const handleDeleteMessage = useCallback(async () => {
    if (!contextMenu || !chatClient) return;
    const msg = contextMenu.msg;
    setContextMenu(null);
    try {
      // Also delete attachment files if present
      if (msg.metadata?.type === 'attachments') {
        await deleteAttachmentFiles(msg.metadata.attachments);
      }
      await chatClient.service('messages').remove(msg.id);
      setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, deleted: true } : m)));
    } catch {
      notifications.show({ message: t('common.error_unexpected'), color: 'red' });
    }
  }, [contextMenu, chatClient, deleteAttachmentFiles, t]);

  const handleToggleAddUser = useCallback(() => {
    setShowAddUser(prev => !prev);
    setAddUserQuery('');
  }, []);

  // Focus input when add user opens
  useEffect(() => {
    if (showAddUser) {
      setTimeout(() => addUserInputRef.current?.focus(), 50);
    }
  }, [showAddUser]);

  // Focus input when share encounters opens
  useEffect(() => {
    if (showShareEncounters) {
      setTimeout(() => shareInputRef.current?.focus(), 50);
    }
  }, [showShareEncounters]);

  const handleAddUser = useCallback(
    async (fullName: string) => {
      const match = orgUsers.find(u => u.fullName === fullName);
      if (!match || !chatClient || !user?.id) return;

      try {
        await chatClient.service('conversation-participants').create({
          conversationId,
          userId: match.userId,
        });

        // Send system message
        const shortName = `${match.firstName} ${match.lastName.charAt(0)}.`;
        await chatClient.service('messages').create({
          conversationId,
          content: t('chat.entered_conversation', { name: shortName }),
          type: 'system',
        });

        const newParticipant: ChatParticipant = {
          userId: match.userId,
          name: match.fullName,
          initials: match.initials,
        };
        const updated = [...(participants ?? []), newParticipant];
        const groupName =
          `${t('chat.group_label')} ` +
          updated
            .filter(p => p.userId !== user.id)
            .map(p => p.initials)
            .join(', ');
        updateChatParticipants(chatKey, updated, groupName);

        setShowAddUser(false);
        setAddUserQuery('');
      } catch (err) {
        // best-effort
      }
    },
    [chatClient, conversationId, orgUsers, participants, user?.id, chatKey, updateChatParticipants, t]
  );

  const senderNames = useMemo(() => {
    const map = new Map<string, { name: string; initials: string; color: string }>();
    orgUsers.forEach(u => {
      map.set(u.userId, {
        name: u.fullName,
        initials: u.initials,
        color: deterministicColor(u.userId),
      });
    });
    if (user) {
      map.set(user.id, {
        name: t('chat.you'),
        initials:
          `${(user.personalData as Record<string, string>)?.firstName?.[0] ?? ''}${(user.personalData as Record<string, string>)?.lastName?.[0] ?? ''}`.toUpperCase() ||
          '?',
        color: 'blue',
      });
    }
    return map;
  }, [orgUsers, user, t]);

  const typingLabel = useMemo(() => {
    const typers = typingUsers.get(conversationId);
    if (!typers || typers.size === 0) return null;

    const names = [...typers].map(uid => senderNames.get(uid)?.name ?? '').filter(Boolean);

    if (names.length === 0) return null;
    if (names.length === 1) return t('chat.typing_one', { name: names[0] });
    if (names.length === 2) return t('chat.typing_two', { name1: names[0], name2: names[1] });
    return t('chat.typing_many', { names: `${names.slice(0, -1).join(', ')}, ${names[names.length - 1]}` });
  }, [typingUsers, conversationId, senderNames, t]);

  const handlePanelClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't steal focus from interactive elements
    if (target.closest('a, button, input, textarea, select, [role="button"], [role="option"], [data-interactive]'))
      return;
    textareaRef.current?.focus();
  }, []);

  if (!isDesktop) return null;

  return (
    <>
      <Paper
        withBorder
        radius="md"
        onClick={handlePanelClick}
        style={{
          width: 'min(380px, calc(100vw - 6rem))',
          height: 'min(60vh, 560px)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.075), 0 8px 32px rgba(0,0,0,0.075), 0 24px 48px rgba(0,0,0,0.075)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'white',
        }}
      >
        {/* Header */}
        <Group
          justify="space-between"
          align="center"
          px="md"
          py="sm"
          bg={`${accentColor}.5`}
          style={{ borderBottom: '1px solid var(--mantine-color-gray-2)', flexShrink: 0 }}
        >
          {isGroup && participants ? (
            <ParticipantAvatars
              participants={participants}
              currentUserId={user?.id ?? ''}
              accentColor={accentColor}
              groupLabel={t('chat.group_label')}
            />
          ) : (
            <Text fw={600} c="white" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
              {recipientName}
            </Text>
          )}
          <Group gap={4} style={{ flexShrink: 0 }}>
            <ActionIcon variant="subtle" color="white" onClick={handleToggleAddUser}>
              <UserPlusIcon size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="white" onClick={onMinimize}>
              <ArrowDownRightIcon size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="white" onClick={onClose}>
              <XIcon size={16} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Add user autocomplete */}
        {showAddUser && (
          <Box px="md" py="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)', flexShrink: 0 }}>
            <Autocomplete
              ref={addUserInputRef}
              placeholder={t('chat.add_user_placeholder')}
              value={addUserQuery}
              onChange={setAddUserQuery}
              onOptionSubmit={handleAddUser}
              data={addUserOptions.map(o => o.value)}
              size="xs"
              comboboxProps={{ withinPortal: true, zIndex: 1400 }}
            />
          </Box>
        )}

        {/* Hover-to-reveal reply button + highlight flash */}
        <style>{`
        .chat-msg-row:hover .chat-msg-reply-btn { opacity: 1 !important; }
        .chat-msg-row p { margin: 0; }
        .chat-msg-row pre { margin: 4px 0; padding: 6px 8px; border-radius: 4px; background: rgba(0,0,0,0.05); overflow-x: auto; }
        .chat-msg-row code { font-size: 0.8em; padding: 1px 4px; border-radius: 3px; background: rgba(0,0,0,0.06); }
        .chat-msg-row pre code { padding: 0; background: none; }
        .chat-msg-row ul, .chat-msg-row ol { margin: 2px 0; padding-left: 1.2em; }
        .chat-msg-row blockquote { margin: 4px 0; padding-left: 8px; border-left: 3px solid var(--mantine-color-gray-4); color: var(--mantine-color-gray-6); }
        .chat-msg-highlight { box-shadow: inset 0 0 0 40rem var(--mantine-primary-color-2); transition: box-shadow 300ms; }
        .chat-msg-highlight-fade { box-shadow: inset 0 0 0 40rem transparent; }
      `}</style>

        {/* Messages */}
        <Box style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Stack
            ref={messagesContainerRef}
            gap="xs"
            px="md"
            pb="sm"
            onScroll={handleScroll}
            style={{
              overflowY: 'auto',
              flex: 1,
              borderBottom: '1px solid var(--mantine-color-gray-2)',
            }}
          >
            {isLoadingOlder && (
              <Group justify="center" pt="xs">
                <Loader size="xs" />
              </Group>
            )}
            <Box style={{ marginTop: 'auto' }} />
            {isLoading && (
              <Group justify="center" py="md">
                <Loader size="sm" />
              </Group>
            )}
            {messages.map(msg => {
              if (msg.type === 'system') {
                return (
                  <Text key={msg.id} size="xs" c="dimmed" ta="center" py={4} fs="italic">
                    {msg.content}
                  </Text>
                );
              }

              if (msg.deleted) {
                const isMe = msg.senderId === user?.id;
                return (
                  <Text key={msg.id} size="xs" c="dimmed" fs="italic" py={2} ta={isMe ? 'right' : 'left'}>
                    {t('chat.message_deleted')}
                  </Text>
                );
              }

              const isMe = msg.senderId === user?.id;
              const sender = senderNames.get(msg.senderId);
              const quotedSender = msg.replyTo ? senderNames.get(msg.replyTo.senderId) : null;

              return (
                <Box
                  key={msg.id}
                  className="chat-msg-row"
                  onContextMenu={e => handleContextMenu(e, msg)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    position: 'relative',
                  }}
                >
                  <Group
                    gap={6}
                    align="flex-end"
                    style={{ maxWidth: '85%', flexDirection: isMe ? 'row-reverse' : 'row' }}
                  >
                    {!isMe && (
                      <Avatar size={28} radius="xl" color={sender?.color || 'gray'} style={{ flexShrink: 0 }}>
                        <Text size="xs">{sender?.initials || '?'}</Text>
                      </Avatar>
                    )}
                    <Box style={{ position: 'relative' }}>
                      {!isMe && (
                        <Text size="xs" c="dimmed" mb={2}>
                          {sender?.name || msg.senderId}
                        </Text>
                      )}
                      {/* Quoted message */}
                      {msg.replyTo && (
                        <Box
                          px="sm"
                          py={4}
                          mb={2}
                          style={{
                            borderLeft: `3px solid var(--mantine-color-${quotedSender?.color || 'gray'}-4)`,
                            borderRadius: '0 8px 8px 0',
                            backgroundColor: 'var(--mantine-color-gray-1)',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            const el = messagesContainerRef.current?.querySelector(
                              `[data-msg-id="${msg.replyTo!.id}"]`
                            );
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              el.classList.add('chat-msg-highlight');
                              el.classList.remove('chat-msg-highlight-fade');
                              setTimeout(() => {
                                el.classList.add('chat-msg-highlight-fade');
                                setTimeout(() => {
                                  el.classList.remove('chat-msg-highlight', 'chat-msg-highlight-fade');
                                }, 300);
                              }, 1200);
                            }
                          }}
                        >
                          <Text size="xs" fw={600} c={`${quotedSender?.color || 'gray'}.6`}>
                            {quotedSender?.name || msg.replyTo.senderId}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {msg.replyTo.content}
                          </Text>
                        </Box>
                      )}
                      {/* Shared encounter access */}
                      {msg.metadata?.type === 'shared-encounter-access' && (
                        <Box
                          px="sm"
                          py={4}
                          mb={2}
                          style={{
                            borderLeft: '3px solid var(--mantine-color-teal-4)',
                            borderRadius: '0 8px 8px 0',
                            backgroundColor: 'var(--mantine-color-gray-1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                          }}
                          onClick={() => navigate(`/encounters/${(msg.metadata as SharedEncounterMetadata).patientId}`)}
                        >
                          <StethoscopeIcon size={14} color="var(--mantine-color-teal-6)" style={{ flexShrink: 0 }} />
                          <Box>
                            <Text size="xs" fw={600} c="teal.6" lineClamp={1}>
                              {(msg.metadata as SharedEncounterMetadata).patientName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {t('chat.medical_record')}
                            </Text>
                          </Box>
                        </Box>
                      )}
                      {/* Image attachments */}
                      {msg.metadata?.type === 'attachments' && (
                        <Stack gap={4} mb={4}>
                          {msg.metadata.attachments.map((att, idx) => (
                            <Image
                              key={idx}
                              src={att.url}
                              alt={att.fileName}
                              radius="md"
                              maw={240}
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleOpenLightbox(att.url)}
                            />
                          ))}
                        </Stack>
                      )}
                      {msg.content.trim() && (
                        <Paper
                          px="sm"
                          py={6}
                          radius="md"
                          bg={isMe ? `${accentColor}.0` : 'gray.0'}
                          style={{
                            wordBreak: 'break-word',
                            fontSize: isEmojiOnly(msg.content) ? '2rem' : '0.875rem',
                            lineHeight: isEmojiOnly(msg.content) ? 1.3 : 1.5,
                          }}
                          data-msg-id={msg.id}
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </Paper>
                      )}
                      <Text size="10px" c="dimmed" mt={2} ta={isMe ? 'right' : 'left'}>
                        {msg.updatedAt !== msg.createdAt && `${t('chat.edited')} `}
                        {formatTime(msg.createdAt)}
                      </Text>
                      {/* Reply button — visible on row hover */}
                      <ActionIcon
                        className="chat-msg-reply-btn"
                        variant="subtle"
                        color="dark"
                        size="sm"
                        onClick={() => handleReply(msg)}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          [isMe ? 'left' : 'right']: -30,
                          opacity: 0,
                          transition: 'opacity 120ms',
                        }}
                      >
                        <ArrowBendUpLeftIcon size={18} />
                      </ActionIcon>
                    </Box>
                  </Group>
                </Box>
              );
            })}
            {typingLabel && (
              <Text size="xs" c="dimmed" fs="italic" px="md" py={2} style={{ flexShrink: 0 }}>
                {typingLabel}
              </Text>
            )}
          </Stack>

          {/* New messages badge */}
          {newMessageCount > 0 && (
            <Box
              onClick={handleScrollToBottom}
              style={{
                position: 'absolute',
                bottom: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                cursor: 'pointer',
              }}
            >
              <Paper
                px="sm"
                py={4}
                radius="xl"
                shadow="sm"
                withBorder
                style={{ backgroundColor: 'var(--mantine-color-blue-6)' }}
              >
                <Text size="xs" c="white" fw={600}>
                  {newMessageCount === 1
                    ? t('chat.new_message_one')
                    : t('chat.new_messages_many', { count: newMessageCount })}
                  {' ↓'}
                </Text>
              </Paper>
            </Box>
          )}
        </Box>

        {/* Message context menu */}
        <Menu
          opened={contextMenu !== null}
          onChange={opened => {
            if (!opened) handleCloseContextMenu();
          }}
          position="bottom-start"
          withinPortal
          zIndex={1400}
        >
          <Menu.Target>
            <Box
              style={{
                position: 'fixed',
                top: contextMenu?.y ?? 0,
                left: contextMenu?.x ?? 0,
                width: 0,
                height: 0,
                pointerEvents: 'none',
              }}
            />
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<ArrowBendUpLeftIcon size={14} />} onClick={handleReplyFromContext}>
              {t('chat.reply')}
            </Menu.Item>
            <Menu.Item leftSection={<CopyIcon size={14} />} onClick={handleCopyMessage}>
              {t('chat.copy')}
            </Menu.Item>
            {contextMenu?.msg.senderId === user?.id && (
              <>
                <Menu.Item leftSection={<PencilSimpleIcon size={14} />} onClick={handleEditFromContext}>
                  {t('chat.edit')}
                </Menu.Item>
                {contextMenu?.msg.metadata?.type === 'attachments' && (
                  <Menu.Item leftSection={<ImageIcon size={14} />} color="red" onClick={handleDeleteAttachment}>
                    {t('chat.delete_attachment')}
                  </Menu.Item>
                )}
                <Menu.Divider />
                <Menu.Item leftSection={<TrashIcon size={14} />} color="red" onClick={handleDeleteMessage}>
                  {t('chat.delete')}
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>

        {/* Reply preview */}
        {replyTo && (
          <Group
            gap="xs"
            px="md"
            py={6}
            align="center"
            style={{
              flexShrink: 0,
              borderBottom: '1px solid var(--mantine-color-gray-2)',
              backgroundColor: 'var(--mantine-color-gray-0)',
            }}
          >
            <Box
              style={{
                flex: 1,
                minWidth: 0,
                borderLeft: `3px solid var(--mantine-color-${senderNames.get(replyTo.senderId)?.color || 'gray'}-4)`,
                paddingLeft: 8,
              }}
            >
              <Text size="xs" fw={600} c={`${senderNames.get(replyTo.senderId)?.color || 'gray'}.6`} lineClamp={1}>
                {senderNames.get(replyTo.senderId)?.name || replyTo.senderId}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={1}>
                {replyTo.content}
              </Text>
            </Box>
            <ActionIcon variant="subtle" color="gray" size="xs" onClick={handleCancelReply}>
              <XIcon size={14} />
            </ActionIcon>
          </Group>
        )}

        {/* Editing indicator */}
        {editingMessageId && (
          <Group
            gap="xs"
            px="md"
            py={4}
            align="center"
            style={{
              flexShrink: 0,
              backgroundColor: 'var(--mantine-color-yellow-0)',
              borderBottom: '1px solid var(--mantine-color-yellow-3)',
            }}
          >
            <Text size="xs" c="dimmed" style={{ flex: 1 }}>
              {t('chat.editing_message')}
            </Text>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => {
                setEditingMessageId(null);
                setDraftMessage('');
              }}
            >
              <XIcon size={14} />
            </ActionIcon>
          </Group>
        )}

        {/* Share encounters picker */}
        {showShareEncounters && (
          <Group
            gap={0}
            align="center"
            px="md"
            py="xs"
            style={{ borderBottom: '1px solid var(--mantine-color-gray-2)', flexShrink: 0 }}
          >
            <Autocomplete
              ref={shareInputRef}
              placeholder={t('chat.share_encounters_placeholder')}
              value={sharePatientQuery}
              onChange={setSharePatientQuery}
              onOptionSubmit={handleShareEncounterSelect}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setShowShareEncounters(false);
                  setSharePatientQuery('');
                }
              }}
              data={sharePatientOptions.data}
              filter={({ options }) => options}
              leftSection={isLoadingPatients ? <Loader size={14} /> : undefined}
              comboboxProps={{ withinPortal: true, zIndex: 1400 }}
              autoFocus
              variant="unstyled"
              style={{ flex: 1 }}
            />
            <ActionIcon variant="subtle" color="gray" size="xs" onClick={handleToggleShareEncounters}>
              <XIcon size={14} />
            </ActionIcon>
          </Group>
        )}

        {/* Pending share encounter preview */}
        {pendingSharePatient && (
          <Group
            gap="xs"
            px="md"
            py={6}
            align="center"
            style={{
              flexShrink: 0,
              borderBottom: '1px solid var(--mantine-color-gray-2)',
              backgroundColor: 'var(--mantine-color-gray-0)',
            }}
          >
            <Box
              style={{
                flex: 1,
                minWidth: 0,
                borderLeft: '3px solid var(--mantine-color-teal-4)',
                paddingLeft: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <StethoscopeIcon size={16} color="var(--mantine-color-teal-6)" style={{ flexShrink: 0 }} />
              <Box>
                <Text size="xs" fw={600} c="teal.6" lineClamp={1}>
                  {pendingSharePatient.personalData.firstName} {pendingSharePatient.personalData.lastName}
                </Text>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {t('chat.medical_record')}
                </Text>
              </Box>
            </Box>
            <ActionIcon variant="subtle" color="gray" size="xs" onClick={handleCancelShareEncounter}>
              <XIcon size={14} />
            </ActionIcon>
          </Group>
        )}

        {/* GIF picker */}
        {isGiphyActive && (
          <GifPicker searchTerm={giphySearchTerm} onSelect={handleGifSelect} onClose={handleGifPickerClose} onCreatorSearch={handleGiphyCreatorSearch} />
        )}

        {/* Pending attachments preview */}
        {(pendingAttachments.length > 0 || isUploading) && (
          <Group
            gap="xs"
            px="md"
            py={6}
            align="center"
            style={{
              flexShrink: 0,
              borderBottom: '1px solid var(--mantine-color-gray-2)',
              backgroundColor: 'var(--mantine-color-gray-0)',
              overflowX: 'auto',
            }}
          >
            <ImageIcon size={14} color="var(--mantine-color-blue-6)" style={{ flexShrink: 0 }} />
            {pendingAttachments.map((att, idx) => (
              <Box
                key={`${att.url}-${idx}`}
                style={{
                  position: 'relative',
                  flexShrink: 0,
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: '1px solid var(--mantine-color-gray-3)',
                }}
              >
                <Image src={att.url} alt={att.fileName} h={60} w={60} fit="cover" radius={6} />
                <ActionIcon
                  variant="filled"
                  color="dark"
                  size={16}
                  radius="xl"
                  onClick={() => handleRemoveAttachment(idx)}
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    opacity: 0.8,
                  }}
                >
                  <XIcon size={10} />
                </ActionIcon>
              </Box>
            ))}
            {isUploading && <Loader size={16} />}
          </Group>
        )}

        {/* Inline emoji suggest */}
        {emojiInlineQuery !== null && (
          <EmojiInlineSuggest
            query={emojiInlineQuery}
            selectedIndex={emojiInlineIndex}
            onSelect={handleEmojiInlineSelect}
          />
        )}

        {/* Slash command menu */}
        {showSlashMenu && slashCommandFilter && (
          <Box
            px="md"
            py={4}
            style={{
              flexShrink: 0,
              borderBottom: '1px solid var(--mantine-color-gray-2)',
              backgroundColor: 'var(--mantine-color-gray-0)',
            }}
          >
            {slashCommandFilter.map((cmd, idx) => (
              <Group
                key={cmd.name}
                gap="xs"
                px="xs"
                py={6}
                onClick={() => handleSlashCommandSelect(cmd)}
                style={{
                  cursor: 'pointer',
                  borderRadius: 4,
                  backgroundColor: idx === slashMenuIndex ? 'var(--mantine-color-blue-0)' : 'transparent',
                }}
              >
                {cmd.name === 'giphy' && (
                  <Image src="/giphy-iso.png" alt="Giphy" w={20} h={20} style={{ flexShrink: 0 }} />
                )}
                <Text size="sm" fw={600} c="blue.6">
                  /{cmd.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {cmd.name === 'giphy' ? t('chat.cmd_giphy') : cmd.name}
                </Text>
              </Group>
            ))}
          </Box>
        )}

        {/* Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        <Group gap={0} align="center" style={{ flexShrink: 0 }}>
          {canShareEncounters && (
            <Menu position="top-start" withinPortal zIndex={1400}>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="lg" ml="xs">
                  <PaperclipIcon size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<ImageIcon size={16} />} onClick={handleOpenFilePicker}>
                  {t('chat.attach_image')}
                </Menu.Item>
                <Menu.Item leftSection={<StethoscopeIcon size={16} />} onClick={handleToggleShareEncounters}>
                  {t('chat.share_medical_record')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
          {!canShareEncounters && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              ml="xs"
              title={t('chat.attach_image')}
              onClick={handleOpenFilePicker}
            >
              <PaperclipIcon size={16} />
            </ActionIcon>
          )}
          <Textarea
            ref={textareaRef}
            value={draftMessage}
            onChange={handleDraftChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            minRows={1}
            placeholder={t('chat.type_message')}
            variant="unstyled"
            autosize
            px="md"
            py={4}
            disabled={isSending || isUploading}
            style={{ flex: 1 }}
          />
          {isGiphyActive && (
            <Image src="/giphy-powered-badge.png" alt="Powered by GIPHY" h={16} w="auto" style={{ flexShrink: 0 }} />
          )}
          <EmojiPicker
            opened={emojiPickerOpen}
            onToggle={handleToggleEmojiPicker}
            onSelect={handleEmojiSelect}
            disabled={isSending || isUploading}
          />
        </Group>
      </Paper>

      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={handleCloseLightbox} />}
    </>
  );
}
