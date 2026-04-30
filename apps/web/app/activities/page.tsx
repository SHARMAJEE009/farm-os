'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, Check, X, Pencil, Trash2, Filter, Droplets, Bug, Sprout, Tractor, Wheat } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFarm } from '@/lib/farm-context';
import { formatDate } from '@/lib/utils';
import type { Activity, Paddock } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';

const ACTIVITY_TYPES = [
  { value: 'spraying', label: 'Spraying', icon: '🧪', color: 'bg-purple-100 text-purple-700' },
  { value: 'fertilizing', label: 'Fertilizing', icon: '🌿', color: 'bg-green-100 text-green-700' },
  { value: 'seeding', label: 'Seeding', icon: '🌱', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'harvesting', label: 'Harvesting', icon: '🌾', color: 'bg-amber-100 text-amber-700' },
  { value: 'cultivation', label: 'Cultivation', icon: '🚜', color: 'bg-orange-100 text-orange-700' },
  { value: 'irrigation', label: 'Irrigation', icon: '💧', color: 'bg-blue-100 text-blue-700' },
];
const TYPE_MAP = Object.fromEntries(ACTIVITY_TYPES.map(t => [t.value, t]));

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function ActivitiesPage() {
  const qc = useQueryClient();
  const { activeFarmId } = useFarm();
  const [modalOpen, setModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { register, handleSubmit, reset } = useForm();

  const { data: activities, isLoading } = useQuery<Activity[]>({
    queryKey: ['activities', activeFarmId, typeFilter, statusFilter],
    queryFn: () => {
      const params: any = {};
      if (activeFarmId) params.farm_id = activeFarmId;
      if (typeFilter !== 'all') params.type = typeFilter;
      return api.get('/activities', { params }).then(r => r.data);
    },
  });

  const { data: paddocks } = useQuery<Paddock[]>({
    queryKey: ['paddocks', activeFarmId],
    queryFn: () => api.get('/paddocks', { params: activeFarmId ? { farm_id: activeFarmId } : {} }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post('/activities', { ...d, farm_id: activeFarmId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['activities'] }); setModalOpen(false); reset(); },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/activities/${id}/complete`, { completed_date: new Date().toISOString().split('T')[0] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/activities/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });

  const filtered = (activities ?? []).filter(a => statusFilter === 'all' || a.status === statusFilter);

  const stats = {
    total: (activities ?? []).length,
    completed: (activities ?? []).filter(a => a.status === 'completed').length,
    planned: (activities ?? []).filter(a => a.status === 'planned').length,
    inProgress: (activities ?? []).filter(a => a.status === 'in_progress').length,
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Activity Journal"
          subtitle="Record all paddock activities — spraying, fertilizing, seeding, and more"
          action={
            <button onClick={() => { reset(); setModalOpen(true); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Log Activity
            </button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'bg-gray-50 border-gray-200' },
            { label: 'Completed', value: stats.completed, color: 'bg-green-50 border-green-200' },
            { label: 'Planned', value: stats.planned, color: 'bg-blue-50 border-blue-200' },
            { label: 'In Progress', value: stats.inProgress, color: 'bg-yellow-50 border-yellow-200' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input w-auto text-sm">
            <option value="all">All Types</option>
            {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-auto text-sm">
            <option value="all">All Status</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {isLoading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No activities recorded" description="Start logging your paddock activities to build your spray journal." />
        ) : (
          <div className="space-y-3">
            {filtered.map(a => {
              const t = TYPE_MAP[a.activity_type] ?? { label: a.activity_type, icon: '📋', color: 'bg-gray-100 text-gray-700' };
              return (
                <div key={a.id} className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${t.color}`}>
                      {t.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{t.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status]}`}>
                          {a.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {a.paddock_name ?? 'Unknown paddock'}
                        {a.operator_name && ` · ${a.operator_name}`}
                        {a.equipment && ` · ${a.equipment}`}
                      </p>
                      {a.area_applied_ha && <p className="text-xs text-gray-400 mt-0.5">{a.area_applied_ha} ha applied</p>}
                      {a.products && a.products.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {a.products.map((p: any, i: number) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {p.product_name} {p.rate && `@ ${p.rate} ${p.rate_unit ?? ''}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-gray-700 font-medium">
                        {a.completed_date ? formatDate(a.completed_date) : a.planned_date ? formatDate(a.planned_date) : '—'}
                      </p>
                      {a.cost_amount && <p className="text-xs text-gray-400">${Number(a.cost_amount).toFixed(2)}</p>}
                      <div className="flex gap-1 mt-2 justify-end">
                        {a.status !== 'completed' && (
                          <button onClick={() => completeMutation.mutate(a.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Mark complete">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => { if (confirm('Delete this activity?')) deleteMutation.mutate(a.id); }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Modal */}
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Activity">
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Activity Type</label>
                <select className="input" {...register('activity_type', { required: true })}>
                  {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Paddock</label>
                <select className="input" {...register('paddock_id', { required: true })}>
                  <option value="">Select paddock</option>
                  {(paddocks ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Planned Date</label>
                <input type="date" className="input" {...register('planned_date')} />
              </div>
              <div>
                <label className="label">Area Applied (ha)</label>
                <input type="number" step="0.01" className="input" {...register('area_applied_ha')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Operator</label>
                <input className="input" placeholder="e.g. John Smith" {...register('operator_name')} />
              </div>
              <div>
                <label className="label">Equipment</label>
                <input className="input" placeholder="e.g. Boom Sprayer" {...register('equipment')} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="label">Wind (km/h)</label>
                <input type="number" step="0.1" className="input" {...register('wind_speed_kmh')} />
              </div>
              <div>
                <label className="label">Wind Dir</label>
                <input className="input" placeholder="NW" {...register('wind_direction')} />
              </div>
              <div>
                <label className="label">Temp (°C)</label>
                <input type="number" step="0.1" className="input" {...register('temperature_c')} />
              </div>
              <div>
                <label className="label">Humidity %</label>
                <input type="number" step="1" className="input" {...register('humidity_pct')} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input h-20" {...register('notes')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Cost ($)</label>
                <input type="number" step="0.01" className="input" {...register('cost_amount')} />
              </div>
              <div>
                <label className="label">Water Rate (L/ha)</label>
                <input type="number" step="0.1" className="input" {...register('water_rate_lha')} />
              </div>
            </div>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full">
              {createMutation.isPending ? 'Saving…' : 'Log Activity'}
            </button>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
