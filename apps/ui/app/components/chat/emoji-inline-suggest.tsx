import { useEffect, useMemo, useRef } from 'react';
import { Box, ScrollArea, Text } from '@mantine/core';
import data from '@emoji-mart/data';
import type { EmojiMartData } from '@emoji-mart/data';

interface EmojiEntry {
  id: string;
  name: string;
  native: string;
  keywords: string[];
}

// Build a flat searchable list once
const emojiData = data as unknown as EmojiMartData;
const ALL_EMOJIS: EmojiEntry[] = Object.values(emojiData.emojis).map(e => ({
  id: e.id,
  name: e.name,
  native: e.skins[0].native,
  keywords: e.keywords,
}));

// Common emojis shown when query is empty (just `:` typed)
const POPULAR_IDS = [
  'thumbsup', 'heart', 'smile', 'laughing', 'cry', 'fire', 'tada',
  'eyes', 'thinking', 'clap', 'pray', 'muscle', '100', 'rocket',
  'wave', 'ok_hand', 'v', 'star', 'sparkles', 'wink',
];

const POPULAR_EMOJIS = POPULAR_IDS
  .map(id => ALL_EMOJIS.find(e => e.id === id))
  .filter((e): e is EmojiEntry => e !== undefined);

function searchEmojis(query: string, limit = 30): EmojiEntry[] {
  if (!query) return POPULAR_EMOJIS.slice(0, limit);

  const q = query.toLowerCase();
  const results: EmojiEntry[] = [];

  for (const emoji of ALL_EMOJIS) {
    if (results.length >= limit) break;

    if (
      emoji.id.includes(q) ||
      emoji.name.toLowerCase().includes(q) ||
      emoji.keywords.some(k => k.includes(q))
    ) {
      results.push(emoji);
    }
  }

  // Sort: exact id prefix first, then rest
  results.sort((a, b) => {
    const aStart = a.id.startsWith(q) ? 0 : 1;
    const bStart = b.id.startsWith(q) ? 0 : 1;
    return aStart - bStart;
  });

  return results;
}

interface EmojiInlineSuggestProps {
  query: string;
  selectedIndex: number;
  onSelect: (emoji: string) => void;
}

export function EmojiInlineSuggest({ query, selectedIndex, onSelect }: EmojiInlineSuggestProps) {
  const results = useMemo(() => searchEmojis(query), [query]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLDivElement | null>(null);

  // Scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedIndex]);

  if (results.length === 0) return null;

  return (
    <Box
      style={{
        flexShrink: 0,
        borderBottom: '1px solid var(--mantine-color-gray-2)',
        backgroundColor: 'var(--mantine-color-gray-0)',
      }}
    >
      <ScrollArea
        ref={scrollRef}
        type="scroll"
        scrollbarSize={4}
        offsetScrollbars
        px="xs"
        py={4}
        style={{ maxWidth: '100%' }}
      >
        <Box style={{ display: 'flex', gap: 2, whiteSpace: 'nowrap' }}>
          {results.map((emoji, idx) => {
            const isSelected = idx === (selectedIndex % results.length);
            return (
              <Box
                key={emoji.id}
                ref={isSelected ? selectedRef : undefined}
                onClick={() => onSelect(emoji.native)}
                style={{
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: 6,
                  backgroundColor: isSelected
                    ? 'var(--mantine-color-blue-1)'
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                <Text size="lg" lh={1}>{emoji.native}</Text>
                <Text size="xs" c="dimmed" style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  :{emoji.id}:
                </Text>
              </Box>
            );
          })}
        </Box>
      </ScrollArea>
    </Box>
  );
}

/** Returns the number of results for a query (used for keyboard nav bounds) */
export function countEmojiResults(query: string): number {
  return searchEmojis(query).length;
}

/** Returns the native emoji at a given index for a query */
export function getEmojiAtIndex(query: string, index: number): string | null {
  const results = searchEmojis(query);
  if (results.length === 0) return null;
  return results[index % results.length]?.native ?? null;
}
