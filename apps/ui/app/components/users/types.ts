export type MemberRow = {
  id: string;
  userId: string;
  user: {
    id: string;
    username: string;
    roleIds: string[];
    personalData?: { firstName?: string; lastName?: string } | null;
    contactData?: { email?: string } | null;
  } | null;
};

// Hand-picked so the known roles are visually distinct.
// Unknown/custom roles fall through to a deterministic hash.
const KNOWN_ROLE_COLORS: Record<string, string> = {
  owner: 'yellow',
  admin: 'red',
  medic: 'blue',
  receptionist: 'teal',
  'lab-tech': 'grape',
  'lab-owner': 'orange',
  accounting: 'cyan',
  prescriber: 'indigo',
  'form-designer': 'pink',
};

const FALLBACK_PALETTE = ['lime', 'violet', 'green', 'rose', 'sky', 'amber', 'emerald', 'fuchsia', 'slate'];

function deterministicRoleColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

export function getRoleColor(roleId: string): string {
  return KNOWN_ROLE_COLORS[roleId] ?? deterministicRoleColor(roleId);
}
