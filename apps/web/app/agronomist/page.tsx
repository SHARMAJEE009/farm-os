'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Leaf, CheckCircle, XCircle, Clock, Trash2, AlertCircle,
  Droplets, Sprout, FlaskConical, Tractor, Sun, Wheat, Microscope,
  HelpCircle, Search, ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, getStatusColor } from '@/lib/utils';
import type { Recommendation, Paddock } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';

type StatusFilter = 'all' | 'draft' | 'approved' | 'rejected';

interface RecForm {
  paddock_id: string;
  type: string;
  description: string;
}

const REC_TYPES = [
  'Spray',
  'Fertiliser',
  'Irrigation',
  'Cultivation',
  'Sowing',
  'Harvest',
  'Soil Test',
  'Other',
];

const TYPE_ICON: Record<string, React.ElementType> = {
  Spray:       Droplets,
  Fertiliser:  FlaskConical,
  Irrigation:  Droplets,
  Cultivation: Tractor,
  Sowing:      Sprout,
  Harvest:     Wheat,
  'Soil Test': Microscope,
  Other:       HelpCircle,
};

const TYPE_COLOR: Record<string, string> = {
  Spray:       'bg-blue-50 text-blue-600',
  Fertiliser:  'bg-emerald-50 text-emerald-600',
  Irrigation:  'bg-cyan-50 text-cyan-600',
  Cultivation: 'bg-orange-50 text-orange-600',
  Sowing:      'bg-lime-50 text-lime-600',
  Harvest:     'bg-yellow-50 text-yellow-600',
  'Soil Test': 'bg-amber-50 text-amber-600',
  Other:       'bg-gray-50 text-gray-500',
};

