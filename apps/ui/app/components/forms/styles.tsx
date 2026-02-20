import { forwardRef, useCallback, useRef, useState, type ReactNode } from 'react';
import { TextInput, Textarea, PasswordInput, Title, Stack, Select, Checkbox, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { styled } from '~/styled-system/jsx';

export interface TriStateCheckboxProps {
  value?: boolean | 'indeterminate';
  onChange?: (value: boolean | 'indeterminate') => void;
  label?: React.ReactNode;
  readOnly?: boolean;
  disabled?: boolean;
}

export function TriStateCheckbox({ value, onChange, label, readOnly, disabled }: TriStateCheckboxProps) {
  if (readOnly) {
    let text = '—';
    if (value === true) text = 'Yes';
    if (value === false) text = 'No';

    return (
      <Stack gap={4}>
        {label && (
          <Text size="sm" c="gray.6">
            {label}
          </Text>
        )}
        <Text size="sm">{text}</Text>
      </Stack>
    );
  }

  const handleToggle = () => {
    if (disabled || readOnly) return;

    if (value === 'indeterminate' || value === undefined) {
      onChange?.(true);
    } else if (value === true) {
      onChange?.(false);
    } else {
      onChange?.('indeterminate');
    }
  };

  return (
    <Checkbox
      label={label}
      checked={value === true}
      indeterminate={value === 'indeterminate' || value === undefined}
      onChange={handleToggle}
      disabled={disabled}
      styles={{
        input: { cursor: disabled ? 'not-allowed' : 'pointer' },
        label: {
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: 'var(--mantine-color-gray-6)',
          fontSize: 'var(--mantine-font-size-md)',
          paddingLeft: '0.5rem',
        },
      }}
    />
  );
}

export const FormContainer = styled(Stack, {
  base: {
    gap: '0.5rem',
    width: '100%',
  },
});

export const FormCard = styled('div', {
  base: {
    background: 'white',
    border: '1px solid var(--mantine-color-gray-2)',
    borderRadius: 'var(--mantine-radius-md)',
    overflow: 'hidden',
  },
});

const FieldRowBase = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    borderBottom: '1px solid var(--mantine-color-gray-2)',

    '&:last-child': {
      borderBottom: 'none',
    },

    lg: {
      alignItems: 'flex-start',
      flexDirection: 'row',
    },
  },
  variants: {
    stacked: {
      true: {
        gap: '0.5rem',
        lg: {
          flexDirection: 'column',
          alignItems: 'stretch',
        },
      },
    },
    checkbox: {
      true: {
        lg: {
          alignItems: 'center',
          paddingLeft: 'calc(25% + 1rem)',
        },
      },
    },
    noOffset: {
      true: {
        lg: {
          paddingLeft: '1rem!',
        },
      },
    },
    nested: {
      true: {
        lg: {
          paddingLeft: '1rem!',
        },
      },
    },
  },
});

type FieldRowProps = React.ComponentPropsWithoutRef<typeof FieldRowBase> & {
  label?: ReactNode;
  hint?: ReactNode;
  variant?: 'stacked';
};

export const FieldRow = forwardRef<HTMLDivElement, FieldRowProps>(
  ({ label, hint, variant, children, stacked, ...rest }, forwardedRef) => {
    const localRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const isStacked = variant === 'stacked' || stacked;

    const setRef = useCallback(
      (node: HTMLDivElement | null) => {
        localRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef]
    );

    const handleLabelClick = useCallback(() => {
      const el = localRef.current?.querySelector<HTMLElement>('input, textarea, select, [role="combobox"]');
      el?.focus();
    }, []);

    const handleFocusCapture = useCallback(() => setIsFocused(true), []);
    const handleBlurCapture = useCallback(() => setIsFocused(false), []);

    if (label == null) {
      return (
        <FieldRowBase ref={setRef} stacked={isStacked || undefined} {...rest}>
          {children}
        </FieldRowBase>
      );
    }

    return (
      <FieldRowBase ref={setRef} stacked={isStacked || undefined} {...rest}>
        <Label
          stacked={isStacked || undefined}
          focused={isFocused || undefined}
          onClick={handleLabelClick}
          style={{ cursor: 'pointer' }}
        >
          {label}
        </Label>
        <div style={{ flex: 1, minWidth: 0 }} onFocusCapture={handleFocusCapture} onBlurCapture={handleBlurCapture}>
          {children}
          {hint}
        </div>
      </FieldRowBase>
    );
  }
);

FieldRow.displayName = 'FieldRow';

