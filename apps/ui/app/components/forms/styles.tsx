import { TextInput, Textarea, Title, Stack, Select } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { styled } from '~/styled-system/jsx';

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

export const FieldRow = styled('div', {
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
        lg: {
          flexDirection: 'column',
          alignItems: 'stretch',
        },
      },
    },
  },
});

export const Label = styled('div', {
  base: {
    color: 'var(--mantine-color-gray-6)',
    fontSize: 'var(--mantine-font-size-md)',

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
          marginBottom: '0.5rem',
          marginRight: '0!',
        },
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
      minHeight: '1.5rem',
      lineHeight: 1.75,

      '&:focus': {
        boxShadow: 'none',
      },
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
      minHeight: '1.5rem',
      lineHeight: 1.75,

      '&:focus': {
        boxShadow: 'none',
      },
    },
  },
});

export const StyledDateInput = styled(DateInput, {
  base: {
    backgroundColor: 'transparent',
    flex: 1,

    '& .mantine-DateInput-input': {
      backgroundColor: 'transparent',
      border: 'none',
      padding: 0,
      height: 'auto',
      minHeight: '1.5rem',
      lineHeight: 1.75,

      '&:focus': {
        boxShadow: 'none',
      },
    },
  },
});

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

    '& .mantine-Select-input': {
      backgroundColor: 'transparent',
      flex: 1,
      height: 'auto',
      minHeight: '1.5rem',
      lineHeight: 1.75,
      padding: 0,

      '&:focus': {
        boxShadow: 'none',
      },
    },
  },
});
