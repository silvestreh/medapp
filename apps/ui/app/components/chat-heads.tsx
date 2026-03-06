import { useCallback, useRef } from 'react';
import { ActionIcon, Avatar, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { animated, useSpring, useSprings } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { X } from 'lucide-react';

import { useChatManager, deterministicColor } from '~/components/chat-manager';
import { EncounterChatPanel } from '~/components/encounter-chat-panel';
import { media } from '~/media';

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
}: {
  chat: { patientId: string; encounterDraft: Record<string, any> };
  isActive: boolean;
  onMinimize: () => void;
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
      <EncounterChatPanel
        patientId={chat.patientId}
        encounterDraft={chat.encounterDraft}
        isActive={isActive}
        onMinimize={onMinimize}
      />
    </animated.div>
  );
}

// Given original index and current drag Y, figure out which slot the drag is over
function dragSlot(count: number, dragY: number): number {
  const raw = Math.round(-dragY / HEAD_OFFSET);
  return Math.max(0, Math.min(count - 1, raw));
}

export function ChatHeadsContainer() {
  const { chats, activeChatPatientId, activateChat, minimizeActiveChat, closeChat, reorderChat } = useChatManager();
  const isDesktop = useMediaQuery(media.md);

  const dragDistRef = useRef(0);
  const settlingRef = useRef(false);

  const chatKey = chats.map(c => c.patientId).join(',');

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
      // Others are already in position from the drag phase.
      api.start(i => {
        if (i === index) {
          return {
            x: 0,
            y: -(targetSlot * HEAD_OFFSET),
            scale: 1,
            zIndex: 0,
            immediate: false,
          };
        }
        // Keep others where they are
        return {};
      });

      // Commit the reorder after the bounce animation finishes
      if (targetSlot !== index) {
        settlingRef.current = true;
        setTimeout(() => {
          reorderChat(chats[index].patientId, targetSlot);
          // Clear settling flag after React has re-rendered
          requestAnimationFrame(() => {
            settlingRef.current = false;
          });
        }, 300);
      }
    }
    return memo;
  });

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

  if (!isDesktop) return null;
  if (chats.length === 0) return null;

  return (
    <>
      {chats.map(chat => (
        <AnimatedChatPanel
          key={chat.patientId}
          chat={chat}
          isActive={chat.patientId === activeChatPatientId}
          onMinimize={minimizeActiveChat}
        />
      ))}

      {springs.map((style, i) => {
        const chat = chats[i];
        if (!chat) return null;
        const isActive = chat.patientId === activeChatPatientId;
        const color = deterministicColor(chat.patientId);

        return (
          <animated.div
            {...bind(i)}
            key={chat.patientId}
            onClick={() => handleClick(chat.patientId)}
            style={{
              x: style.x,
              y: style.y,
              scale: style.scale,
              zIndex: style.zIndex,
              position: 'fixed',
              right: `${HEADS_RIGHT}px`,
              bottom: `${HEADS_RIGHT}px`,
              touchAction: 'none',
              cursor: 'grab',
            }}
          >
            <Tooltip label={chat.patientName} position="left" withArrow>
              <Avatar
                size={HEAD_SIZE}
                radius="xl"
                color={color}
                style={{
                  boxShadow: isActive
                    ? `0 0 0 3px var(--mantine-color-${color}-filled), 0 4px 12px rgba(0,0,0,0.2)`
                    : '0 4px 12px rgba(0,0,0,0.15)',
                  transition: 'box-shadow 200ms ease',
                }}
              >
                {chat.patientInitials}
              </Avatar>
            </Tooltip>
            <ActionIcon
              size={18}
              radius="xl"
              variant="filled"
              color="dark"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                closeChat(chat.patientId);
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
