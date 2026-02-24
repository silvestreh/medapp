const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters with one uppercase letter, one lowercase letter, and one digit';

export function isPasswordValid(password: string): boolean {
  return PASSWORD_RE.test(password);
}
