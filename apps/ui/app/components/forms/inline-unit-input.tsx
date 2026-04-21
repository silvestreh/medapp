import { useLayoutEffect, useRef, useState } from 'react';
import type { TextInputProps } from '@mantine/core';
import { styled } from '~/styled-system/jsx';
import { StyledTextInput } from './styles';

const Wrapper = styled('div', {
  base: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
  },
});

const mirrorStyle: React.CSSProperties = {
  position: 'absolute',
  visibility: 'hidden',
  pointerEvents: 'none',
  whiteSpace: 'pre',
  top: 0,
  left: 0,
  fontSize: 'var(--mantine-font-size-md)',
  lineHeight: 1.75,
};

const unitBaseStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  pointerEvents: 'none',
  color: 'var(--mantine-color-gray-6)',
  fontSize: 'var(--mantine-font-size-md)',
  lineHeight: 1.75,
  whiteSpace: 'nowrap',
};

interface InlineUnitInputProps extends Omit<TextInputProps, 'rightSection'> {
  unit?: string;
}

export function InlineUnitInput({ unit, value, ...rest }: InlineUnitInputProps) {
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const [mirrorWidth, setMirrorWidth] = useState(0);

  useLayoutEffect(() => {
    if (mirrorRef.current) {
      setMirrorWidth(mirrorRef.current.offsetWidth);
    }
  }, [value]);

  const displayValue = value == null ? '' : String(value);
  const showUnit = Boolean(unit) && displayValue.length > 0;

  return (
    <Wrapper>
      <StyledTextInput value={value} {...rest} />
      <span ref={mirrorRef} style={mirrorStyle} aria-hidden>
        {displayValue}
      </span>
      {showUnit && <span style={{ ...unitBaseStyle, left: mirrorWidth + 4 }}>{unit}</span>}
    </Wrapper>
  );
}
