'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Leaf, ChevronDown, ShieldCheck, Tractor, Sprout, Users, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { setRole, ROLE_LABELS, UserRole } from '@/lib/role';
import Cookies from 'js-cookie';

const ROLES: { value: UserRole; label: string; icon: React.ElementType; desc: string; hint: string }[] = [
  { value: 'owner',      label: 'Admin / Owner',  icon: ShieldCheck, desc: 'Full access to all farm data',         hint: 'owner@farm.com' },
  { value: 'manager',    label: 'Farm Manager',   icon: Tractor,     desc: 'Manage operations & approve actions',  hint: 'manager@farm.com' },
  { value: 'agronomist', label: 'Agronomist',     icon: Sprout,      desc: 'Create & manage recommendations',      hint: 'agro@farm.com' },
  { value: 'staff',      label: 'Field Staff',    icon: Users,       desc: 'Log hours, fuel & field work',         hint: 'staff@farm.com' },
  { value: 'supplier',   label: 'Supplier',       icon: Package,     desc: 'View & manage supply orders',          hint: 'supplier@farm.com' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRoleState]    = useState<UserRole>('owner');
  const [open, setOpen]         = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const selectedRole = ROLES.find(r => r.value === role)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const serverRole = res.data.user?.role as UserRole | undefined;

      // If the server returned a role and it doesn't match the selected role, reject
      if (serverRole && serverRole !== role) {
        const actualLabel = ROLE_LABELS[serverRole] ?? serverRole;
        setError(`These credentials belong to a "${actualLabel}" account. Please select the correct role.`);
        return;
      }

      Cookies.set('token', res.data.access_token, { expires: 7 });
      setRole(role);
      router.push('/dashboard');
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-farm-900 via-farm-800 to-farm-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
            <Leaf className="w-8 h-8 text-farm-300" />
          </div>
          <h1 className="text-3xl font-bold text-white">Aiag Farming</h1>
          <p className="text-farm-300 mt-1">aiagfarming.com.au</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Role selector */}
            <div>
              <label className="label">Signing in as</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpen(!open)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-left hover:border-farm-400 focus:outline-none focus:ring-2 focus:ring-farm-500 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-farm-50 flex items-center justify-center flex-shrink-0">
                    <selectedRole.icon className="w-4 h-4 text-farm-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{selectedRole.label}</p>
                    <p className="text-xs text-gray-400 truncate">{selectedRole.desc}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    {ROLES.map(r => {
                      const Icon = r.icon;
                      const active = r.value === role;
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => { setRoleState(r.value); setOpen(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-farm-50 transition-colors ${active ? 'bg-farm-50' : ''}`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-farm-100' : 'bg-gray-100'}`}>
                            <Icon className={`w-4 h-4 ${active ? 'text-farm-600' : 'text-gray-500'}`} />
                          </div>
                          <div className="flex-1">
                            <p className={`font-medium ${active ? 'text-farm-700' : 'text-gray-900'}`}>{r.label}</p>
                            <p className="text-xs text-gray-400">{r.desc}</p>
                          </div>
                          {active && <div className="w-2 h-2 rounded-full bg-farm-500" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder={selectedRole.hint}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : `Sign in as ${selectedRole.label}`}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
