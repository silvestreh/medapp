import { Text } from '@mantine/core';
import { useDroppable } from '@dnd-kit/core';
import type { BuilderField } from '../builder-types';
import { PreviewField } from './preview-field';

interface GroupDropZoneProps {
  fieldId: string;
  fieldsetId: string;
  builderField: BuilderField;
}

const containerStyle: React.CSSProperties = {
  marginLeft: '24px',
  borderLeft: '2px solid var(--mantine-color-gray-3)',
  backgroundColor: 'var(--mantine-color-gray-0)',
  borderRadius: '0 var(--mantine-radius-sm) var(--mantine-radius-sm) 0',
  minHeight: '40px',
};

export function GroupDropZone({ fieldId, fieldsetId, builderField }: GroupDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-drop-${fieldId}`,
    data: { type: 'group-drop', fieldsetId, groupFieldId: fieldId },
  });

  const children = builderField._groupChildren ?? [];
  const dropZoneStyle: React.CSSProperties = {
    padding: children.length > 0 ? '8px 12px' : '16px',
    backgroundColor: isOver ? 'var(--mantine-color-blue-0)' : 'transparent',
    borderRadius: 'var(--mantine-radius-sm)',
    transition: 'background-color 200ms ease',
    textAlign: 'center',
  };

  return (
    <div style={containerStyle}>
      {children.map(child => (
        <PreviewField key={child._id} builderField={child} fieldsetId={fieldsetId} parentGroupId={fieldId} />
      ))}
      <div ref={setNodeRef} style={dropZoneStyle}>
        <Text size="xs" c="gray.4">
          {children.length === 0 ? 'Drop fields here' : '+'}
        </Text>
      </div>
    </div>
  );
}
