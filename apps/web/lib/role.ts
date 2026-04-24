import Cookies from 'js-cookie';

export type UserRole = 'owner' | 'manager' | 'agronomist' | 'staff' | 'supplier';

export function getRole(): UserRole {
  return (Cookies.get('role') as UserRole) ?? 'staff';
}

export function setRole(role: string) {
  Cookies.set('role', role, { expires: 7 });
}

export function clearRole() {
  Cookies.remove('role');
}

export function isAdmin(role: UserRole) {
  return role === 'owner' || role === 'manager';
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner:      'Admin / Owner',
  manager:    'Farm Manager',
  agronomist: 'Agronomist',
  staff:      'Field Staff',
  supplier:   'Supplier',
};

export const ROLE_NAV: Record<UserRole, string[]> = {
  owner:      ['/dashboard', '/farms', '/staff', '/team', '/agronomist', '/supplier', '/finance', '/forecasting', '/benchmarking', '/news', '/chatbot'],
  manager:    ['/dashboard', '/farms', '/staff', '/agronomist', '/supplier', '/finance', '/news', '/chatbot'],
  agronomist: ['/dashboard', '/farms', '/agronomist', '/news'],
  staff:      ['/dashboard', '/farms', '/staff', '/news'],
  supplier:   ['/dashboard', '/supplier', '/news'],
};
