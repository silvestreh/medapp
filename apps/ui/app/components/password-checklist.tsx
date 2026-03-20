import { useEffect, useMemo, useRef, useState } from 'react';
import { Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react';

import { css } from '~/styled-system/css';
import { styled } from '~/styled-system/jsx';

type ZxcvbnModule = typeof import('@zxcvbn-ts/core');

type PasswordChecklistProps = {
  password: string;
  onValidityChange?: (isValid: boolean) => void;
};

type RequirementKey =
  | 'password_checklist.req_min_length'
  | 'password_checklist.req_uppercase'
  | 'password_checklist.req_lowercase'
  | 'password_checklist.req_digit'
  | 'password_checklist.req_special';

type Requirement = {
  key: RequirementKey;
  met: boolean;
};

const STRENGTH_COLORS = ['var(--mantine-color-red-6)', 'var(--mantine-color-orange-5)', 'var(--mantine-color-yellow-6)', 'var(--mantine-color-teal-6)'];

const STRENGTH_KEYS = [
  'password_checklist.strength_weak',
  'password_checklist.strength_fair',
  'password_checklist.strength_strong',
  'password_checklist.strength_very_strong',
] as const;

const Container = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '0.75rem 1rem',
  },
});

const RequirementRow = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
});

const BarContainer = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
});

const BarTrack = styled('div', {
  base: {
    display: 'flex',
    gap: '3px',
    flex: 1,
    maxWidth: '200px',
  },
});

const BarSegment = styled('div', {
  base: {
    height: '4px',
    flex: 1,
    borderRadius: '2px',
    backgroundColor: 'var(--mantine-color-gray-2)',
    transition: 'background-color 0.2s ease',
  },
});

function checkRequirements(password: string): Requirement[] {
  return [
    { key: 'password_checklist.req_min_length', met: password.length >= 8 },
    { key: 'password_checklist.req_uppercase', met: /[A-Z]/.test(password) },
    { key: 'password_checklist.req_lowercase', met: /[a-z]/.test(password) },
    { key: 'password_checklist.req_digit', met: /\d/.test(password) },
    { key: 'password_checklist.req_special', met: /[^a-zA-Z0-9]/.test(password) },
  ];
}

export function PasswordChecklist({ password, onValidityChange }: PasswordChecklistProps) {
  const { t } = useTranslation();
  const zxcvbnRef = useRef<ZxcvbnModule | null>(null);
  const [zxcvbnLoaded, setZxcvbnLoaded] = useState(false);
  const [debouncedPassword] = useDebouncedValue(password, 150);

  useEffect(() => {
    let cancelled = false;

    async function loadZxcvbn() {
      if (zxcvbnRef.current) return;

      const [core, commonPkg, enPkg] = await Promise.all([
        import('@zxcvbn-ts/core'),
        import('@zxcvbn-ts/language-common'),
        import('@zxcvbn-ts/language-en'),
      ]);

      if (cancelled) return;

      core.zxcvbnOptions.setOptions({
        graphs: commonPkg.default.adjacencyGraphs ?? (commonPkg as any).adjacencyGraphs,
        dictionary: {
          ...(commonPkg.default.dictionary ?? (commonPkg as any).dictionary),
          ...(enPkg.default.dictionary ?? (enPkg as any).dictionary),
        },
      });

      zxcvbnRef.current = core;
      setZxcvbnLoaded(true);
    }

    loadZxcvbn();
    return () => { cancelled = true; };
  }, []);

  const requirements = useMemo(() => checkRequirements(password), [password]);
  const allRequirementsMet = useMemo(() => requirements.every(r => r.met), [requirements]);

  const strengthScore = useMemo(() => {
    if (!zxcvbnLoaded || !zxcvbnRef.current || !debouncedPassword) return null;
    const result = zxcvbnRef.current.zxcvbn(debouncedPassword);
    return result.score;
  }, [zxcvbnLoaded, debouncedPassword]);

  const isValid = allRequirementsMet && (strengthScore === null || strengthScore >= 2);

  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  if (!password) return null;

  const filledSegments = strengthScore !== null ? Math.min(strengthScore + 1, 4) : 0;
  const strengthColorIndex = strengthScore !== null ? Math.min(strengthScore, 3) : 0;
  const strengthColor = STRENGTH_COLORS[strengthColorIndex];

  return (
    <Container>
      {requirements.map(req => (
        <RequirementRow key={req.key}>
          {req.met && (
            <CheckCircleIcon
              size={16}
              weight="fill"
              className={css({ color: 'var(--mantine-color-teal-6)', flexShrink: 0 })}
            />
          )}
          {!req.met && (
            <XCircleIcon
              size={16}
              weight="fill"
              className={css({ color: 'var(--mantine-color-red-6)', flexShrink: 0 })}
            />
          )}
          <Text size="xs" c={req.met ? 'teal.6' : 'red.6'}>
            {t(req.key)}
          </Text>
        </RequirementRow>
      ))}

      {zxcvbnLoaded && debouncedPassword && (
        <>
          <BarContainer>
            <BarTrack>
              {[0, 1, 2, 3].map(i => (
                <BarSegment
                  key={i}
                  style={i < filledSegments ? { backgroundColor: strengthColor } : undefined}
                />
              ))}
            </BarTrack>
            <Text size="xs" fw={500} c="dimmed">
              {t(STRENGTH_KEYS[strengthColorIndex])}
            </Text>
          </BarContainer>

          {allRequirementsMet && strengthScore !== null && strengthScore < 2 && (
            <Text size="xs" c="orange.6" mt={4}>
              {t('password_checklist.too_guessable')}
            </Text>
          )}
        </>
      )}
    </Container>
  );
}
