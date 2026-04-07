import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionIcon, Box, Group, Image, Loader, ScrollArea, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { GifTile } from '~/components/chat/gif-tile';
import type { GiphyImage } from '~/components/chat/gif-tile';

interface GiphySearchResponse {
  data: GiphyImage[];
  pagination: { total_count: number; count: number; offset: number };
}

interface GifPickerProps {
  searchTerm: string;
  onSelect: (gif: { url: string; previewUrl: string; title: string; fileSize: number }) => void;
  onClose: () => void;
  onCreatorSearch: (username: string) => void;
}

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY ?? '';
const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search';
const GIPHY_TRENDING_URL = 'https://api.giphy.com/v1/gifs/trending';
const PAGE_SIZE = 20;

export function GifPicker({ searchTerm, onSelect, onClose, onCreatorSearch }: GifPickerProps) {
  const { t } = useTranslation();
  const [results, setResults] = useState<GiphyImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedTerm] = useDebouncedValue(searchTerm, 400);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!GIPHY_API_KEY) {
      setError('Giphy API key not configured');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchGifs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          api_key: GIPHY_API_KEY,
          limit: String(PAGE_SIZE),
          rating: 'g',
        });

        let url: string;
        if (debouncedTerm.trim()) {
          params.set('q', debouncedTerm.trim());
          url = `${GIPHY_SEARCH_URL}?${params}`;
        } else {
          url = `${GIPHY_TRENDING_URL}?${params}`;
        }

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Giphy API error: ${res.status}`);

        const json: GiphySearchResponse = await res.json();
        setResults(json.data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(t('chat.gif_search_error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchGifs();

    return () => controller.abort();
  }, [debouncedTerm, t]);

  const handleSelect = useCallback(
    (gif: GiphyImage) => {
      onSelect({
        url: gif.images.original.url,
        previewUrl: gif.images.fixed_height.url,
        title: gif.title,
        fileSize: parseInt(gif.images.original.size, 10) || 0,
      });
    },
    [onSelect]
  );

  return (
    <Box
      style={{
        flexShrink: 0,
        borderBottom: '1px solid var(--mantine-color-gray-2)',
        backgroundColor: 'var(--mantine-color-gray-0)',
      }}
    >
      <Group gap="xs" px="md" py={4} justify="space-between">
        <Text size="xs" fw={600} c="dimmed">
          {debouncedTerm.trim() ? t('chat.gif_results_for', { term: debouncedTerm.trim() }) : t('chat.gif_trending')}
        </Text>
        <ActionIcon variant="subtle" color="gray" size="xs" onClick={onClose}>
          <XIcon size={14} />
        </ActionIcon>
      </Group>

      <ScrollArea h={200} px="md" pb="xs">
        {isLoading && (
          <Box style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Loader size="sm" />
          </Box>
        )}

        {error && (
          <Text size="xs" c="red" ta="center" py="md">
            {error}
          </Text>
        )}

        {!isLoading && !error && results.length === 0 && (
          <Text size="xs" c="dimmed" ta="center" py="md">
            {t('chat.gif_no_results')}
          </Text>
        )}

        {!isLoading && !error && results.length > 0 && (
          <Box style={{ columns: 3, columnGap: 4 }}>
            {results.map(gif => (
              <GifTile key={gif.id} gif={gif} onSelect={handleSelect} onCreatorSearch={onCreatorSearch} />
            ))}
          </Box>
        )}
      </ScrollArea>

      {/*<Box px="md" pb={4} style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Image src="/giphy-powered-badge.png" alt="Powered by GIPHY" h={16} w="auto" style={{ opacity: 0.6 }} />
      </Box>*/}
    </Box>
  );
}
