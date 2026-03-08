import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionIcon, Avatar, Box, Text, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { animated, useSpring, useSprings } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Bot, X } from 'lucide-react';
import { lighten } from 'polished';

import { useLocation } from '@remix-run/react';

import { useChatManager, deterministicColor, type ChatInstance } from '~/components/chat-manager';
import { EncounterChatPanel } from '~/components/encounter-chat-panel';
import { MessagingChatPanel } from '~/components/chat/messaging-chat-panel';
import { useChat } from '~/components/chat/chat-provider';
import { useAccount } from '~/components/provider';
import { media } from '~/media';

const STATUS_COLORS: Record<string, string> = {
  online: 'var(--mantine-color-green-6)',
  away: 'var(--mantine-color-yellow-5)',
  dnd: 'var(--mantine-color-red-6)',
  offline: 'var(--mantine-color-gray-5)',
};

// Mantine default shade-6 hex values for deterministicColor palette
const COLOR_HEX: Record<string, string> = {
  blue: '#228be6',
  teal: '#12b886',
  violet: '#7950f2',
  pink: '#e64980',
  orange: '#fd7e14',
  cyan: '#15aabf',
  green: '#40c057',
  grape: '#be4bdb',
  indigo: '#4c6ef5',
  gray: '#868e96',
};

function lightColor(name: string): string {
  const hex = COLOR_HEX[name] ?? COLOR_HEX.gray;
  return lighten(0.65, hex);
}

const AUTH_ROUTES = ['/login', '/signup'];

const SPRING_CONFIG = { tension: 300, friction: 20 };
const HEAD_SIZE = 48;
const HEAD_GAP = 8;
const HEAD_OFFSET = HEAD_SIZE + HEAD_GAP;
const CLICK_THRESHOLD = 5;
const HEADS_RIGHT = 24;

function AnimatedChatPanel({
  chat,
  isActive,
  onMinimize,
  onClose,
}: {
  chat: ChatInstance;
  isActive: boolean;
  onMinimize: () => void;
  onClose: () => void;
}) {
  const panelSpring = useSpring({
    opacity: isActive ? 1 : 0,
    y: isActive ? 0 : 24,
    scale: isActive ? 1 : 0.92,
    config: SPRING_CONFIG,
  });

  const rightOffset = HEADS_RIGHT + HEAD_SIZE + 12;

  return (
    <animated.div
      style={{
        ...panelSpring,
        position: 'fixed',
        right: `${rightOffset}px`,
        bottom: `${HEADS_RIGHT}px`,
        zIndex: 1300,
        pointerEvents: isActive ? 'auto' : 'none',
        transformOrigin: 'bottom right',
      }}
    >
      {chat.type === 'messaging' && chat.conversationId ? (
        <MessagingChatPanel
          chatKey={chat.patientId}
          conversationId={chat.conversationId}
          participants={chat.participants}
          accentColor={chat.color}
          isActive={isActive}
          onMinimize={onMinimize}
          onClose={onClose}
        />
      ) : (
        <EncounterChatPanel
          patientId={chat.patientId}
          patientName={chat.patientName}
          accentColor={chat.color}
          encounterDraft={chat.encounterDraft}
          isActive={isActive}
          onMinimize={onMinimize}
          onClose={onClose}
        />
      )}
    </animated.div>
  );
}

// Given original index and current drag Y, figure out which slot the drag is over
function dragSlot(count: number, dragY: number): number {
  const raw = Math.round(-dragY / HEAD_OFFSET);
  return Math.max(0, Math.min(count - 1, raw));
}

function ChatHeadStatusDot({ chat, currentUserId }: { chat: ChatInstance; currentUserId: string }) {
  const { getStatus } = useChat();
  const otherParticipant = chat.participants?.find(p => p.userId !== currentUserId);
  const status = otherParticipant ? getStatus(otherParticipant.userId) : 'offline';

  return (
    <Box
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        zIndex: 1,
        width: 14,
        height: 14,
        borderRadius: '50%',
        backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.offline,
        border: '2px solid white',
      }}
    />
  );
}

const GROUP_OVERLAP_COLLAPSED = 34;
const GROUP_OVERLAP_EXPANDED = 16;

