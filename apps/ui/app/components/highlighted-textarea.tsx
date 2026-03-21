import { useRef, useCallback, useEffect } from 'react';
import { Text } from '@mantine/core';
import { styled } from '~/styled-system/jsx';

interface HighlightedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  highlightLines: Set<string>;
  label?: string;
  required?: boolean;
  error?: React.ReactNode;
  minRows?: number;
  placeholder?: string;
}

const Wrapper = styled('div', {
  base: {
    position: 'relative',
    width: '100%',
  },
});

const sharedStyles = {
  fontFamily: 'inherit',
  fontSize: 'var(--mantine-font-size-sm)',
  lineHeight: 1.55,
  padding: '8px 12px',
  whiteSpace: 'pre-wrap' as const,
  wordWrap: 'break-word' as const,
  overflowWrap: 'break-word' as const,
  width: '100%',
  boxSizing: 'border-box' as const,
};

const Backdrop = styled('div', {
  base: {
    ...sharedStyles,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    border: '1px solid transparent',
    borderRadius: 'var(--mantine-radius-default)',
    overflow: 'hidden',
  },
});

const StyledTextarea = styled('textarea', {
  base: {
    ...sharedStyles,
    position: 'relative',
    background: 'transparent',
    color: 'transparent',
    caretColor: 'var(--mantine-color-text)',
    border: '1px solid var(--mantine-color-gray-4)',
    borderRadius: 'var(--mantine-radius-default)',
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    minHeight: '60px',
    '&:focus': {
      borderColor: 'var(--mantine-primary-color-filled)',
    },
  },
  variants: {
    hasError: {
      true: {
        borderColor: 'var(--mantine-color-red-6)!',
      },
    },
  },
});

const HighlightedLine = styled('span', {
  base: {
    backgroundColor: 'var(--mantine-primary-color-4)',
    color: 'var(--mantine-color-white)',
    borderRadius: '4px',
    padding: '1px 4px',
    margin: '-1px -4px',
  },
});

export function HighlightedTextarea({
  value,
  onChange,
  highlightLines,
  label,
  required,
  error,
  minRows = 2,
  placeholder,
}: HighlightedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minHeight = minRows * parseFloat(getComputedStyle(el).lineHeight || '22');
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
  }, [minRows]);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.currentTarget.value);
    },
    [onChange]
  );

  const handleScroll = useCallback(() => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const lines = value.split('\n');

  return (
    <div>
      {label && (
        <Text size="sm" fw={500} mb={4}>
          {label} {required && <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span>}
        </Text>
      )}
      <Wrapper>
        <Backdrop ref={backdropRef}>
          {lines.map((line, i) => {
            const trimmed = line.trim();
            const isHighlighted = highlightLines.has(trimmed);
            return (
              <span key={i}>
                {i > 0 && '\n'}
                {isHighlighted && <HighlightedLine>{line}</HighlightedLine>}
                {!isHighlighted && line}
              </span>
            );
          })}
          {value === '' && placeholder && <span style={{ color: 'var(--mantine-color-gray-5)' }}>{placeholder}</span>}
        </Backdrop>
        <StyledTextarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onScroll={handleScroll}
          hasError={!!error || undefined}
          placeholder=""
        />
      </Wrapper>
      {error && (
        <Text size="xs" c="red" mt={4}>
          {error}
        </Text>
      )}
    </div>
  );
}
