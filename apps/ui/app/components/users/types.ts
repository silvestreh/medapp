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

export const ROLE_COLORS: Record<string, string> = {
  owner: 'yellow',
  admin: 'red',
  medic: 'blue',
  receptionist: 'green',
  'lab-tech': 'grape',
  'lab-owner': 'orange',
  accounting: 'teal',
};
