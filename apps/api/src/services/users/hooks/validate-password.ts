import { BadRequest } from '@feathersjs/errors';
import { HookContext } from '@feathersjs/feathers';
import { isPasswordValid, PASSWORD_POLICY_MESSAGE } from '../../../utils/validate-password';

export const validatePassword = () => (context: HookContext) => {
  const password = context.data?.password;
  if (typeof password === 'string' && !isPasswordValid(password)) {
    throw new BadRequest(PASSWORD_POLICY_MESSAGE);
  }
  return context;
};
