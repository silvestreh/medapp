import { useCallback, useEffect, useRef } from 'react';
import { ActionIcon, Box, Popover } from '@mantine/core';
import { SmileyIcon } from '@phosphor-icons/react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface EmojiPickerProps {
  opened: boolean;
  onToggle: () => void;
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

interface EmojiMartEmoji {
  native: string;
}

export function EmojiPicker({ opened, onToggle, onSelect, disabled }: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const handleSelect = useCallback(
    (emoji: EmojiMartEmoji) => {
      onSelect(emoji.native);
    },
    [onSelect]
  );

  // Close on Escape
  useEffect(() => {
    if (!opened) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggle();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opened, onToggle]);

  return (
    <Popover opened={opened} onChange={onToggle} position="top-end" withinPortal zIndex={1400} shadow="md">
      <Popover.Target>
        <ActionIcon variant="subtle" color="gray" size="lg" mr="xs" onClick={onToggle} disabled={disabled}>
          <SmileyIcon size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown p={0} ref={pickerRef} style={{ border: 'none', background: 'none' }}>
        <Box data-interactive>
          <Picker
            data={data}
            onEmojiSelect={handleSelect}
            theme="light"
            previewPosition="none"
            skinTonePosition="search"
            perLine={8}
            maxFrequentRows={2}
          />
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}
