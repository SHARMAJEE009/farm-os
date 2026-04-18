'use client';

import { useState } from 'react';
import { useFarm } from '@/lib/farm-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Clock, Fuel, Trash2, AlertCircle, Users,
  ShieldCheck, Tractor, Sprout, Package, Eye, EyeOff,
  Mail, Copy, CheckCheck, Pencil,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Timesheet, FuelLog, Paddock, User } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';
import { getRole, ROLE_LABELS, UserRole } from '@/lib/role';

type Tab = 'team' | 'timesheets' | 'fuel';

// ─── Team member types ────────────────────────────────────────────────────────

interface MemberForm {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const TEAM_ROLES: { value: UserRole; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { value: 'manager',    label: 'Farm Manager',  icon: Tractor,     color: 'text-blue-700',   bg: 'bg-blue-100' },
  { value: 'agronomist', label: 'Agronomist',    icon: Sprout,      color: 'text-green-700',  bg: 'bg-green-100' },
  { value: 'staff',      label: 'Field Staff',   icon: Users,       color: 'text-orange-700', bg: 'bg-orange-100' },
  { value: 'supplier',   label: 'Supplier',      icon: Package,     color: 'text-purple-700', bg: 'bg-purple-100' },
];

function roleStyle(role: string) {
  return TEAM_ROLES.find(r => r.value === role) ?? {
    label: ROLE_LABELS[role as UserRole] ?? role,
    icon: ShieldCheck,
    color: 'text-gray-700',
    bg: 'bg-gray-100',
  };
}

// ─── Credential banner shown after creation ───────────────────────────────────
function CredentialBanner({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Email: ${email}\nPassword: ${password}`;

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl space-y-2">
      <p className="text-sm font-semibold text-green-800">Member created! Share these login credentials:</p>
      <div className="bg-white border border-green-100 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 space-y-0.5">
        <p>Email: <span className="font-bold">{email}</span></p>
        <p>Password: <span className="font-bold">{password}</span></p>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={copy} className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-900">
          {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy credentials'}
        </button>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">Dismiss</button>
      </div>
    </div>
  );
}

// ─── Add / Edit member modal ──────────────────────────────────────────────────
function MemberModal({
  open, onClose, editUser,
}: {
  open: boolean;
  onClose: () => void;
  editUser?: User | null;
}) {
  const qc = useQueryClient();
  const [showPw, setShowPw] = useState(false);
  const [newCreds, setNewCreds] = useState<{ email: string; password: string } | null>(null);

  const form = useForm<MemberForm>({
    defaultValues: editUser
      ? { name: editUser.name, email: editUser.email, password: '', role: editUser.role as UserRole }
      : { role: 'staff' },
  });

  const createMutation = useMutation({
    mutationFn: (d: MemberForm) => api.post('/users', d).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['all-users'] });
      qc.invalidateQueries({ queryKey: ['staff-users'] });
      setNewCreds({ email: vars.email, password: vars.password });
      form.reset({ role: 'staff' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (d: MemberForm) => api.patch(`/users/${editUser!.id}`, { name: d.name, role: d.role }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-users'] });
      handleClose();
    },
  });

  const handleClose = () => {
    setNewCreds(null);
    setShowPw(false);
    form.reset({ role: 'staff' });
    onClose();
  };

  const onSubmit = (d: MemberForm) => {
    if (editUser) updateMutation.mutate(d);
    else createMutation.mutate(d);
  };

  const isEditing = !!editUser;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const isError   = createMutation.isError   || updateMutation.isError;

  return (
    <Modal open={open} onClose={handleClose} title={isEditing ? 'Edit Member' : 'Add Team Member'}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {isError && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {(createMutation.error as any)?.response?.data?.message ?? 'Failed to save. Please try again.'}
          </div>
        )}

        {/* Role selector */}
        <div>
          <label className="label">Role *</label>
          <div className="grid grid-cols-2 gap-2">
            {TEAM_ROLES.map(r => {
              const Icon = r.icon;
              const selected = form.watch('role') === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => form.setValue('role', r.value)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    selected
                      ? `border-farm-500 ${r.bg} ${r.color}`
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="label">Full Name *</label>
          <input className="input" placeholder="John Smith" {...form.register('name', { required: true })} />
        </div>

        {/* Email — readonly when editing */}
        <div>
          <label className="label">Email Address *</label>
          <input
            className="input"
            type="email"
            placeholder="john@farm.com"
            readOnly={isEditing}
            {...form.register('email', { required: !isEditing })}
          />
        </div>

        {/* Password — only for create */}
        {!isEditing && (
          <div>
            <label className="label">Password *</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPw ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                {...form.register('password', { required: true, minLength: 8 })}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Credential banner */}
        {newCreds && (
          <CredentialBanner
            email={newCreds.email}
            password={newCreds.password}
            onClose={handleClose}
          />
        )}

        {!newCreds && (
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Member'}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ─── Member card ──────────────────────────────────────────────────────────────
function MemberCard({ user, onEdit, onDelete }: { user: User; onEdit: () => void; onDelete: () => void }) {
  const rs = roleStyle(user.role);
  const Icon = rs.icon;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${rs.bg} ${rs.color}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight">{user.name}</p>
          <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${rs.bg} ${rs.color}`}>
            <Icon className="w-3 h-3" />
            {rs.label}
          </div>
        </div>
      </div>

      {/* Email */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="truncate">{user.email}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <span className="text-xs text-gray-400">Joined {formatDate((user as any).created_at ?? '')}</span>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-farm-600 hover:bg-farm-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Timesheet / Fuel form types ──────────────────────────────────────────────
interface TimesheetForm {
  user_id: string;
  paddock_id: string;
  hours: string;
  hourly_rate: string;
  date: string;
}

interface FuelForm {
  paddock_id: string;
  litres: string;
  price_per_litre: string;
  date: string;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StaffPage() {
  const qc = useQueryClient();
  const userRole = getRole();
  const isAdmin = userRole === 'owner';

  const defaultTab: Tab = isAdmin ? 'team' : 'timesheets';
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [tsModalOpen, setTsModalOpen] = useState(false);
  const [fuelModalOpen, setFuelModalOpen] = useState(false);

  const { activeFarmId } = useFarm();
  const farmParams = activeFarmId ? { farm_id: activeFarmId } : {};

  // All team members (admin only)
  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['all-users'],
    queryFn: () => api.get('/users').then(r => r.data),
    enabled: isAdmin,
  });

  const teamMembers = (allUsers ?? []).filter(u => u.role !== 'owner');

  const deleteMemberMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-users'] }),
  });

