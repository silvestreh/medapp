import { HookContext } from '@feathersjs/feathers';

export const removeReminders = () => async (context: HookContext) => {
  const appointmentId = context.id;

  await context.app.service('appointment-reminders').remove(null, {
    query: { appointmentId },
  });

  return context;
};
