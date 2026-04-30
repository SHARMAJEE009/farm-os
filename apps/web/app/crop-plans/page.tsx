'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wheat, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFarm } from '@/lib/farm-context';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { CropPlan, Paddock } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  harvested: 'bg-amber-100 text-amber-700',
  abandoned: 'bg-gray-100 text-gray-500',
};

export default function CropPlansPage() {
  const qc = useQueryClient();
  const { activeFarmId } = useFarm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<CropPlan | null>(null);

  const { register, handleSubmit, reset, setValue } = useForm();

  const { data: plans, isLoading } = useQuery<CropPlan[]>({
    queryKey: ['crop-plans', activeFarmId],
    queryFn: () => api.get('/crop-plans', { params: activeFarmId ? { farm_id: activeFarmId } : {} }).then(r => r.data),
  });

  const { data: paddocks } = useQuery<Paddock[]>({
    queryKey: ['paddocks', activeFarmId],
    queryFn: () => api.get('/paddocks', { params: activeFarmId ? { farm_id: activeFarmId } : {} }).then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: (d: any) => editItem
      ? api.patch(`/crop-plans/${editItem.id}`, d)
      : api.post('/crop-plans', { ...d, farm_id: activeFarmId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crop-plans'] }); setModalOpen(false); setEditItem(null); reset(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/crop-plans/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crop-plans'] }),
  });

  const openEdit = (p: CropPlan) => {
    setEditItem(p);
    Object.entries(p).forEach(([k, v]) => { if (v !== null && v !== undefined) setValue(k, v); });
    setModalOpen(true);
  };

  const totalPlanned = (plans ?? []).reduce((s, p) => s + (Number(p.estimated_revenue_per_ha ?? 0) * Number(p.land_area ?? 0)), 0);
  const totalActual = (plans ?? []).reduce((s, p) => s + (Number(p.actual_revenue_per_ha ?? 0) * Number(p.land_area ?? 0)), 0);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Crop Plans"
          subtitle="Plan your seasons — set targets, track yields, and compare performance"
          action={
            <button onClick={() => { reset(); setEditItem(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Plan
            </button>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card p-4">
            <p className="text-2xl font-bold text-gray-900">{(plans ?? []).length}</p>
            <p className="text-xs text-gray-500">Total Plans</p>
          </div>
          <div className="card p-4 bg-green-50 border-green-200">
            <p className="text-2xl font-bold text-green-700">{(plans ?? []).filter(p => p.status === 'active').length}</p>
            <p className="text-xs text-green-600">Active</p>
          </div>
          <div className="card p-4 bg-amber-50 border-amber-200">
            <p className="text-2xl font-bold text-amber-700">{(plans ?? []).filter(p => p.status === 'harvested').length}</p>
            <p className="text-xs text-amber-600">Harvested</p>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPlanned)}</p>
            <p className="text-xs text-gray-500">Est. Revenue</p>
          </div>
        </div>

        {isLoading ? <Spinner /> : (plans ?? []).length === 0 ? (
          <EmptyState icon={Wheat} title="No crop plans" description="Create seasonal plans for your paddocks to track crop performance." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Paddock</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Season</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Crop</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Target Yield</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Actual Yield</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Variance</th>
                  <th className="text-right py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {(plans ?? []).map(p => {
                  const variance = p.target_yield_per_ha && p.actual_yield_per_ha
                    ? ((Number(p.actual_yield_per_ha) - Number(p.target_yield_per_ha)) / Number(p.target_yield_per_ha) * 100)
                    : null;
                  return (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-gray-900">{p.paddock_name}</td>
                      <td className="py-3 px-4 text-gray-600">{p.season}</td>
                      <td className="py-3 px-4 text-gray-600">{p.planned_crop ?? '—'}{p.planned_variety ? ` (${p.planned_variety})` : ''}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">{p.target_yield_per_ha ? `${p.target_yield_per_ha} ${p.target_yield_unit}` : '—'}</td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">{p.actual_yield_per_ha ? `${p.actual_yield_per_ha} ${p.target_yield_unit}` : '—'}</td>
                      <td className="py-3 px-4 text-right">
                        {variance !== null ? (
                          <span className={`flex items-center justify-end gap-1 text-xs font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {variance >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(p.id); }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); reset(); }} title={editItem ? 'Edit Crop Plan' : 'New Crop Plan'}>
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Paddock</label>
                <select className="input" {...register('paddock_id', { required: true })}>
                  <option value="">Select</option>
                  {(paddocks ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Season</label>
                <input className="input" placeholder="e.g. 2026 Winter" {...register('season', { required: true })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Planned Crop</label>
                <input className="input" placeholder="e.g. Wheat" {...register('planned_crop')} />
              </div>
              <div>
                <label className="label">Variety</label>
                <input className="input" placeholder="e.g. Scepter" {...register('planned_variety')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Target Yield (per ha)</label>
                <input type="number" step="0.01" className="input" {...register('target_yield_per_ha')} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" {...register('status')}>
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="harvested">Harvested</option>
                  <option value="abandoned">Abandoned</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Est. Revenue ($/ha)</label>
                <input type="number" step="0.01" className="input" {...register('estimated_revenue_per_ha')} />
              </div>
              <div>
                <label className="label">Est. Cost ($/ha)</label>
                <input type="number" step="0.01" className="input" {...register('estimated_cost_per_ha')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Sowing Date</label>
                <input type="date" className="input" {...register('sowing_date')} />
              </div>
              <div>
                <label className="label">Harvest Date</label>
                <input type="date" className="input" {...register('harvest_date')} />
              </div>
            </div>
            {editItem && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Actual Yield (per ha)</label>
                  <input type="number" step="0.01" className="input" {...register('actual_yield_per_ha')} />
                </div>
                <div>
                  <label className="label">Actual Revenue ($/ha)</label>
                  <input type="number" step="0.01" className="input" {...register('actual_revenue_per_ha')} />
                </div>
              </div>
            )}
            <button type="submit" disabled={mutation.isPending} className="btn-primary w-full">
              {mutation.isPending ? 'Saving…' : editItem ? 'Update Plan' : 'Create Plan'}
            </button>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