  const { data: timesheets, isLoading: tsLoading } = useQuery<Timesheet[]>({
    queryKey: ['timesheets', activeFarmId],
    queryFn: () => api.get('/timesheets').then(r => r.data),
  });

  const { data: fuelLogs, isLoading: fuelLoading } = useQuery<FuelLog[]>({
    queryKey: ['fuel-logs', activeFarmId],
    queryFn: () => api.get('/fuel-logs').then(r => r.data),
  });

  const { data: paddocks } = useQuery<Paddock[]>({
    queryKey: ['paddocks', activeFarmId],
    queryFn: () => api.get('/paddocks', { params: farmParams }).then(r => r.data),
  });

  const { data: staffUsers } = useQuery<User[]>({
    queryKey: ['staff-users'],
    queryFn: () => api.get('/users?role=staff').then(r => r.data),
  });

  const tsForm   = useForm<TimesheetForm>({ defaultValues: { date: new Date().toISOString().split('T')[0] } });
  const fuelForm = useForm<FuelForm>({ defaultValues: { date: new Date().toISOString().split('T')[0] } });

  const tsMutation = useMutation({
    mutationFn: (d: TimesheetForm) => {
      const payload: any = {
        paddock_id: d.paddock_id,
        hours: parseFloat(d.hours),
        hourly_rate: parseFloat(d.hourly_rate),
        date: d.date,
      };
      if (d.user_id) payload.user_id = d.user_id;
      return api.post('/timesheets', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      qc.invalidateQueries({ queryKey: ['financial-transactions'] });
      setTsModalOpen(false);
      tsForm.reset({ date: new Date().toISOString().split('T')[0] });
    },
  });

  const fuelMutation = useMutation({
    mutationFn: (d: FuelForm) =>
      api.post('/fuel-logs', { ...d, litres: parseFloat(d.litres), price_per_litre: parseFloat(d.price_per_litre) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel-logs'] });
      qc.invalidateQueries({ queryKey: ['financial-transactions'] });
      setFuelModalOpen(false);
      fuelForm.reset({ date: new Date().toISOString().split('T')[0] });
    },
  });

  const deleteTsMutation   = useMutation({ mutationFn: (id: string) => api.delete(`/timesheets/${id}`),  onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }) });
  const deleteFuelMutation = useMutation({ mutationFn: (id: string) => api.delete(`/fuel-logs/${id}`),   onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-logs'] }) });

  const tabs = [
    ...(isAdmin ? [{ id: 'team' as Tab,       label: 'Team Members', icon: Users }] : []),
    { id: 'timesheets' as Tab, label: 'Timesheets', icon: Clock },
    { id: 'fuel' as Tab,       label: 'Fuel Logs',  icon: Fuel },
  ];

  const pageAction = tab === 'team'
    ? <button onClick={() => { setEditingUser(null); setMemberModalOpen(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Add Member</button>
    : tab === 'timesheets'
    ? <button onClick={() => setTsModalOpen(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Log Hours</button>
    : <button onClick={() => setFuelModalOpen(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Log Fuel</button>;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Staff"
          subtitle="Manage your team and track labour & fuel"
          action={pageAction}
        />

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Team Members tab ── */}
        {tab === 'team' && (
          usersLoading ? <Spinner /> :
          teamMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No team members yet"
              description="Add managers, agronomists, field staff and suppliers so they can log in to their own dashboards."
              action={<button onClick={() => setMemberModalOpen(true)} className="btn-primary">Add first member</button>}
            />
          ) : (
            <div>
              {/* Group by role */}
              {TEAM_ROLES.map(({ value, label }) => {
                const group = teamMembers.filter(u => u.role === value);
                if (group.length === 0) return null;
                return (
                  <div key={value} className="mb-8">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{label}s</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {group.map(u => (
                        <MemberCard
                          key={u.id}
                          user={u}
                          onEdit={() => { setEditingUser(u); setMemberModalOpen(true); }}
                          onDelete={() => { if (confirm(`Remove ${u.name}?`)) deleteMemberMutation.mutate(u.id); }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Timesheets tab ── */}
        {tab === 'timesheets' && (
          tsLoading ? <Spinner /> :
          timesheets && timesheets.length > 0 ? (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Staff', 'Paddock', 'Date', 'Hours', 'Rate/hr', 'Total', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {timesheets.map((ts) => (
                      <tr key={ts.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-gray-600">
                          {ts.user?.name ?? ts.staff_name ?? '—'}
                          {!ts.user_id && ts.staff_name && <span className="ml-1.5 text-xs text-gray-400">(manual)</span>}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{ts.paddock?.name ?? ts.paddock_id}</td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(ts.date)}</td>
                        <td className="px-4 py-3 text-gray-700">{ts.hours}h</td>
                        <td className="px-4 py-3 text-gray-500">{formatCurrency(ts.hourly_rate)}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(ts.total_cost)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => deleteTsMutation.mutate(ts.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState icon={Clock} title="No timesheets yet" description="Start logging staff hours against paddocks." action={<button onClick={() => setTsModalOpen(true)} className="btn-primary">Log first hours</button>} />
          )
        )}

        {/* ── Fuel logs tab ── */}
        {tab === 'fuel' && (
          fuelLoading ? <Spinner /> :
          fuelLogs && fuelLogs.length > 0 ? (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[440px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Paddock', 'Date', 'Litres', 'Price/L', 'Total', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {fuelLogs.map((fl) => (
                      <tr key={fl.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{fl.paddock?.name ?? fl.paddock_id}</td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(fl.date)}</td>
                        <td className="px-4 py-3 text-gray-700">{fl.litres}L</td>
                        <td className="px-4 py-3 text-gray-500">{formatCurrency(fl.price_per_litre)}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(fl.total_cost)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => deleteFuelMutation.mutate(fl.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState icon={Fuel} title="No fuel logs yet" description="Track fuel usage per paddock to understand machinery costs." action={<button onClick={() => setFuelModalOpen(true)} className="btn-primary">Log first fuel entry</button>} />
          )
        )}

        {/* Add/Edit member modal */}
        <MemberModal
          open={memberModalOpen}
          onClose={() => { setMemberModalOpen(false); setEditingUser(null); }}
          editUser={editingUser}
        />

        {/* Timesheet modal */}
        <Modal open={tsModalOpen} onClose={() => { setTsModalOpen(false); tsForm.reset(); }} title="Log Hours">
          <form onSubmit={tsForm.handleSubmit(d => tsMutation.mutate(d))} className="space-y-4">
            {tsMutation.isError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Failed to save. Please check all fields and try again.
              </div>
            )}
            <div>
              <label className="label">Staff Member *</label>
              <select className="input" {...tsForm.register('user_id', { required: true })}>
                <option value="">Select staff member…</option>
                {staffUsers?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Paddock *</label>
              <select className="input" {...tsForm.register('paddock_id', { required: true })}>
                <option value="">Select paddock…</option>
                {paddocks?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Hours *</label>
                <input className="input" type="number" step="0.5" min="0.5" placeholder="8" {...tsForm.register('hours', { required: true })} />
              </div>
              <div>
                <label className="label">Rate ($/hr) *</label>
                <input className="input" type="number" step="0.01" min="0" placeholder="28.00" {...tsForm.register('hourly_rate', { required: true })} />
              </div>
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" {...tsForm.register('date')} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setTsModalOpen(false); tsForm.reset(); }} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={tsMutation.isPending} className="btn-primary flex-1">
                {tsMutation.isPending ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Fuel modal */}
        <Modal open={fuelModalOpen} onClose={() => { setFuelModalOpen(false); fuelForm.reset(); }} title="Log Fuel">
          <form onSubmit={fuelForm.handleSubmit(d => fuelMutation.mutate(d))} className="space-y-4">
            {fuelMutation.isError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Failed to save. Please check all fields and try again.
              </div>
            )}
            <div>
              <label className="label">Paddock *</label>
              <select className="input" {...fuelForm.register('paddock_id', { required: true })}>
                <option value="">Select paddock…</option>
                {paddocks?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Litres *</label>
                <input className="input" type="number" step="0.1" min="0.1" placeholder="120" {...fuelForm.register('litres', { required: true })} />
              </div>
              <div>
                <label className="label">Price/Litre *</label>
                <input className="input" type="number" step="0.001" min="0" placeholder="2.15" {...fuelForm.register('price_per_litre', { required: true })} />
              </div>
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" {...fuelForm.register('date')} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setFuelModalOpen(false); fuelForm.reset(); }} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={fuelMutation.isPending} className="btn-primary flex-1">
                {fuelMutation.isPending ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
