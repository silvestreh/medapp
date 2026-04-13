import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Image, Text } from '@mantine/core';

export interface GiphyUser {
  username: string;
  display_name: string;
  avatar_url: string;
  profile_url: string;
}

export interface GiphyImage {
  id: string;
  title: string;
  user?: GiphyUser;
  images: {
    fixed_height: { url: string; width: string; height: string };
    original: { url: string; width: string; height: string; size: string };
    fixed_width_small: { url: string; width: string; height: string };
  };
}

const LONG_PRESS_MS = 500;

interface GifTileProps {
  gif: GiphyImage;
  onSelect: (gif: GiphyImage) => void;
  onCreatorSearch: (username: string) => void;
}

export function GifTile({ gif, onSelect, onCreatorSearch }: GifTileProps) {
  const [showCreator, setShowCreator] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pressedRef.current = false;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (showCreator) return;
      clearTimer();
      pressedRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setShowCreator(true);
      }, LONG_PRESS_MS);
    },
    [clearTimer, showCreator]
  );

  const handlePointerUp = useCallback(() => {
    if (showCreator) return;
    if (timerRef.current) {
      clearTimer();
      onSelect(gif);
    }
    pressedRef.current = false;
  }, [clearTimer, gif, onSelect, showCreator]);

  const handleCreatorClick = useCallback(() => {
    if (gif.user?.username) {
      onCreatorSearch(gif.user.username);
    }
    setShowCreator(false);
  }, [gif.user?.username, onCreatorSearch]);

  const handleDismiss = useCallback(() => {
    setShowCreator(false);
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  return (
    <Box
      style={{
        cursor: 'pointer',
        borderRadius: 6,
        overflow: 'hidden',
        position: 'relative',
        breakInside: 'avoid',
        marginBottom: 4,
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handleDismiss}
      onContextMenu={e => e.preventDefault()}
    >
      <Image src={gif.images.fixed_width_small.url} alt={gif.title} w="100%" radius={6} />
      {showCreator && (
        <Box
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            gap: 4,
            padding: 4,
          }}
        >
          {gif.user && (
            <>
              {gif.user.avatar_url && (
                <Image src={gif.user.avatar_url} alt={gif.user.display_name} w={28} h={28} radius="50%" />
              )}
              <Text size="xs" c="white" fw={600} ta="center" lineClamp={1}>
                {gif.user.display_name || gif.user.username}
              </Text>
              <Text
                size="xs"
                c="blue.3"
                ta="center"
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={e => {
                  e.stopPropagation();
                  handleCreatorClick();
                }}
              >
                @{gif.user.username}
              </Text>
            </>
          )}
          {!gif.user && (
            <Text size="xs" c="gray.4" ta="center">
              {gif.title || 'Unknown creator'}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}
