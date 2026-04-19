import { useCallback, useState } from 'react';
import { useParams, useNavigate } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { BuilderProvider } from '~/components/form-builder/builder-context';
import { FormBuilder } from '~/components/form-builder';
import { useBuilder } from '~/components/form-builder/builder-context';
import { builderStateToSchema } from '~/components/form-builder/utils/schema-serializer';
import { useFeathers } from '~/components/provider';
import { useUnsavedGuard } from '~/hooks/use-unsaved-guard';

function FormBuilderWithSave() {
  const { state, dispatch } = useBuilder();
  const { t } = useTranslation();
  const client = useFeathers();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(
    async (status: 'draft' | 'published' = 'draft') => {
      if (isSaving) return;

      if (!state.name && !state.label) {
        notifications.show({
          title: t('form_builder.missing_name'),
          message: t('form_builder.missing_name_message'),
          color: 'red',
        });
        return;
      }

      setIsSaving(true);
      try {
        const schema = builderStateToSchema(state);
        const template = await client.service('form-templates' as any).create({
          type: state.type,
          name: state.name || state.label,
          label: state.label || state.name,
          schema,
          status,
        });

        dispatch({ type: 'MARK_CLEAN' });

        const notifKey = status === 'published' ? 'published_message' : 'saved_message';
        notifications.show({
          title: status === 'published' ? t('form_builder.form_published') : t('form_builder.form_saved'),
          message: t(`form_builder.${notifKey}` as any, { label: state.label }),
          color: 'green',
        });

        navigate(`/forms/${(template as any).id}/edit`, { replace: true });
      } catch (error: any) {
        notifications.show({
          title: t('form_builder.save_error'),
          message: error?.message || 'An unexpected error occurred.',
          color: 'red',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [state, client, dispatch, navigate, t, isSaving]
  );

  const handleSaveDraft = useCallback(() => {
    handleSave('draft');
  }, [handleSave]);

  const { blocker, handleDiscard, handleCancel, handleSaveAndLeave } = useUnsavedGuard({
    isDirty: state.isDirty,
    onSave: handleSaveDraft,
  });

  return (
    <>
      <FormBuilder onSave={handleSave} isSaving={isSaving} />

      <Modal opened={blocker.state === 'blocked'} onClose={handleCancel} title={t('common.unsaved_title')}>
        <Text mb="lg">{t('common.unsaved_body')}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={handleDiscard}>
            {t('common.discard')}
          </Button>
          <Button onClick={handleSaveAndLeave}>{t('common.save_and_leave')}</Button>
        </Group>
      </Modal>
    </>
  );
}

export default function NewFormRoute() {
  const { formType } = useParams<{ formType: string }>();
  const type = formType === 'study' ? 'study' : 'encounter';

  return (
    <BuilderProvider formType={type as 'encounter' | 'study'}>
      <FormBuilderWithSave />
    </BuilderProvider>
  );
}
