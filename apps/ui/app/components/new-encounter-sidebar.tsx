import { type FC } from 'react';
import { Text, Stack, Divider, ActionIcon } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { styled } from '~/stitches';

interface NewEncounterSidebarProps {
  availableForms: string[];
  activeForms: string[];
  activeFormKey?: string;
  onFormClick: (formKey: string) => void;
  onRemoveForm: (formKey: string) => void;
}

const SidebarContainer = styled('div', {
  width: '100%',
});

const FormItem = styled('div', {
  cursor: 'pointer',
  padding: '1rem',
  fontSize: 'var(--mantine-font-size-md)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',

  '&:hover': {
    backgroundColor: 'var(--mantine-color-gray-0)',
  },

  variants: {
    active: {
      true: {
        backgroundColor: 'var(--mantine-color-blue-0)',
        color: 'var(--mantine-color-blue-6)',
        fontWeight: 600,
      },
    },
    isActiveForm: {
      true: {
        color: 'var(--mantine-color-blue-6)',
      },
    },
  },
});

const SectionTitle = styled(Text, {
  padding: '1rem',
  fontWeight: 600,
  color: 'var(--mantine-color-gray-6)',
  textTransform: 'uppercase',
  fontSize: 'var(--mantine-font-size-xs)',
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
            {activeForms.map((formKey) => (
              <FormItem
                key={formKey}
                active={activeFormKey === formKey}
                isActiveForm={true}
                onClick={() => onFormClick(formKey)}
              >
                <Text size="sm">{t(`forms.${formKey}` as any)}</Text>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={(e) => {
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
        {availableForms.map((formKey) => (
          <FormItem
            key={formKey}
            active={activeFormKey === formKey}
            onClick={() => onFormClick(formKey)}
          >
            <Text size="sm">{t(`forms.${formKey}` as any)}</Text>
          </FormItem>
        ))}
      </Stack>
    </SidebarContainer>
  );
};

export default NewEncounterSidebar;
