import { createContext, useContext, useCallback, type CSSProperties, type ReactNode } from 'react';
import { Stack } from '@mantine/core';
import { useNavigate } from '@remix-run/react';
import { Plus } from 'lucide-react';

import { styled } from '~/styled-system/jsx';

// ---------------------------------------------------------------------------
// Styled primitives
// ---------------------------------------------------------------------------

const FabContainer = styled('div', {
  base: {
    position: 'fixed',
    bottom: '6rem',
    right: '1.25rem',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.75rem',
  },
});

const StyledFabItem = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    border: 'none',
    borderRadius: '2rem',
    padding: '0.625rem 1rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    boxShadow: 'inset 0 0 0 1px var(--mantine-primary-color-1)',
    background: 'var(--mantine-primary-color-0)',
    color: 'var(--mantine-primary-color-7)',
    transformOrigin: 'bottom right',
    transition: 'opacity 200ms ease, transform 200ms ease',

    '&:active': {
      background: 'var(--mantine-primary-color-1)',
    },
  },
});

const FabTrigger = styled('button', {
  base: {
    width: '3.25rem',
    height: '3.25rem',
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    background: 'var(--mantine-primary-color-4)',
    color: 'white',
    transition: 'transform 200ms ease',
    zIndex: 40,

    '&:active': {
      transform: 'scale(0.92)',
    },
  },
});

const FabBackdrop = styled('div', {
  base: {
    position: 'fixed',
    bottom: '4.55rem',
    height: '40vh',
    right: 0,
    left: 0,
    background: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(2px)',
    maskImage: 'radial-gradient(at bottom right, black 40%, transparent 70%)',
    zIndex: 99,
  },
});

// ---------------------------------------------------------------------------
// Context — lets FabItem read open state for animations
// ---------------------------------------------------------------------------

const FabContext = createContext(false);

// ---------------------------------------------------------------------------
// FabItem — menu item that animates based on parent open state
// ---------------------------------------------------------------------------

interface FabItemProps {
  children: ReactNode;
  onClick?: () => void;
  index: number;
  disabled?: boolean;
  style?: CSSProperties;
}

export function FabItem({ children, onClick, index, disabled, style }: FabItemProps) {
  const isOpen = useContext(FabContext);

  const animStyle: CSSProperties = {
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? 'scale(1)' : 'scale(0)',
    transitionDelay: isOpen ? `${index * 60}ms` : '0ms',
    pointerEvents: isOpen ? 'auto' : 'none',
    ...(disabled ? { opacity: isOpen ? 0.4 : 0, cursor: 'default' } : {}),
    ...style,
  };

  return (
    <StyledFabItem onClick={disabled ? undefined : onClick} style={animStyle}>
      {children}
    </StyledFabItem>
  );
}

// ---------------------------------------------------------------------------
// Fab — single-action or multi-action floating action button
// ---------------------------------------------------------------------------

interface SingleFabProps {
  children?: never;
  icon?: ReactNode;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  open?: never;
  onToggle?: never;
  onClose?: never;
}

interface MultiFabProps {
  children: ReactNode;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  icon?: never;
  to?: never;
  onClick?: never;
  disabled?: never;
}

type FabProps = SingleFabProps | MultiFabProps;

export function Fab(props: FabProps) {
  if (props.children != null) {
    const { children, open, onToggle, onClose } = props as MultiFabProps;
    return (
      <FabContext.Provider value={open}>
        {open && <FabBackdrop onClick={onClose} />}
        <FabContainer>
          <Stack gap="xs" align="flex-end">
            {children}
          </Stack>
          <FabTrigger onClick={onToggle}>
            <Plus
              size={22}
              style={{
                transition: 'transform 250ms ease',
                transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
              }}
            />
          </FabTrigger>
        </FabContainer>
      </FabContext.Provider>
    );
  }

  const { icon, to, onClick, disabled } = props as SingleFabProps;
  return <SingleFab icon={icon} to={to} onClick={onClick} disabled={disabled} />;
}

function SingleFab({ icon, to, onClick, disabled }: SingleFabProps) {
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    }
  }, [disabled, onClick, to, navigate]);

  return (
    <FabContainer>
      <FabTrigger onClick={handleClick} style={disabled ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
        {icon ?? <Plus size={22} />}
      </FabTrigger>
    </FabContainer>
  );
}
