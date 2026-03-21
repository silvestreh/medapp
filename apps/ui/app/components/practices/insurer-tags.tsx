import { Badge, Group, Text } from '@mantine/core';
import type { InsurerCode } from './types';

const MAX_VISIBLE_TAGS = 5;

export function InsurerTags({ codes }: { codes: InsurerCode[] }) {
  if (codes.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        —
      </Text>
    );
  }

  const visible = codes.slice(0, MAX_VISIBLE_TAGS);
  const remaining = codes.length - MAX_VISIBLE_TAGS;

  return (
    <Group gap={4} wrap="wrap">
      {visible.map(c => (
        <Badge key={c.id} variant="light" size="sm">
          {c.insurerShortName}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="light" size="sm" color="gray">
          +{remaining} más
        </Badge>
      )}
    </Group>
  );
}