const STATUS_CONFIG = {
  draft:    { label: 'Draft',    icon: Clock,        bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200', dot: 'bg-yellow-400' },
  approved: { label: 'Approved', icon: CheckCircle,  bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',  dot: 'bg-green-500'  },
  rejected: { label: 'Rejected', icon: XCircle,      bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',    dot: 'bg-red-500'    },
} as const;

const FILTER_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'draft',    label: 'Draft' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

function RecCard({
  rec,
  onApprove,
  onReject,
  onDelete,
  isUpdating,
}: {
  rec: Recommendation;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  isUpdating: boolean;
}) {
  const cfg = STATUS_CONFIG[rec.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;
  const TypeIcon = TYPE_ICON[rec.type] ?? HelpCircle;
  const typeColor = TYPE_COLOR[rec.type] ?? TYPE_COLOR.Other;

  return (
    <div className={`bg-white rounded-xl border ${cfg.border} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden`}>
      {/* Colored top stripe */}
      <div className={`h-1 ${cfg.dot === 'bg-yellow-400' ? 'bg-yellow-400' : cfg.dot === 'bg-green-500' ? 'bg-green-500' : 'bg-red-500'}`} />

      <div className="p-4 sm:p-5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Type icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColor}`}>
            <TypeIcon className="w-5 h-5" />
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 text-sm">{rec.type}</span>
              {/* Status pill */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                <StatusIcon className="w-3 h-3" />
                {cfg.label}
              </span>
            </div>

            {/* Paddock */}
            <div className="flex items-center gap-1.5">
              <Leaf className="w-3 h-3 text-farm-500 flex-shrink-0" />
              <span className="text-xs font-medium text-farm-700 truncate">
                {rec.paddock?.name ?? rec.paddock_id}
              </span>
            </div>
          </div>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        {rec.description && (
          <p className="mt-3 text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg px-3 py-2">
            {rec.description}
          </p>
        )}

        {/* Footer */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-xs text-gray-400">{formatDate(rec.created_at)}</span>

          {/* Action buttons — only for draft */}
          {rec.status === 'draft' && (
            <div className="flex gap-2">
              <button
                onClick={onReject}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
              <button
                onClick={onApprove}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Accept
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgronomistPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const { data: recs, isLoading } = useQuery<Recommendation[]>({
    queryKey: ['recommendations'],
    queryFn: () => api.get('/recommendations').then(r => r.data),
  });

  const { data: paddocks } = useQuery<Paddock[]>({
    queryKey: ['paddocks'],
    queryFn: () => api.get('/paddocks').then(r => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RecForm>();

  const createMutation = useMutation({
    mutationFn: (d: RecForm) => api.post('/recommendations', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recommendations'] });
      setModalOpen(false);
      reset();
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/recommendations/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recommendations'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/recommendations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recommendations'] }),
  });

  // Summary counts
  const counts = useMemo(() => ({
    total:    recs?.length ?? 0,
    draft:    recs?.filter(r => r.status === 'draft').length    ?? 0,
    approved: recs?.filter(r => r.status === 'approved').length ?? 0,
    rejected: recs?.filter(r => r.status === 'rejected').length ?? 0,
  }), [recs]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = recs ?? [];
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.type.toLowerCase().includes(q) ||
        (r.paddock?.name ?? '').toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [recs, statusFilter, search]);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Agronomy"
          subtitle="Manage paddock recommendations and spray programs"
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>New Recommendation</span>
            </button>
          }
        />

        {/* Summary stat chips */}
        {!isLoading && (recs?.length ?? 0) > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
                <Leaf className="w-4.5 h-4.5 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-yellow-200 shadow-sm p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center">
                <Clock className="w-4.5 h-4.5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700">{counts.draft}</p>
                <p className="text-xs text-yellow-600">Pending</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-green-200 shadow-sm p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-4.5 h-4.5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{counts.approved}</p>
                <p className="text-xs text-green-600">Approved</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                <XCircle className="w-4.5 h-4.5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700">{counts.rejected}</p>
                <p className="text-xs text-red-600">Rejected</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters row */}
        {!isLoading && (recs?.length ?? 0) > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            {/* Status tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-shrink-0">
              {FILTER_TABS.map(tab => {
                const count = tab.id === 'all' ? counts.total : counts[tab.id as keyof typeof counts];
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      statusFilter === tab.id
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                    <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                      statusFilter === tab.id ? 'bg-farm-100 text-farm-700' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search type, paddock…"
                className="input pl-9 text-sm"
              />
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (recs?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Leaf}
            title="No recommendations yet"
            description="Create a paddock recommendation to start your agronomy workflow."
            action={
              <button onClick={() => setModalOpen(true)} className="btn-primary">
                Create first recommendation
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Leaf className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm">No recommendations match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((rec) => (
              <RecCard
                key={rec.id}
                rec={rec}
                onApprove={() => statusMutation.mutate({ id: rec.id, status: 'approved' })}
                onReject={() => statusMutation.mutate({ id: rec.id, status: 'rejected' })}
                onDelete={() => deleteMutation.mutate(rec.id)}
                isUpdating={statusMutation.isPending}
              />
            ))}
          </div>
        )}

        {/* Create modal */}
        <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="New Recommendation">
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            {createMutation.isError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Failed to save. Please check all fields and try again.
              </div>
            )}

            {/* Paddock */}
            <div>
              <label className="label">Paddock *</label>
              <select
                className={`input ${errors.paddock_id ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                {...register('paddock_id', { required: true })}
              >
                <option value="">Select paddock…</option>
                {paddocks?.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="label">Recommendation Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {REC_TYPES.map(t => {
                  const Icon = TYPE_ICON[t] ?? HelpCircle;
                  const color = TYPE_COLOR[t] ?? TYPE_COLOR.Other;
                  return (
                    <label
                      key={t}
                      className="relative cursor-pointer"
                    >
                      <input
                        type="radio"
                        value={t}
                        className="peer sr-only"
                        {...register('type', { required: true })}
                      />
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium transition-all
                        peer-checked:border-farm-500 peer-checked:bg-farm-50 peer-checked:text-farm-700 hover:border-gray-300">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {t}
                      </div>
                    </label>
                  );
                })}
              </div>
              {errors.type && <p className="text-xs text-red-500 mt-1">Please select a type</p>}
            </div>

            {/* Description */}
            <div>
              <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Describe the recommendation in detail…"
                {...register('description')}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setModalOpen(false); reset(); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn-primary flex-1"
              >
                {createMutation.isPending ? 'Creating…' : 'Create Draft'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
