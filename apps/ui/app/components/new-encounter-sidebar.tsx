import { type FC } from 'react';
import { Text, Stack, Divider, ActionIcon } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { styled } from '~/styled-system/jsx';

interface NewEncounterSidebarProps {
  availableForms: string[];
  activeForms: string[];
  activeFormKey?: string;
  onFormClick: (formKey: string) => void;
  onRemoveForm: (formKey: string) => void;
}

const SidebarContainer = styled('div', {
  base: {
    width: '100%',
  },
});

const FormItem = styled('div', {
  base: {
    cursor: 'pointer',
    color: 'var(--mantine-color-blue-6)',
    fontSize: 'var(--mantine-font-size-md)',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',

    '&:hover': {
      backgroundColor: 'var(--mantine-color-blue-0)',
    },
  },

  variants: {
    active: {
      true: {
        backgroundColor: 'var(--mantine-color-blue-4)',
        color: 'white',

        '&:hover': {
          backgroundColor: 'var(--mantine-color-blue-4)',
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
}) => {
  const { t } = useTranslation();

  return (
    <SidebarContainer>
      <Stack gap={0}>
        {activeForms.length > 0 && (
          <>
            <SectionTitle>{t('encounters.active_forms')}</SectionTitle>
            {activeForms.map(formKey => (
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
                  <X size={14} />
                </ActionIcon>
              </FormItem>
            ))}
            <Divider my="sm" />
          </>
        )}

        <SectionTitle>{t('encounters.available_forms')}</SectionTitle>
        {availableForms.map(formKey => (
          <FormItem key={formKey} active={activeFormKey === formKey} onClick={() => onFormClick(formKey)}>
            {t(`forms.${formKey}` as any)}
          </FormItem>
        ))}
      </Stack>
    </SidebarContainer>
  );
};

export default NewEncounterSidebar;
