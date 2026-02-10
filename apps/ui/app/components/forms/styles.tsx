import { Text, TextInput, Textarea, Title } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { styled } from '~/styled-system/jsx';

export const FormContainer = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
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
});

export const Label = styled(Text, {
  base: {
    color: 'var(--mantine-color-gray-6)',

    lg: {
      marginRight: '1rem',
      textAlign: 'right',
      width: '25%',
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
    flex: 1,

    '& .mantine-DateInput-input': {
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

export const ItemHeader = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
});
