import { useTranslation } from 'react-i18next';
import { FIELD_METADATA } from '../field-registry';
import type { CreatableFieldType } from '../utils/field-defaults';

const overlayStyle: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: 'white',
  borderRadius: 'var(--mantine-radius-sm)',
  boxShadow: 'var(--mantine-shadow-md)',
  fontSize: 'var(--mantine-font-size-sm)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

export function PaletteDragPreview({ fieldType }: { fieldType: CreatableFieldType }) {
  const { t } = useTranslation();
  const meta = FIELD_METADATA[fieldType];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <div style={overlayStyle}>
      <Icon size={16} />
      {t(`form_builder.${meta.labelKey}`)}
    </div>
  );
}
