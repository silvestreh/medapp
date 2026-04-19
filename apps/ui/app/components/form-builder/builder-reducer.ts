import { produce } from 'immer';
function uuid(): string {
  return crypto.randomUUID();
}
import type { BuilderState, BuilderAction, BuilderField } from './builder-types';

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

function removeFieldRecursive(fields: BuilderField[], id: string): boolean {
  const idx = fields.findIndex(f => f._id === id);
  if (idx !== -1) {
    fields.splice(idx, 1);
    return true;
  }
  for (const bf of fields) {
    if (bf._groupChildren && removeFieldRecursive(bf._groupChildren, id)) {
      return true;
    }
  }
  return false;
}

function updateFieldRecursive(fields: BuilderField[], id: string, changes: Record<string, any>): boolean {
  for (const bf of fields) {
    if (bf._id === id) {
      bf.field = { ...bf.field, ...changes } as typeof bf.field;
      return true;
    }
    if (bf._groupChildren && updateFieldRecursive(bf._groupChildren, id, changes)) {
      return true;
    }
  }
  return false;
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
        if (fs) {
          const newField = { _id: uuid(), field: action.payload.field };

          // Determine the target fields array (tab-aware)
          let targetFields = fs.fields;
          if (fs.tabs) {
            const tabId = action.payload.tabId || fs.activeTabId;
            const tab = fs.tabs.find(t => t._id === tabId);
            if (tab) targetFields = tab.fields;
          }

          // If targeting a group field, add inside the group's children (recursive)
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
        }
        break;
      }

      case 'REMOVE_FIELD': {
        const fs = draft.fieldsets.find(f => f._id === action.payload.fieldsetId);
        if (fs) {
          let removed = removeFieldRecursive(fs.fields, action.payload.fieldId);
          if (!removed && fs.tabs) {
            for (const tab of fs.tabs) {
              if (removeFieldRecursive(tab.fields, action.payload.fieldId)) {
                removed = true;
                break;
              }
            }
          }
          if (removed) {
            if (draft.selectedFieldId === action.payload.fieldId) {
              draft.selectedFieldId = null;
            }
            draft.isDirty = true;
          }
        }
        break;
      }

      case 'UPDATE_FIELD': {
        let updated = false;
        for (const fs of draft.fieldsets) {
          if (updateFieldRecursive(fs.fields, action.payload.fieldId, action.payload.changes)) {
            updated = true;
            draft.isDirty = true;
            break;
          }
          if (fs.tabs) {
            for (const tab of fs.tabs) {
              if (updateFieldRecursive(tab.fields, action.payload.fieldId, action.payload.changes)) {
                updated = true;
                draft.isDirty = true;
                break;
              }
            }
            if (updated) break;
          }
        }
        break;
      }

      case 'REORDER_FIELD': {
        const fs = draft.fieldsets.find(f => f._id === action.payload.fieldsetId);
        if (fs) {
          // Find the fields array that contains both items (could be in a tab)
          let targetFields = fs.fields;
          if (fs.tabs) {
            for (const tab of fs.tabs) {
              if (tab.fields.some(f => f._id === action.payload.fromId)) {
                targetFields = tab.fields;
                break;
              }
            }
          }
          const fromIndex = targetFields.findIndex(f => f._id === action.payload.fromId);
          const toIndex = targetFields.findIndex(f => f._id === action.payload.toId);
          if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
            const [moved] = targetFields.splice(fromIndex, 1);
            targetFields.splice(toIndex, 0, moved);
            draft.isDirty = true;
          }
        }
        break;
      }

      case 'MOVE_FIELD': {
        const fromFs = draft.fieldsets.find(f => f._id === action.payload.fromFieldsetId);
        const toFs = draft.fieldsets.find(f => f._id === action.payload.toFieldsetId);
        if (fromFs && toFs) {
          const idx = fromFs.fields.findIndex(f => f._id === action.payload.fieldId);
          if (idx !== -1) {
            const [moved] = fromFs.fields.splice(idx, 1);
            const toIdx = Math.min(action.payload.toIndex, toFs.fields.length);
            toFs.fields.splice(toIdx, 0, moved);
            draft.selectedFieldsetId = action.payload.toFieldsetId;
            draft.isDirty = true;
          }
        }
        break;
      }

      case 'SELECT_FIELD': {
        draft.selectedFieldId = action.payload.fieldId;
        draft.selectedFieldsetId = action.payload.fieldsetId;
        break;
      }

      case 'TOGGLE_TABS': {
        const fs = draft.fieldsets.find(f => f._id === action.payload.fieldsetId);
        if (fs) {
          if (action.payload.enabled) {
            const tabId = uuid();
            fs.tabs = [{ _id: tabId, value: 'tab-1', label: 'Tab 1', fields: fs.fields }];
            fs.fields = [];
            fs.activeTabId = tabId;
            fs.tabStyle = 'pills';
          } else {
            // Move active tab's fields back to the fieldset
            const allTabFields = fs.tabs?.flatMap(t => t.fields) || [];
            fs.fields = allTabFields;
            fs.tabs = undefined;
            fs.activeTabId = undefined;
            fs.tabStyle = undefined;
          }
          draft.isDirty = true;
        }
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
