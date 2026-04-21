import { produce } from 'immer';
import type { BuilderState, BuilderAction, BuilderField, BuilderFieldset } from './builder-types';

function uuid(): string {
  return crypto.randomUUID();
}

export function findFieldRecursive(fields: BuilderField[], id: string): BuilderField | null {
  for (const bf of fields) {
    if (bf._id === id) return bf;
    if (bf._groupChildren) {
      const found = findFieldRecursive(bf._groupChildren, id);
      if (found) return found;
    }
  }
  return null;
}

interface FieldLocation {
  parent: BuilderField[];
  index: number;
}

function findFieldLocation(fields: BuilderField[], id: string): FieldLocation | null {
  const idx = fields.findIndex(f => f._id === id);
  if (idx !== -1) return { parent: fields, index: idx };
  for (const bf of fields) {
    if (bf._groupChildren) {
      const nested = findFieldLocation(bf._groupChildren, id);
      if (nested) return nested;
    }
  }
  return null;
}

function findFieldLocationInFieldset(fs: BuilderFieldset, id: string): FieldLocation | null {
  const direct = findFieldLocation(fs.fields, id);
  if (direct) return direct;
  if (fs.tabs) {
    for (const tab of fs.tabs) {
      const tabbed = findFieldLocation(tab.fields, id);
      if (tabbed) return tabbed;
    }
  }
  return null;
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  return produce(state, draft => {
    switch (action.type) {
      case 'SET_META': {
        if (action.payload.name !== undefined) draft.name = action.payload.name;
        if (action.payload.label !== undefined) draft.label = action.payload.label;
        draft.isDirty = true;
        break;
      }

      case 'ADD_FIELDSET': {
        const newFieldset = { _id: uuid(), fields: [] };
        const idx = action.payload.afterIndex;
        if (idx !== undefined && idx < draft.fieldsets.length) {
          draft.fieldsets.splice(idx + 1, 0, newFieldset);
        } else {
          draft.fieldsets.push(newFieldset);
        }
        draft.selectedFieldId = null;
        draft.selectedFieldsetId = newFieldset._id;
        draft.isDirty = true;
        break;
      }

      case 'REMOVE_FIELDSET': {
        const idx = draft.fieldsets.findIndex(fs => fs._id === action.payload.fieldsetId);
        if (idx !== -1 && draft.fieldsets.length > 1) {
          draft.fieldsets.splice(idx, 1);
          if (draft.selectedFieldsetId === action.payload.fieldsetId) {
            draft.selectedFieldsetId = null;
            draft.selectedFieldId = null;
          }
          draft.isDirty = true;
        }
        break;
      }

      case 'REORDER_FIELDSET': {
        const { fromIndex, toIndex } = action.payload;
        if (
          fromIndex !== toIndex &&
          fromIndex >= 0 &&
          toIndex >= 0 &&
          fromIndex < draft.fieldsets.length &&
          toIndex < draft.fieldsets.length
        ) {
          const [moved] = draft.fieldsets.splice(fromIndex, 1);
          draft.fieldsets.splice(toIndex, 0, moved);
          draft.isDirty = true;
        }
        break;
      }

      case 'UPDATE_FIELDSET': {
        const fs = draft.fieldsets.find(f => f._id === action.payload.fieldsetId);
        if (fs) {
          if (action.payload.title !== undefined) fs.title = action.payload.title;
          if (action.payload.extraCost !== undefined) fs.extraCost = action.payload.extraCost;
          if (action.payload.labelPosition !== undefined) fs.labelPosition = action.payload.labelPosition;
          if (action.payload.columns !== undefined) fs.columns = action.payload.columns;
          if (action.payload.repeatable !== undefined) fs.repeatable = action.payload.repeatable;
          if (action.payload.addLabel !== undefined) fs.addLabel = action.payload.addLabel;
          if (action.payload.itemLabel !== undefined) fs.itemLabel = action.payload.itemLabel;
          if (action.payload.minItems !== undefined) fs.minItems = action.payload.minItems;
          draft.isDirty = true;
        }
        break;
      }

      case 'ADD_FIELD': {
        const fs = draft.fieldsets.find(f => f._id === action.payload.fieldsetId);
        if (!fs) break;
        const newField: BuilderField = { _id: uuid(), field: action.payload.field };

        // Target fields array (tab-aware)
        let targetFields = fs.fields;
        if (fs.tabs) {
          const tabId = action.payload.tabId || fs.activeTabId;
          const tab = fs.tabs.find(t => t._id === tabId);
          if (tab) targetFields = tab.fields;
        }

        // Group insertion takes precedence
        if (action.payload.groupFieldId) {
          const groupBf = findFieldRecursive(targetFields, action.payload.groupFieldId);
          if (groupBf && groupBf.field.type === 'group') {
            if (!groupBf._groupChildren) groupBf._groupChildren = [];
            groupBf._groupChildren.push(newField);
            draft.selectedFieldId = newField._id;
            draft.selectedFieldsetId = action.payload.fieldsetId;
            draft.isDirty = true;
            break;
          }
        }

        const atIdx = action.payload.atIndex;
        if (atIdx !== undefined && atIdx <= targetFields.length) {
          targetFields.splice(atIdx, 0, newField);
        } else {
          targetFields.push(newField);
        }
        draft.selectedFieldId = newField._id;
        draft.selectedFieldsetId = action.payload.fieldsetId;
        draft.isDirty = true;
        break;
      }

      case 'REMOVE_FIELD': {
        const fs = draft.fieldsets.find(f => f._id === action.payload.fieldsetId);
        if (!fs) break;
        const loc = findFieldLocationInFieldset(fs, action.payload.fieldId);
        if (loc) {
          loc.parent.splice(loc.index, 1);
          if (draft.selectedFieldId === action.payload.fieldId) {
            draft.selectedFieldId = null;
          }
          draft.isDirty = true;
        }
        break;
      }

      case 'UPDATE_FIELD': {
        for (const fs of draft.fieldsets) {
          const loc = findFieldLocationInFieldset(fs, action.payload.fieldId);
          if (loc) {
            const bf = loc.parent[loc.index];
            bf.field = { ...bf.field, ...action.payload.changes } as typeof bf.field;
            draft.isDirty = true;
            break;
          }
        }
        break;
      }

      case 'REORDER_FIELD': {
        const fs = draft.fieldsets.find(f => f._id === action.payload.fieldsetId);
        if (!fs) break;
        const fromLoc = findFieldLocationInFieldset(fs, action.payload.fromId);
        const toLoc = findFieldLocationInFieldset(fs, action.payload.toId);
        if (!fromLoc || !toLoc || fromLoc.parent !== toLoc.parent) break;
        if (fromLoc.index === toLoc.index) break;
        const [moved] = fromLoc.parent.splice(fromLoc.index, 1);
        fromLoc.parent.splice(toLoc.index, 0, moved);
        draft.isDirty = true;
        break;
      }

      case 'MOVE_FIELD': {
        const fromFs = draft.fieldsets.find(f => f._id === action.payload.fromFieldsetId);
        const toFs = draft.fieldsets.find(f => f._id === action.payload.toFieldsetId);
        if (!fromFs || !toFs) break;
        const fromLoc = findFieldLocationInFieldset(fromFs, action.payload.fieldId);
        if (!fromLoc) break;
        const [moved] = fromLoc.parent.splice(fromLoc.index, 1);
        const toIdx = Math.min(action.payload.toIndex, toFs.fields.length);
        toFs.fields.splice(toIdx, 0, moved);
        draft.selectedFieldsetId = action.payload.toFieldsetId;
        draft.isDirty = true;
        break;
      }

      case 'SELECT_FIELD': {
        draft.selectedFieldId = action.payload.fieldId;
        draft.selectedFieldsetId = action.payload.fieldsetId;
        break;
      }

      case 'TOGGLE_TABS': {
        const fs = draft.fieldsets.find(f => f._id === action.payload.fieldsetId);
        if (!fs) break;
        if (action.payload.enabled) {
          const tabId = uuid();
          fs.tabs = [{ _id: tabId, value: 'tab-1', label: 'Tab 1', fields: fs.fields }];
          fs.fields = [];
          fs.activeTabId = tabId;
          fs.tabStyle = 'pills';
        } else {
          const allTabFields = fs.tabs?.flatMap(t => t.fields) ?? [];
          fs.fields = allTabFields;
          fs.tabs = undefined;
          fs.activeTabId = undefined;
          fs.tabStyle = undefined;
        }
        draft.isDirty = true;
        break;
      }

      case 'ADD_TAB': {
        const fs = draft.fieldsets.find(f => f._id === action.payload.fieldsetId);
        if (fs?.tabs) {
          const num = fs.tabs.length + 1;
          const tabId = uuid();
          fs.tabs.push({ _id: tabId, value: `tab-${num}`, label: `Tab ${num}`, fields: [] });
          fs.activeTabId = tabId;
          draft.isDirty = true;
        }
        break;
      }

      case 'REMOVE_TAB': {
        const fs = draft.fieldsets.find(f => f._id === action.payload.fieldsetId);
        if (fs?.tabs && fs.tabs.length > 1) {
          const idx = fs.tabs.findIndex(t => t._id === action.payload.tabId);
          if (idx !== -1) {
            fs.tabs.splice(idx, 1);
            if (fs.activeTabId === action.payload.tabId) {
              fs.activeTabId = fs.tabs[0]?._id;
            }
            draft.isDirty = true;
          }
        }
        break;
      }

      case 'UPDATE_TAB': {
        const fs = draft.fieldsets.find(f => f._id === action.payload.fieldsetId);
        if (fs?.tabs) {
          const tab = fs.tabs.find(t => t._id === action.payload.tabId);
          if (tab) {
            tab.label = action.payload.label;
            draft.isDirty = true;
          }
        }
        break;
      }

      case 'SET_ACTIVE_TAB': {
        const fs = draft.fieldsets.find(f => f._id === action.payload.fieldsetId);
        if (fs) {
          fs.activeTabId = action.payload.tabId;
        }
        break;
      }

      case 'LOAD': {
        return action.payload;
      }

      case 'MARK_CLEAN': {
        draft.isDirty = false;
        break;
      }
    }
  });
}