function GroupAvatars({
  participants,
  isActive,
  currentUserId,
}: {
  participants: ChatInstance['participants'];
  isActive: boolean;
  currentUserId: string;
}) {
  const others = (participants || []).filter(p => p.userId !== currentUserId);
  const visible = others.slice(0, 3);
  const extra = others.length - 3;
  const size = HEAD_SIZE;
  const totalCount = visible.length + (extra > 0 ? 1 : 0);

  const [hovered, setHovered] = useState(false);
  const overlap = hovered ? GROUP_OVERLAP_EXPANDED : GROUP_OVERLAP_COLLAPSED;

  const spring = useSpring({
    overlap,
    config: SPRING_CONFIG,
  });

  return (
    <animated.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        position: 'relative' as const,
        width: spring.overlap.to(o => size + (totalCount - 1) * (size - o)),
        height: HEAD_SIZE,
        alignItems: 'center',
      }}
    >
      {visible.map((p, idx) => {
        const pColor = deterministicColor(p.userId);
        return (
          <animated.div
            key={p.userId}
            style={{
              position: 'absolute' as const,
              left: spring.overlap.to(o => idx * (size - o)),
              zIndex: visible.length - idx,
            }}
          >
            <Avatar
              size={size}
              radius="xl"
              color={COLOR_HEX[pColor]}
              style={{
                border: '2px solid white',
                backgroundColor: lightColor(pColor),
                color: COLOR_HEX[pColor] ?? COLOR_HEX.gray,
                boxShadow: isActive ? '0 4px 8px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              {p.initials}
            </Avatar>
          </animated.div>
        );
      })}
      {extra > 0 && (
        <animated.div
          style={{
            position: 'absolute' as const,
            left: spring.overlap.to(o => visible.length * (size - o)),
            zIndex: 0,
          }}
        >
          <Avatar
            size={size}
            radius="xl"
            color="gray"
            style={{
              border: '2px solid white',
              backgroundColor: lightColor('gray'),
              color: COLOR_HEX.gray,
            }}
          >
            <Text size="xs">+{extra}</Text>
          </Avatar>
        </animated.div>
      )}
    </animated.div>
  );
}