const Label = styled('div', {
  base: {
    color: 'var(--mantine-color-gray-6)',
    fontSize: 'var(--mantine-font-size-md)',
    transition: 'color 120ms ease',

    lg: {
      marginRight: '1rem',
      textAlign: 'right',
      width: '25%',
    },
  },
  variants: {
    stacked: {
      true: {
        lg: {
          width: '100%!',
          textAlign: 'left!',
          marginRight: '0!',
        },
      },
    },
    checkbox: {
      true: {
        lg: {
          width: 'auto',
          textAlign: 'left',
          marginRight: 0,
          marginLeft: '0.5rem',
        },
      },
    },
    focused: {
      true: {
        color: 'var(--mantine-color-blue-6)',
      },
    },
  },
});

export const StyledTextInput = styled(TextInput, {
  base: {
    flex: 1,

    '& .mantine-TextInput-input': {
      border: 'none',
      padding: 0,
      height: 'auto',
      minHeight: '1.75rem',
      lineHeight: 1.75,
      fontSize: 'var(--mantine-font-size-md)',

      '&:focus': {
        boxShadow: 'none',
      },
    },
  },
});

export const StyledPasswordInput = styled(PasswordInput, {
  base: {
    flex: 1,

    '& .mantine-PasswordInput-input': {
      border: 'none',
      padding: 0,
      height: 'auto',
      minHeight: '1.75rem',
      lineHeight: 1.75,
      fontSize: 'var(--mantine-font-size-md)',

      '&:focus-within': {
        boxShadow: 'none',
      },
    },

    '& .mantine-PasswordInput-innerInput': {
      padding: 0,
      height: 'auto',
      minHeight: '1.75rem',
      lineHeight: 1.75,
      fontSize: 'var(--mantine-font-size-md)',
    },
  },
});

export const StyledTextarea = styled(Textarea, {
  base: {
    flex: 1,

    '& .mantine-Textarea-input': {
      border: 'none',
      padding: 0,
      height: 'auto',
      minHeight: '1.75rem',
      lineHeight: 1.5,
      backgroundColor: 'transparent',
      fontSize: 'var(--mantine-font-size-md)',

      '&:focus': {
        boxShadow: 'none',
      },
    },
  },
});

const StyledDateInputBase = styled(DateInput, {
  base: {
    backgroundColor: 'transparent',
    flex: 1,

    '& .mantine-DateInput-input': {
      backgroundColor: 'transparent',
      border: 'none',
      padding: 0,
      height: 'auto',
      minHeight: '1.75rem',
      lineHeight: 1.75,
      fontSize: 'var(--mantine-font-size-md)',

      '&:focus': {
        boxShadow: 'none',
      },
    },
  },
});

type StyledDateInputProps = React.ComponentProps<typeof StyledDateInputBase> & {
  rawValue?: string;
};

export function StyledDateInput({ rawValue, ...props }: StyledDateInputProps) {
  const isInvalidDate = props.value instanceof Date && isNaN(props.value.getTime());
  const isUnparsedString = typeof props.value === 'string' && props.value !== '';

  if (props.readOnly && (isInvalidDate || isUnparsedString)) {
    return (
      <Text style={{ flex: 1, lineHeight: 1.75, minHeight: '1.75rem', fontSize: 'var(--mantine-font-size-md)' }}>
        {rawValue || (isUnparsedString ? (props.value as string) : '—')}
      </Text>
    );
  }

  return <StyledDateInputBase {...props} />;
}

export const StyledTitle = styled(Title, {
  base: {
    color: 'var(--mantine-color-blue-4)',
    fontWeight: 400,

    sm: {
      fontSize: '1.5rem',
    },
    md: {
      fontSize: '2rem',
    },
  },
});

export const FormHeader = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
});

export const IndentedSection = styled(Stack, {
  base: {
    gap: 0,
    background: 'var(--mantine-color-gray-0)',
  },
  variants: {
    indented: {
      true: {
        lg: {
          paddingLeft: '25%',
        },
      },
    },
  },
  defaultVariants: {
    indented: true,
  },
});

export const ItemHeader = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
});

export const StyledSelect = styled(Select, {
  base: {
    backgroundColor: 'transparent',
    border: 'none',
    flex: 1,

    '& .mantine-Select-input': {
      border: 'none',
      backgroundColor: 'transparent',
      flex: 1,
      height: 'auto',
      minHeight: '1.75rem',
      lineHeight: 1.75,
      padding: 0,
      fontSize: 'var(--mantine-font-size-md)',

      '&:focus': {
        boxShadow: 'none',
      },
    },
  },
});
