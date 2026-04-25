'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, UserPlus, Tractor, Sprout, Package, ShieldCheck,
  Mail, Pencil, Trash2, Eye, EyeOff, Copy, CheckCheck, AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import type { User } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';
import { ROLE_LABELS, UserRole } from '@/lib/role';

// ─── Role config ──────────────────────────────────────────────────────────────
const TEAM_ROLES: { value: UserRole; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { value: 'manager',    label: 'Farm Manager',  icon: Tractor,  color: 'text-blue-700',   bg: 'bg-blue-100'   },
  { value: 'agronomist', label: 'Agronomist',    icon: Sprout,   color: 'text-green-700',  bg: 'bg-green-100'  },
  { value: 'staff',      label: 'Field Staff',   icon: Users,    color: 'text-orange-700', bg: 'bg-orange-100' },
  { value: 'supplier',   label: 'Supplier',      icon: Package,  color: 'text-purple-700', bg: 'bg-purple-100' },
];

function roleStyle(role: string) {
  return TEAM_ROLES.find(r => r.value === role) ?? {
    label: ROLE_LABELS[role as UserRole] ?? role,
    icon: ShieldCheck,
    color: 'text-gray-700',
    bg: 'bg-gray-100',
  };
}

// ─── Credential banner ────────────────────────────────────────────────────────
function CredentialBanner({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
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
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">Done</button>
      </div>
    </div>
  );
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────
interface MemberForm { name: string; email: string; password: string; role: UserRole; }

function MemberModal({ open, onClose, editUser }: { open: boolean; onClose: () => void; editUser?: User | null }) {
  const qc = useQueryClient();
  const [showPw, setShowPw]       = useState(false);
  const [newCreds, setNewCreds]   = useState<{ email: string; password: string } | null>(null);
  const isEditing = !!editUser;

  const form = useForm<MemberForm>({
    defaultValues: editUser
      ? { name: editUser.name, email: editUser.email, password: '', role: editUser.role as UserRole }
      : { role: 'staff' },
  });

  const createMutation = useMutation({
    mutationFn: (d: MemberForm) => api.post('/users', d).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['all-users'] });
      setNewCreds({ email: vars.email, password: vars.password });
      form.reset({ role: 'staff' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (d: MemberForm) => api.patch(`/users/${editUser!.id}`, { name: d.name, role: d.role }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-users'] }); handleClose(); },
  });

  const handleClose = () => {
    setNewCreds(null); setShowPw(false);
    form.reset({ role: 'staff' }); onClose();
  };

  const onSubmit = (d: MemberForm) => isEditing ? updateMutation.mutate(d) : createMutation.mutate(d);
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
                <button key={r.value} type="button" onClick={() => form.setValue('role', r.value)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    selected ? `border-farm-500 ${r.bg} ${r.color}` : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />{r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label">Full Name *</label>
          <input className="input" placeholder="John Smith" {...form.register('name', { required: true })} />
        </div>

        <div>
          <label className="label">Email Address *</label>
          <input className="input" type="email" placeholder="john@farm.com" readOnly={isEditing} {...form.register('email', { required: !isEditing })} />
        </div>

        {!isEditing && (
          <div>
            <label className="label">Password *</label>
            <div className="relative">
              <input className="input pr-10" type={showPw ? 'text' : 'password'} placeholder="Min. 8 characters"
                {...form.register('password', { required: true, minLength: 8 })} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {newCreds && <CredentialBanner email={newCreds.email} password={newCreds.password} onClose={handleClose} />}

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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${rs.bg} ${rs.color}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight">{user.name}</p>
          <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${rs.bg} ${rs.color}`}>
            <Icon className="w-3 h-3" />{rs.label}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="truncate">{user.email}</span>
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <span className="text-xs text-gray-400">Joined {formatDate((user as any).created_at ?? '')}</span>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-farm-600 hover:bg-farm-50 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function TeamPageInner() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen]     = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Auto-open modal when navigated from sidebar with ?add=1
  useEffect(() => {
    if (searchParams.get('add') === '1') setModalOpen(true);
  }, [searchParams]);

  const { data: allUsers, isLoading } = useQuery<User[]>({
    queryKey: ['all-users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const teamMembers = (allUsers ?? []).filter(u => u.role !== 'owner');

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-users'] }),
  });

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Team Members"
          subtitle="Manage who can log in and their roles"
          action={
            <button
              onClick={() => { setEditingUser(null); setModalOpen(true); }}
              className="btn-primary flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> Add Member
            </button>
          }
        />

        {isLoading ? (
          <Spinner />
        ) : teamMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team members yet"
            description="Add managers, agronomists, field staff and suppliers so they can log in to their own dashboards."
            action={<button onClick={() => setModalOpen(true)} className="btn-primary">Add first member</button>}
          />
        ) : (
          <div className="space-y-8">
            {TEAM_ROLES.map(({ value, label }) => {
              const group = teamMembers.filter(u => u.role === value);
              if (group.length === 0) return null;
              return (
                <div key={value}>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}s</h3>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400">{group.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {group.map(u => (
                      <MemberCard
                        key={u.id}
                        user={u}
                        onEdit={() => { setEditingUser(u); setModalOpen(true); }}
                        onDelete={() => { if (confirm(`Remove ${u.name}?`)) deleteMutation.mutate(u.id); }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <MemberModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditingUser(null); }}
          editUser={editingUser}
        />
      </div>
    </AppLayout>
  );
}

export default function TeamPage() {
  return (
    <Suspense>
      <TeamPageInner />
    </Suspense>
  );
}