export function ChatHeadsContainer() {
  const { chats, activeChatPatientId, unreadCounts, activateChat, minimizeActiveChat, closeChat, reorderChat } =
    useChatManager();
  const { user } = useAccount();
  const isDesktop = useMediaQuery(media.md);
  const { pathname } = useLocation();
  const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r));

  const dragDistRef = useRef(0);
  const settlingRef = useRef(false);

  const chatKey = chats.map(c => c.patientId).join(',');

  // Clear settling flag after React has rendered with the new order.
  // This runs synchronously after useSprings reinit, so the flag is
  // guaranteed to be true during reinit and false afterwards.
  useEffect(() => {
    if (settlingRef.current) {
      settlingRef.current = false;
    }
  }, [chatKey]);

  const closingRef = useRef<string | null>(null);

  const [springs, api] = useSprings(
    chats.length,
    i => ({
      x: 0,
      y: -(i * HEAD_OFFSET),
      scale: 1,
      zIndex: 0,
      immediate: settlingRef.current,
      config: SPRING_CONFIG,
    }),
    [chatKey]
  );

  const bind = useDrag(({ args: [idx], active, movement: [mx, my], first, memo }) => {
    const index = idx as number;

    if (first) {
      dragDistRef.current = 0;
      memo = { startY: -(index * HEAD_OFFSET) };
    }

    dragDistRef.current = Math.max(dragDistRef.current, Math.abs(mx) + Math.abs(my));
    const currentY = memo.startY + my;
    const targetSlot = dragSlot(chats.length, currentY);

    if (active) {
      api.start(i => {
        if (i === index) {
          return {
            x: mx,
            y: currentY,
            scale: 1.1,
            zIndex: 1,
            immediate: (key: string) => key === 'x' || key === 'y' || key === 'zIndex',
          };
        }
        let slot: number;
        if (index < targetSlot) {
          slot = i > index && i <= targetSlot ? i - 1 : i;
        } else if (index > targetSlot) {
          slot = i >= targetSlot && i < index ? i + 1 : i;
        } else {
          slot = i;
        }
        return { y: -(slot * HEAD_OFFSET), scale: 1, zIndex: 0, immediate: false };
      });
    } else {
      // Release: bounce the dragged item to its target slot.
      // Once the spring finishes, commit the reorder to state.
      // settlingRef + useEffect ensure the useSprings reinit
      // doesn't animate (immediate: true during that render).
      const shouldReorder = targetSlot !== index;
      const patientId = chats[index]?.patientId;

      api.start(i => {
        if (i === index) {
          return {
            x: 0,
            y: -(targetSlot * HEAD_OFFSET),
            scale: 1,
            zIndex: 0,
            immediate: false,
            onRest: shouldReorder
              ? () => {
                  settlingRef.current = true;
                  reorderChat(patientId, targetSlot);
                }
              : undefined,
          };
        }
        return {};
      });
    }
    return memo;
  });

  const handleCloseRef = useRef<(patientId: string) => void>(undefined);

  const handleCloseFromPanel = useCallback(
    (patientId: string) => {
      minimizeActiveChat();
      setTimeout(() => handleCloseRef.current?.(patientId), 250);
    },
    [minimizeActiveChat]
  );

  const handleClose = useCallback(
    (patientId: string) => {
      const index = chats.findIndex(c => c.patientId === patientId);
      if (index === -1) return;
      closingRef.current = patientId;

      // Safety fallback: if onRest never fires, force-close after 500ms
      const fallback = setTimeout(() => {
        if (closingRef.current === patientId) {
          closingRef.current = null;
          settlingRef.current = true;
          closeChat(patientId);
        }
      }, 500);

      api.start(i => {
        if (i === index) {
          return {
            scale: 0,
            immediate: false,
            onRest: () => {
              clearTimeout(fallback);
              closingRef.current = null;
              settlingRef.current = true;
              closeChat(patientId);
            },
          };
        }
        // Shift heads above the closed one down by one slot
        if (i > index) {
          return { y: -((i - 1) * HEAD_OFFSET), immediate: false };
        }
        return {};
      });
    },
    [chats, api, closeChat]
  );

  handleCloseRef.current = handleClose;

  const handleClick = useCallback(
    (patientId: string) => {
      if (dragDistRef.current >= CLICK_THRESHOLD) return;
      if (patientId === activeChatPatientId) {
        minimizeActiveChat();
      } else {
        activateChat(patientId);
      }
    },
    [activeChatPatientId, activateChat, minimizeActiveChat]
  );

  if (!isDesktop || isAuthRoute) return null;
  if (chats.length === 0) return null;

  return (
    <>
      {chats.map(chat => (
        <AnimatedChatPanel
          key={chat.patientId}
          chat={chat}
          isActive={chat.patientId === activeChatPatientId}
          onMinimize={minimizeActiveChat}
          onClose={() => handleCloseFromPanel(chat.patientId)}
        />
      ))}

      {springs.map((style, i) => {
        const chat = chats[i];
        if (!chat) return null;
        const isActive = chat.patientId === activeChatPatientId;
        const color = chat.color;
        const isMessaging = chat.type === 'messaging';
        const isGroup = isMessaging && chat.participants && chat.participants.length > 2;

        return (
          <animated.div
            {...bind(i)}
            key={chat.patientId}
            onClick={() => handleClick(chat.patientId)}
            style={{
              x: style.x,
              y: style.y,
              scale: style.scale,

              zIndex: style.zIndex.to(z => (z ? 1400 : 1200)),
              position: 'fixed',
              right: `${HEADS_RIGHT}px`,
              bottom: `${HEADS_RIGHT}px`,
              height: HEAD_SIZE,
              touchAction: 'none',
              cursor: 'grab',
            }}
          >
            <Tooltip label={chat.patientName} position="left" withArrow zIndex={1400}>
              <Box style={{ position: 'relative', display: 'inline-flex' }}>
                {isGroup && chat.participants ? (
                  <GroupAvatars participants={chat.participants} isActive={isActive} currentUserId={user?.id ?? ''} />
                ) : (
                  <Avatar
                    size={HEAD_SIZE}
                    radius="xl"
                    color={COLOR_HEX[color]}
                    style={{
                      backgroundColor: lightColor(color),
                      color: COLOR_HEX[color] ?? COLOR_HEX.gray,
                      boxShadow: isActive
                        ? `0 0 0 3px ${COLOR_HEX[color] ?? COLOR_HEX.gray}, 0 2px 4px rgba(0,0,0,0.1), 0 12px 24px rgba(0,0,0,0.075)`
                        : '0 2px 4px rgba(0,0,0,0.1)',
                      transition: 'box-shadow 200ms ease',
                    }}
                  >
                    {chat.patientInitials}
                  </Avatar>
                )}
              </Box>
            </Tooltip>
            <ActionIcon
              size={18}
              radius="xl"
              variant="filled"
              color="dark"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                handleClose(chat.patientId);
              }}
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                zIndex: 1,
                opacity: 0,
                transition: 'opacity 150ms ease',
                pointerEvents: isActive ? 'none' : 'auto',
              }}
              className="chat-head-close"
            >
              <X size={10} />
            </ActionIcon>
            {(() => {
              const unread = unreadCounts.get(chat.patientId) ?? 0;
              if (unread === 0) return null;
              return (
                <Box
                  style={{
                    position: 'absolute',
                    top: -4,
                    left: -4,
                    zIndex: 10,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: 'var(--mantine-color-red-6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 5px',
                    border: '2px solid white',
                  }}
                >
                  <Text size="10px" c="white" fw={700} lh={1}>
                    {unread > 99 ? '99+' : unread}
                  </Text>
                </Box>
              );
            })()}
            {isMessaging && !isGroup && <ChatHeadStatusDot chat={chat} currentUserId={user?.id ?? ''} />}
            {!isMessaging && (
              <Box
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  zIndex: 1,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: 'var(--mantine-color-violet-filled)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={12} color="white" />
              </Box>
            )}
          </animated.div>
        );
      })}

      <style>{`
        [style*="cursor: grab"]:hover .chat-head-close {
          opacity: 1 !important;
        }
      `}</style>
    </>
  );
}
