import { useMemo } from 'react';
import { useBuilder } from '../../builder-context';
import { findFieldRecursive } from '../../builder-reducer';
import type { BuilderField, BuilderFieldset } from '../../builder-types';
import { PanelContainer } from './styles';
import { FormProperties } from './form-properties';
import { FieldsetProperties } from './fieldset-properties';
import { FieldProperties } from './field-properties';

export function PropertyEditor() {
  const { state } = useBuilder();

  const selectedField = useMemo((): BuilderField | null => {
    if (!state.selectedFieldId) return null;
    for (const fs of state.fieldsets) {
      const found = findFieldRecursive(fs.fields, state.selectedFieldId);
      if (found) return found;
      if (fs.tabs) {
        for (const tab of fs.tabs) {
          const tabFound = findFieldRecursive(tab.fields, state.selectedFieldId);
          if (tabFound) return tabFound;
        }
      }
    }
    return null;
  }, [state.selectedFieldId, state.fieldsets]);

  const selectedFieldset = useMemo((): BuilderFieldset | null => {
    if (!state.selectedFieldsetId) return null;
    return state.fieldsets.find(fs => fs._id === state.selectedFieldsetId) ?? null;
  }, [state.selectedFieldsetId, state.fieldsets]);

  if (selectedField) {
    return (
      <PanelContainer>
        <FieldProperties field={selectedField} />
      </PanelContainer>
    );
  }

  if (selectedFieldset && !state.selectedFieldId) {
    return (
      <PanelContainer>
        <FieldsetProperties fieldset={selectedFieldset} />
      </PanelContainer>
    );
  }

  return (
    <PanelContainer>
      <FormProperties />
    </PanelContainer>
  );
}
