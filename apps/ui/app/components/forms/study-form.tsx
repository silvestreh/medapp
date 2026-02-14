import { useEffect, useRef, useCallback } from 'react';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { styled } from '~/styled-system/jsx';

import { FormContainer, FormCard, FieldRow, Label, StyledTextarea, FormHeader } from '~/components/forms/styles';
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
 * - 'inline-title': a `title` or `separator` rendered as an inline header within the card
 */
interface FieldGroup {
  kind: 'grid' | 'inline-title';
  fields: StudyField[];
}

/**
 * A section is a visual "sub-form" with its own header and FormCard.
 * `title-input` fields act as section dividers.
 */
interface FormSection {
  /** The title-input field that starts this section (undefined for the first section). */
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
    if (field.type === 'title-input') {
      // Start a new section
      flushSection();
      currentSection = { titleField: field, groups: [] };
    } else if (field.type === 'title' || field.type === 'separator') {
      flushGrid();
      currentSection.groups.push({ kind: 'inline-title', fields: [field] });
    } else {
      currentGrid.push(field);
    }
  }
  flushSection();

  return sections;
}

// ---------------------------------------------------------------------------
// Styled wrappers
// ---------------------------------------------------------------------------

const FieldsGrid = styled('div', {
  base: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 0,

    lg: {
      gridTemplateColumns: '1fr 1fr',
    },
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

  const sections = buildSections(schema.fields);

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle>{schema.label}</StyledTitle>
      </FormHeader>

      {sections.map((section, si) => (
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
              if (group.kind === 'inline-title') {
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
                <Label>{t('studies.comments_label')}</Label>
                <StyledTextarea
                  readOnly={readOnly}
                  autosize
                  minRows={2}
                  placeholder={t('studies.comments_section_placeholder')}
                  value={(form.values.comments as string) ?? ''}
                  onChange={e => form.setFieldValue('comments', e.currentTarget.value)}
                />
              </FieldRow>
            )}
            {(!readOnly || form.values.conclusion) && (
              <FieldRow>
                <Label>{t('studies.conclusion_label')}</Label>
                <StyledTextarea
                  readOnly={readOnly}
                  autosize
                  minRows={2}
                  placeholder={t('studies.conclusion_section_placeholder')}
                  value={(form.values.conclusion as string) ?? ''}
                  onChange={e => form.setFieldValue('conclusion', e.currentTarget.value)}
                />
              </FieldRow>
            )}
          </FormCard>
        </>
      )}
    </FormContainer>
  );
}
