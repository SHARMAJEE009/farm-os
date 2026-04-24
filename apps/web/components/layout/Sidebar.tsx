'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import {
  LayoutDashboard,
  Users,
  Leaf,
  ShoppingCart,
  DollarSign,
  LogOut,
  Menu,
  X,
  Tractor,
  MessageSquare,
  Newspaper,
  TrendingUp,
  BarChart3,
  Building2,
  UserPlus,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Cookies from 'js-cookie';
import { getRole, ROLE_LABELS, ROLE_NAV } from '@/lib/role';

const navSections = [
  {
    label: 'Operations',
    items: [
      { href: '/dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
      { href: '/farms',        label: 'Farm',          icon: Building2 },
      { href: '/staff',        label: 'Staff',         icon: Users },
      { href: '/agronomist',   label: 'Agronomy',      icon: Leaf },
      { href: '/supplier',     label: 'Supplier',      icon: ShoppingCart },
      { href: '/finance',      label: 'Finance',       icon: DollarSign },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/forecasting',  label: 'Forecasting',   icon: TrendingUp },
      { href: '/benchmarking', label: 'Benchmarking',  icon: BarChart3 },
      { href: '/news',         label: 'News',          icon: Newspaper },
      { href: '/chatbot',      label: 'AI Assistant',  icon: MessageSquare },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRoleState] = useState<ReturnType<typeof getRole>>('staff');

  useEffect(() => {
    setRoleState(getRole());
  }, []);

  const allowedPaths = ROLE_NAV[role] ?? ROLE_NAV.staff;
  const isAdmin = role === 'owner';

  const filteredSections = navSections.map(section => ({
    ...section,
    items: section.items.filter(item => allowedPaths.includes(item.href)),
  })).filter(section => section.items.length > 0);

  const handleLogout = () => {
    Cookies.remove('token');
    Cookies.remove('role');
    router.push('/login');
  };

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-farm-700">
        <div className="w-9 h-9 bg-farm-400 rounded-xl flex items-center justify-center">
          <Tractor className="w-5 h-5 text-farm-900" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-none">Aiag Farming</p>
          <p className="text-farm-400 text-xs mt-0.5">{ROLE_LABELS[role]}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {filteredSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-xs font-semibold text-farm-500 uppercase tracking-wider">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-farm-600 text-white'
                        : 'text-farm-300 hover:text-white hover:bg-farm-700/50'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Admin quick action */}
        {isAdmin && (
          <div>
            <p className="px-3 mb-1.5 text-xs font-semibold text-farm-500 uppercase tracking-wider">
              Quick Actions
            </p>
            <Link
              href="/team?add=1"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-farm-300 hover:text-white hover:bg-farm-700/50 transition-colors"
            >
              <UserPlus className="w-4 h-4 flex-shrink-0" />
              Add Member
            </Link>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-4 border-t border-farm-700 pt-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-farm-300 hover:text-white hover:bg-farm-700/50 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-farm-900 h-screen sticky top-0 flex-shrink-0">
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-farm-900 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Tractor className="w-5 h-5 text-farm-300" />
          <span className="font-bold text-white text-sm">Aiag Farming</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-farm-300 hover:text-white"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileOpen(false)}>
          <aside
            className="flex flex-col w-56 bg-farm-900 h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-14" />
            <NavContent />
          </aside>
        </div>
      )}
    </>
  );
}
