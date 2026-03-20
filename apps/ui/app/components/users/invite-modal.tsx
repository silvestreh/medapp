import { useCallback, useEffect, useState } from 'react';
import { useFetcher } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Button, Group, Modal, Select, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { UserPlusIcon } from '@phosphor-icons/react';

interface InviteModalProps {
  opened: boolean;
  onClose: () => void;
  roleOptions: { value: string; label: string }[];
}

export function InviteModal({ opened, onClose, roleOptions }: InviteModalProps) {
  const { t } = useTranslation();
  const fetcher = useFetcher<{ ok: boolean; intent: string; emailHtml?: string | null; error?: string }>();

  const form = useForm({
    initialValues: { email: '', role: 'receptionist' },
    validate: {
      email: v => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : t('users.invalid_email')),
    },
  });

  useEffect(() => {
    if (opened) {
      form.reset();
    }
  }, [opened]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.ok) {
        onClose();
        showNotification({ color: 'teal', message: t('users.invite_sent') });
        if (fetcher.data.emailHtml) {
          const blob = new Blob([fetcher.data.emailHtml], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        }
      } else {
        showNotification({ color: 'red', message: fetcher.data.error || t('users.invite_error') });
      }
    }
  }, [fetcher.state, fetcher.data, t, onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const validation = form.validate();
      if (validation.hasErrors) return;

      fetcher.submit({ intent: 'invite', email: form.values.email, role: form.values.role }, { method: 'post' });
    },
    [form, fetcher]
  );

  return (
    <Modal opened={opened} onClose={handleClose} title={t('users.invite_user')} centered>
      <form onSubmit={handleSubmit}>
        <TextInput
          label={t('users.email')}
          placeholder="user@example.com"
          required
          mb="md"
          {...form.getInputProps('email')}
        />
        <Select label={t('users.role')} data={roleOptions} mb="xl" {...form.getInputProps('role')} />
        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" leftSection={<UserPlusIcon size={16} />}>
            {t('users.send_invite')}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
