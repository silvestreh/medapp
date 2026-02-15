import { useEffect, useRef, useCallback, useState } from 'react';
import { Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { styled } from '~/styled-system/jsx';

import { StudyFormField } from './study-form-field';
import type { StudySchema, StudyField, StudyResultData, StudySelectValue } from './study-form-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the initial form values from a schema, optionally merging saved data. */
function buildInitialValues(schema: StudySchema, initialData?: StudyResultData): StudyResultData {
  const values: StudyResultData = {};

  for (const field of schema.fields) {
    if (!field.name) continue; // titles / separators have no name
    values[field.name] = initialData?.[field.name] ?? '';
  }

  // Always include comments & conclusion
  values.comments = initialData?.comments ?? '';
  values.conclusion = initialData?.conclusion ?? '';

  return values;
}

/**
 * A group of fields rendered inside a single FormCard.
 * - 'grid': consecutive input/textarea/select fields rendered in a 2-col grid
 * - 'inline-content': non-grid content (currently separators) rendered inside a card
 */
interface FieldGroup {
  kind: 'grid' | 'inline-content';
  fields: StudyField[];
}

/**
 * A section is a visual "sub-form" with its own header and FormCard.
 * `title`, `title-input`, and `separator` fields act as section dividers.
 */
interface FormSection {
  /** The heading-like field that starts this section (undefined for the first section). */
  titleField?: StudyField;
  /** Groups of fields within this section's FormCard. */
  groups: FieldGroup[];
}

function buildSections(fields: StudyField[]): FormSection[] {
  const sections: FormSection[] = [];
  let currentSection: FormSection = { groups: [] };
  let currentGrid: StudyField[] = [];

  const flushGrid = () => {
    if (currentGrid.length > 0) {
      currentSection.groups.push({ kind: 'grid', fields: [...currentGrid] });
      currentGrid = [];
    }
  };

  const flushSection = () => {
    flushGrid();
    if (currentSection.groups.length > 0 || currentSection.titleField) {
      sections.push(currentSection);
    }
  };

  for (const field of fields) {
    if (field.type === 'title-input' || field.type === 'title' || field.type === 'separator') {
      // Start a new titled section
      flushSection();
      currentSection = {
        titleField: field.label ? field : undefined,
        groups: [],
      };
    } else {
      currentGrid.push(field);
    }
  }
  flushSection();

  return sections;
}

function hasVisibleValue(value: string | StudySelectValue | undefined): boolean {
  if (value === '' || value === null || value === undefined) return false;
  if (typeof value === 'object') return Boolean(value.value);
  return true;
}

// ---------------------------------------------------------------------------
// Styled wrappers
// ---------------------------------------------------------------------------

const FieldsGrid = styled('div', {
  base: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 0,
    '& > *:last-child': {
      borderBottom: 'none',
    },
    // When rendered field count is even, remove border from second-to-last too.
    '& > *:nth-last-child(2):nth-child(odd)': {
      borderBottom: 'none',
    },

    lg: {
      gridTemplateColumns: '1fr 1fr',
    },
  },
});

const FormContainer = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    width: '100%',
  },
});

const FormCard = styled('div', {
  base: {
    background: 'white',
    border: '1px solid var(--mantine-color-gray-2)',
    borderRadius: 'var(--mantine-radius-md)',
    overflow: 'hidden',
  },
});

const FieldRow = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '1rem',
    borderBottom: '1px solid var(--mantine-color-gray-2)',
    '&:last-child': {
      borderBottom: 'none',
    },
  },
});

const Label = styled('label', {
  base: {
    color: 'var(--mantine-color-gray-6)',
    fontSize: 'var(--mantine-font-size-sm)',
    transition: 'color 120ms ease',
  },
  variants: {
    focused: {
      true: {
        color: 'var(--mantine-color-blue-6)',
      },
    },
    clickable: {
      true: {
        cursor: 'pointer',
      },
    },
  },
});

const StyledTextarea = styled(Textarea, {
  base: {
    flex: 1,
    '& .mantine-Textarea-input': {
      border: 'none',
      padding: 0,
      height: 'auto',
      minHeight: '1.5rem',
      lineHeight: 1.75,
      backgroundColor: 'transparent',
      '&:focus': {
        boxShadow: 'none',
      },
    },
  },
});

const FormHeader = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
});

const StyledTitle = styled('h2', {
  base: {
    fontWeight: 500,
    margin: '1.5rem 0 0',
    lineHeight: 1,
    color: 'var(--mantine-color-gray-6)',
  },
});

