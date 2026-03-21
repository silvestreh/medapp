import { useCallback, useMemo } from 'react';
import { TagsInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export interface Practice {
  id: string;
  title: string;
  description: string;
  isSystem: boolean;
  systemKey: string | null;
}

export interface PracticeCodeRecord {
  id: string;
  practiceId: string;
  userId: string;
  insurerId: string;
  code: string;
}

export interface ResolvedPractice {
  practice: Practice;
  code: string | null;
}

function getCodeForPractice(
  practiceId: string,
  codes: PracticeCodeRecord[],
  insurerId: string | undefined
): string | null {
  if (!insurerId) return null;
  const match = codes.find(c => c.practiceId === practiceId && c.insurerId === insurerId);
  return match?.code || null;
}

export function resolvePractice(
  practiceId: string,
  practices: Practice[],
  codes: PracticeCodeRecord[],
  insurerId: string | undefined
): ResolvedPractice | null {
  const practice = practices.find(p => p.id === practiceId);
  if (!practice) return null;
  return { practice, code: getCodeForPractice(practice.id, codes, insurerId) };
}

export function practiceLine(rp: ResolvedPractice): string {
  return rp.code ? `${rp.practice.description} – ${rp.code}` : rp.practice.description;
}

export function buildPracticeLines(resolved: ResolvedPractice[]): string {
  if (resolved.length === 0) return '';
  return resolved.map(practiceLine).join('\n');
}

/**
 * Given the current textarea content and the known practice lines,
 * detect which practices are still present (exact line match).
 * If a line was edited by the user, it no longer matches and gets removed.
 */
export function detectSelectedFromContent(
  content: string,
  allPractices: Practice[],
  codes: PracticeCodeRecord[],
  insurerId: string | undefined
): ResolvedPractice[] {
  const lines = new Set(content.split('\n').map(l => l.trim()));
  const found: ResolvedPractice[] = [];

  for (const p of allPractices) {
    if (p.systemKey === 'encounter') continue;
    const rp = { practice: p, code: getCodeForPractice(p.id, codes, insurerId) };
    if (lines.has(practiceLine(rp))) {
      found.push(rp);
    }
  }

  return found;
}

/**
 * Clean up partially-edited practice lines.
 * For each previously-selected practice whose exact line is now missing,
 * find any line that shares a long common prefix (>50% of the original)
 * and clear it — the user started editing a practice line.
 */
export function clearEditedPracticeLines(content: string, previouslySelected: ResolvedPractice[]): string {
  if (previouslySelected.length === 0) return content;

  const knownLines = previouslySelected.map(practiceLine);
  const exactSet = new Set(knownLines);
  const missingLines = knownLines.filter(kl => !content.split('\n').some(l => l.trim() === kl));

  if (missingLines.length === 0) return content;

  const lines = content.split('\n');
  const cleaned = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'Solicito:' || exactSet.has(trimmed)) return line;

    for (const missing of missingLines) {
      const threshold = Math.floor(missing.length * 0.5);
      const prefix = missing.slice(0, threshold);
      if (trimmed.length >= threshold && (trimmed.startsWith(prefix) || missing.startsWith(trimmed))) {
        return '';
      }
    }
    return line;
  });

  return cleaned
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Apply practice changes to content:
 * - Adds new practice lines that aren't in the content yet
 * - Removes practice lines that are no longer selected
 * - Preserves all other user-typed text
 */
