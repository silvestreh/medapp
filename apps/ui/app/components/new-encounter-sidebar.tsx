import { type FC } from 'react';
import { Text, Stack, Divider, ActionIcon } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';
import { styled } from '~/styled-system/jsx';

interface CustomFormEntry {
  formKey: string;
  label: string;
}

interface NewEncounterSidebarProps {
  availableForms: (string | null)[];
  activeForms: (string | null)[];
  activeFormKey?: string;
  onFormClick: (formKey: string) => void;
  onRemoveForm: (formKey: string) => void;
  customForms?: CustomFormEntry[];
}

const FormItem = styled('div', {
  base: {
    cursor: 'pointer',
    color: 'var(--mantine-primary-color-6)',
    fontSize: 'var(--mantine-font-size-md)',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',

    '&:hover': {
      backgroundColor: 'var(--mantine-primary-color-0)',
    },
  },

  variants: {
    active: {
      true: {
        backgroundColor: 'var(--mantine-primary-color-3)',
        color: 'white',

        '&:hover': {
          backgroundColor: 'var(--mantine-primary-color-3)',
        },
      },
    },
  },
});

const SectionTitle = styled(Text, {
  base: {
    padding: '1rem',
    fontWeight: 600,
    color: 'var(--mantine-color-gray-6)',
    textTransform: 'uppercase',
    fontSize: 'var(--mantine-font-size-xs)',
  },
});

const NewEncounterSidebar: FC<NewEncounterSidebarProps> = ({
  availableForms,
  activeForms,
  activeFormKey,
  onFormClick,
  onRemoveForm,
  customForms = [],
}) => {
  const { t } = useTranslation();

  return (
    <Stack gap={0}>
      {activeForms.some(f => f !== null) && (
        <>
          <SectionTitle>{t('encounters.active_forms')}</SectionTitle>
          {activeForms.map((formKey, index) =>
            formKey === null ? (
              <Divider key={`sep-active-${index}`} my="xs" />
            ) : (
              <FormItem key={formKey} active={activeFormKey === formKey} onClick={() => onFormClick(formKey)}>
                {t(`forms.${formKey}` as any)}
                <ActionIcon
                  variant="subtle"
                  color={activeFormKey === formKey ? 'white' : 'gray'}
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    onRemoveForm(formKey);
                  }}
                >
                  <XIcon size={14} />
                </ActionIcon>
              </FormItem>
            )
          )}
          <Divider my="sm" />
        </>
      )}

      <SectionTitle>{t('encounters.available_forms')}</SectionTitle>
      {availableForms.map((formKey, index) =>
        formKey === null ? (
          <Divider key={`sep-available-${index}`} my="xs" />
        ) : (
          <FormItem key={formKey} active={activeFormKey === formKey} onClick={() => onFormClick(formKey)}>
            {t(`forms.${formKey}` as any)}
          </FormItem>
        )
      )}

      {customForms.length > 0 && (
        <>
          <Divider my="sm" />
          <SectionTitle>{t('encounters.custom_forms', 'Custom Forms')}</SectionTitle>
          {customForms.map(cf => (
            <FormItem key={cf.formKey} active={activeFormKey === cf.formKey} onClick={() => onFormClick(cf.formKey)}>
              {cf.label}
            </FormItem>
          ))}
        </>
      )}
    </Stack>
  );
};

export default NewEncounterSidebar;