const MainTitle = styled(StyledTitle, {
  base: {
    fontSize: '1.75rem',
    lineHeight: 1.1,
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface StudyFormProps {
  schema: StudySchema;
  initialData?: StudyResultData;
  onChange: (data: StudyResultData) => void;
  readOnly?: boolean;
}

export function StudyForm({ schema, initialData, onChange, readOnly }: StudyFormProps) {
  const { t } = useTranslation();
  const [focusedExtraField, setFocusedExtraField] = useState<'comments' | 'conclusion' | null>(null);
  const form = useForm<StudyResultData>({
    initialValues: buildInitialValues(schema, initialData),
  });

  // Track previous serialised values to avoid unnecessary onChange calls
  const prevRef = useRef<string>(JSON.stringify(form.values));

  useEffect(() => {
    if (readOnly) return;

    const serialised = JSON.stringify(form.values);
    if (serialised !== prevRef.current) {
      prevRef.current = serialised;
      onChange(form.values);
    }
  }, [form.values, onChange, readOnly]);

  const handleFieldChange = useCallback(
    (fieldName: string) => (value: string | StudySelectValue) => {
      form.setFieldValue(fieldName, value as any);
    },
    [form]
  );
  const focusControl = useCallback(
    (id: string) => {
      if (readOnly) return;
      const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement | null;
      element?.focus();
    },
    [readOnly]
  );

  const sections = buildSections(schema.fields);
  const visibleSections = readOnly
    ? sections.filter(section =>
        section.groups.some(group =>
          group.fields.some(field => {
            if (!field.name) return false;
            return hasVisibleValue(form.values[field.name]);
          })
        )
      )
    : sections;
  const commentsControlId = 'study-comments';
  const conclusionControlId = 'study-conclusion';

  return (
    <FormContainer>
      <FormHeader>
        <MainTitle>{schema.label}</MainTitle>
      </FormHeader>

      {visibleSections.map((section, si) => (
        <div key={`s-${si}`}>
          {section.titleField && (
            <FormHeader>
              <StyledTitle>
                <span dangerouslySetInnerHTML={{ __html: section.titleField.label ?? '' }} />
                {section.titleField.unit && (
                  <span style={{ color: 'var(--mantine-color-gray-5)', fontSize: '0.75em', marginLeft: '0.5rem' }}>
                    ({section.titleField.unit})
                  </span>
                )}
              </StyledTitle>
            </FormHeader>
          )}

          <FormCard>
            {section.groups.map((group, gi) => {
              if (group.kind === 'inline-content') {
                const field = group.fields[0];
                return (
                  <StudyFormField
                    key={`s${si}-g${gi}`}
                    field={field}
                    value={field.name ? (form.values[field.name] ?? '') : ''}
                    onChange={field.name ? handleFieldChange(field.name) : () => {}}
                    readOnly={readOnly}
                    showMethod={schema.showMethod}
                  />
                );
              }

              return (
                <FieldsGrid key={`s${si}-g${gi}`}>
                  {group.fields.map(field => (
                    <StudyFormField
                      key={field.name}
                      field={field}
                      value={field.name ? (form.values[field.name] ?? '') : ''}
                      onChange={field.name ? handleFieldChange(field.name) : () => {}}
                      readOnly={readOnly}
                      showMethod={schema.showMethod}
                    />
                  ))}
                </FieldsGrid>
              );
            })}
          </FormCard>
        </div>
      ))}

      {/* Comments & Conclusion – hidden in readOnly when both are empty */}
      {(!readOnly || form.values.comments || form.values.conclusion) && (
        <>
          <FormHeader>
            <StyledTitle>{t('studies.comments_and_conclusion')}</StyledTitle>
          </FormHeader>
          <FormCard>
            {(!readOnly || form.values.comments) && (
              <FieldRow>
                <Label
                  focused={focusedExtraField === 'comments'}
                  clickable={!readOnly}
                  htmlFor={!readOnly ? commentsControlId : undefined}
                  onClick={!readOnly ? () => focusControl(commentsControlId) : undefined}
                >
                  {t('studies.comments_label')}
                </Label>
                <StyledTextarea
                  id={commentsControlId}
                  readOnly={readOnly}
                  autosize
                  minRows={2}
                  placeholder={t('studies.comments_section_placeholder')}
                  value={(form.values.comments as string) ?? ''}
                  onChange={e => form.setFieldValue('comments', e.currentTarget.value)}
                  onFocus={!readOnly ? () => setFocusedExtraField('comments') : undefined}
                  onBlur={!readOnly ? () => setFocusedExtraField(null) : undefined}
                />
              </FieldRow>
            )}
            {(!readOnly || form.values.conclusion) && (
              <FieldRow>
                <Label
                  focused={focusedExtraField === 'conclusion'}
                  clickable={!readOnly}
                  htmlFor={!readOnly ? conclusionControlId : undefined}
                  onClick={!readOnly ? () => focusControl(conclusionControlId) : undefined}
                >
                  {t('studies.conclusion_label')}
                </Label>
                <StyledTextarea
                  id={conclusionControlId}
                  readOnly={readOnly}
                  autosize
                  minRows={2}
                  placeholder={t('studies.conclusion_section_placeholder')}
                  value={(form.values.conclusion as string) ?? ''}
                  onChange={e => form.setFieldValue('conclusion', e.currentTarget.value)}
                  onFocus={!readOnly ? () => setFocusedExtraField('conclusion') : undefined}
                  onBlur={!readOnly ? () => setFocusedExtraField(null) : undefined}
                />
              </FieldRow>
            )}
          </FormCard>
        </>
      )}
    </FormContainer>
  );
}