export function applyPracticesToContent(
  currentContent: string,
  prev: ResolvedPractice[],
  next: ResolvedPractice[]
): string {
  const prevLines = new Set(prev.map(practiceLine));
  const nextLines = new Set(next.map(practiceLine));

  // Remove lines that were in prev but not in next
  const linesToRemove = new Set([...prevLines].filter(l => !nextLines.has(l)));
  // Add lines that are in next but not in prev
  const linesToAdd = next.filter(rp => !prevLines.has(practiceLine(rp)));

  let lines = currentContent.split('\n');

  // Remove old practice lines
  if (linesToRemove.size > 0) {
    lines = lines.filter(l => !linesToRemove.has(l.trim()));
  }

  // Clean up any "Solicito:" that's now orphaned (no practice lines follow it)
  lines = lines.filter((l, i) => {
    if (l.trim() === 'Solicito:') {
      const nextNonEmpty = lines.slice(i + 1).find(nl => nl.trim() !== '');
      return nextNonEmpty && nextLines.has(nextNonEmpty.trim());
    }
    return true;
  });

  let result = lines.join('\n').trim();

  // Add new practice lines
  if (linesToAdd.length > 0) {
    const newLines = linesToAdd.map(practiceLine).join('\n');
    const hasSolicito = result.includes('Solicito:');

    if (hasSolicito) {
      // Insert after the last existing practice line in the Solicito block
      const resultLines = result.split('\n');
      const solicitoIdx = resultLines.findIndex(l => l.trim() === 'Solicito:');
      let insertIdx = solicitoIdx + 1;
      while (insertIdx < resultLines.length && nextLines.has(resultLines[insertIdx].trim())) {
        insertIdx++;
      }
      resultLines.splice(insertIdx, 0, newLines);
      result = resultLines.join('\n');
    } else {
      const block = `Solicito:\n${newLines}`;
      result = result ? `${block}\n\n${result}` : block;
    }
  }

  // Clean up multiple blank lines
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}

interface PracticeSelectorProps {
  practices: Practice[];
  codes: PracticeCodeRecord[];
  insurerId: string | undefined;
  insurerName: string | undefined;
  selected: ResolvedPractice[];
  onAdd: (practiceId: string) => void;
  onRemove: (practiceId: string) => void;
  max?: number;
}

export function PracticeSelector({
  practices,
  codes,
  insurerId,
  insurerName,
  selected,
  onAdd,
  onRemove,
  max = 3,
}: PracticeSelectorProps) {
  const { t } = useTranslation();

  const label = insurerName
    ? `${t('recetario.practices_label', 'Prácticas')} (${insurerName})`
    : t('recetario.practices_label', 'Prácticas');

  const selectedIds = useMemo(() => new Set(selected.map(rp => rp.practice.id)), [selected]);

  const suggestions = useMemo(() => {
    if (selected.length >= max) return [];
    return practices
      .filter(p => !selectedIds.has(p.id) && p.systemKey !== 'encounter')
      .map(p => {
        const code = getCodeForPractice(p.id, codes, insurerId);
        return code ? `${p.title} (${code})` : p.title;
      });
  }, [practices, codes, insurerId, selectedIds, selected.length, max]);

  // Map display labels back to practice IDs
  const labelToPracticeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of practices) {
      const code = getCodeForPractice(p.id, codes, insurerId);
      const label = code ? `${p.title} (${code})` : p.title;
      map.set(label, p.id);
    }
    return map;
  }, [practices, codes, insurerId]);

  const tagValues = useMemo(() => {
    return selected.map(rp => {
      return rp.code ? `${rp.practice.title} (${rp.code})` : rp.practice.title;
    });
  }, [selected]);

  const handleChange = useCallback(
    (values: string[]) => {
      const currentLabels = new Set(values);
      const prevLabels = new Set(tagValues);

      // Detect removed tags
      for (const label of prevLabels) {
        if (!currentLabels.has(label)) {
          const practiceId = labelToPracticeId.get(label);
          if (practiceId) onRemove(practiceId);
        }
      }

      // Detect added tags
      for (const label of currentLabels) {
        if (!prevLabels.has(label)) {
          const practiceId = labelToPracticeId.get(label);
          if (practiceId) onAdd(practiceId);
        }
      }
    },
    [tagValues, labelToPracticeId, onAdd, onRemove]
  );

  if (practices.length === 0) return null;

  return (
    <TagsInput
      label={label}
      placeholder={selected.length < max ? t('recetario.add_practice', 'Agregar práctica...') : ''}
      data={suggestions}
      value={tagValues}
      onChange={handleChange}
      maxTags={max}
      allowDuplicates={false}
    />
  );
}
