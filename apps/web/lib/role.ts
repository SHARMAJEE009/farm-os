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

const ALL_PAGES = [
  '/dashboard', '/farms', '/paddocks', '/staff', '/livestock', '/team',
  '/crop-plans', '/activities', '/products', '/inventory', '/harvest',
  '/tasks', '/agronomist', '/supplier', '/weather',
  '/finance', '/forecasting', '/benchmarking', '/news', '/intelligence/ai-assistant',
];

export const ROLE_NAV: Record<UserRole, string[]> = {
  owner:      ALL_PAGES,
  manager:    ALL_PAGES.filter(p => p !== '/team'),
  agronomist: ['/dashboard', '/farms', '/paddocks', '/livestock', '/crop-plans', '/activities', '/products', '/harvest', '/agronomist', '/weather', '/news', '/intelligence/ai-assistant'],
  staff:      ['/dashboard', '/farms', '/paddocks', '/staff', '/livestock', '/activities', '/tasks', '/inventory', '/weather', '/harvest', '/news', '/intelligence/ai-assistant'],
  supplier:   ['/dashboard', '/supplier', '/products', '/inventory', '/news', '/intelligence/ai-assistant'],
};
