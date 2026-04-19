import type { CustomFormField } from '@athelas/encounter-schemas';

export type AnyField = CustomFormField;

export interface BuilderField {
  _id: string;
  field: AnyField;
  _groupChildren?: BuilderField[];
}

export interface BuilderTab {
  _id: string;
  value: string;
  label: string;
  fields: BuilderField[];
}

export interface BuilderFieldset {
  _id: string;
  title?: string;
  extraCost?: boolean;
  labelPosition?: 'left' | 'top';
  columns?: number;
  repeatable?: boolean;
  addLabel?: string;
  itemLabel?: string;
  minItems?: number;
  tabs?: BuilderTab[];
  activeTabId?: string;
  tabStyle?: 'pills' | 'default';
  fields: BuilderField[];
}

export interface BuilderState {
  type: 'encounter' | 'study';
  name: string;
  label: string;
  fieldsets: BuilderFieldset[];
  selectedFieldId: string | null;
  selectedFieldsetId: string | null;
  isDirty: boolean;
}

export type BuilderAction =
  | { type: 'SET_META'; payload: { name?: string; label?: string } }
  | { type: 'ADD_FIELDSET'; payload: { afterIndex?: number } }
  | { type: 'REMOVE_FIELDSET'; payload: { fieldsetId: string } }
  | { type: 'REORDER_FIELDSET'; payload: { fromIndex: number; toIndex: number } }
  | {
      type: 'UPDATE_FIELDSET';
      payload: {
        fieldsetId: string;
        title?: string;
        extraCost?: boolean;
        labelPosition?: 'left' | 'top';
        columns?: number;
        repeatable?: boolean;
        addLabel?: string;
        itemLabel?: string;
        minItems?: number;
        tabStyle?: 'pills' | 'default';
      };
    }
  | { type: 'TOGGLE_TABS'; payload: { fieldsetId: string; enabled: boolean } }
  | { type: 'ADD_TAB'; payload: { fieldsetId: string } }
  | { type: 'REMOVE_TAB'; payload: { fieldsetId: string; tabId: string } }
  | { type: 'UPDATE_TAB'; payload: { fieldsetId: string; tabId: string; label: string } }
  | { type: 'SET_ACTIVE_TAB'; payload: { fieldsetId: string; tabId: string } }
  | {
      type: 'ADD_FIELD';
      payload: { fieldsetId: string; field: AnyField; atIndex?: number; groupFieldId?: string; tabId?: string };
    }
  | { type: 'REMOVE_FIELD'; payload: { fieldsetId: string; fieldId: string } }
  | { type: 'UPDATE_FIELD'; payload: { fieldId: string; changes: Partial<AnyField> } }
  | { type: 'REORDER_FIELD'; payload: { fieldsetId: string; fromId: string; toId: string } }
  | { type: 'MOVE_FIELD'; payload: { fromFieldsetId: string; fieldId: string; toFieldsetId: string; toIndex: number } }
  | { type: 'SELECT_FIELD'; payload: { fieldId: string | null; fieldsetId: string | null } }
  | { type: 'LOAD'; payload: BuilderState }
  | { type: 'MARK_CLEAN' };
