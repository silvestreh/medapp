import { useCallback } from 'react';
import { ActionIcon, Group, TextInput } from '@mantine/core';
import { TrashIcon } from '@phosphor-icons/react';
import { useBuilder } from '../../builder-context';
import { flexOneStyle } from './styles';

interface TabRowProps {
  fieldsetId: string;
  tabId: string;
  label: string;
  canRemove: boolean;
}

export function TabRow({ fieldsetId, tabId, label, canRemove }: TabRowProps) {
  const { dispatch } = useBuilder();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: 'UPDATE_TAB', payload: { fieldsetId, tabId, label: e.target.value } });
    },
    [dispatch, fieldsetId, tabId]
  );

  const handleRemove = useCallback(() => {
    dispatch({ type: 'REMOVE_TAB', payload: { fieldsetId, tabId } });
  }, [dispatch, fieldsetId, tabId]);

  return (
    <Group gap="xs" wrap="nowrap">
      <TextInput value={label} onChange={handleChange} size="xs" style={flexOneStyle} />
      {canRemove && (
        <ActionIcon size="sm" variant="subtle" color="red" onClick={handleRemove}>
          <TrashIcon size={12} />
        </ActionIcon>
      )}
    </Group>
  );
}
