import type { CustomFormCheckboxField } from '@athelas/encounter-schemas';

export interface CheckboxLayout {
  labelOnRight: boolean;
  showLeftLabel: boolean;
  withSpacer: boolean;
}

export function getCheckboxLayout(
  field: CustomFormCheckboxField,
  sectionLabelPosition: 'left' | 'top' = 'left'
): CheckboxLayout {
  const sectionIsTop = sectionLabelPosition === 'top';
  const labelOnRight = sectionIsTop || field.variant === 'checkbox';
  const hasLabel = Boolean(field.label);

  return {
    labelOnRight,
    showLeftLabel: hasLabel && !labelOnRight,
    withSpacer: !sectionIsTop && labelOnRight && Boolean(field.indent),
  };
}
