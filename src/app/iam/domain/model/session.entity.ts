export type UserRole = 'BUYER' | 'PROVIDER' | 'ADMIN';

export interface Membership {
  organizationId: number;
  role: string;
}

export interface Session {
  id: number;
  username: string;
  token: string;
  roles: string[];
  companyId: number | null;
  providerId: number | null;
  memberships: Membership[];
}

export interface SignUpForm {
  role: 'BUYER' | 'PROVIDER';
  username: string;
  password: string;
  name: string;
  ruc: string;
  address: string;
  phone: string;
  sector?: string;
  fuelTypesOffered?: string[];
  description?: string;
}

export function sessionRole(session: Session | null): UserRole | null {
  if (!session) return null;
  if (session.roles.includes('ROLE_ADMIN')) return 'ADMIN';
  if (session.roles.includes('ROLE_PROVIDER')) return 'PROVIDER';
  if (session.roles.includes('ROLE_BUYER')) return 'BUYER';
  return null;
}
