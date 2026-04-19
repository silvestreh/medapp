import { useCallback, useState } from 'react';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { BuilderProvider } from '~/components/form-builder/builder-context';
import { FormBuilder } from '~/components/form-builder';
import { useBuilder } from '~/components/form-builder/builder-context';
import { builderStateToSchema, schemaToBuilderState } from '~/components/form-builder/utils/schema-serializer';
import { useFeathers } from '~/components/provider';
import { getAuthenticatedClient } from '~/utils/auth.server';
import { useUnsavedGuard } from '~/hooks/use-unsaved-guard';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const { templateId } = params;

  const template = await client.service('form-templates' as any).get(templateId!);

  return json({ template });
};

function FormBuilderWithSave() {
  const { template } = useLoaderData<typeof loader>();
  const { state, dispatch } = useBuilder();
  const { t } = useTranslation();
  const client = useFeathers();
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
        await client.service('form-templates' as any).patch((template as any).id, {
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
    [state, client, dispatch, template, t, isSaving]
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

export default function EditFormRoute() {
  const { template } = useLoaderData<typeof loader>();
  const tmpl = template as any;

  const initialState = schemaToBuilderState(tmpl.schema, tmpl.type);
  initialState.name = tmpl.name;
  initialState.label = tmpl.label;

  return (
    <BuilderProvider initialState={initialState}>
      <FormBuilderWithSave />
    </BuilderProvider>
  );
}
