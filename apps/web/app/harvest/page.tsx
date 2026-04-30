'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wheat, Plus, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFarm } from '@/lib/farm-context';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { HarvestRecord, Paddock, CropPlan } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';

export default function HarvestPage() {
  const qc = useQueryClient();
  const { activeFarmId } = useFarm();
  const [modalOpen, setModalOpen] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  const { data: records, isLoading } = useQuery<HarvestRecord[]>({
    queryKey: ['harvest', activeFarmId],
    queryFn: () => api.get('/harvest', { params: activeFarmId ? { farm_id: activeFarmId } : {} }).then(r => r.data),
  });

  const { data: paddocks } = useQuery<Paddock[]>({
    queryKey: ['paddocks', activeFarmId],
    queryFn: () => api.get('/paddocks', { params: activeFarmId ? { farm_id: activeFarmId } : {} }).then(r => r.data),
  });

  const { data: plans } = useQuery<CropPlan[]>({
    queryKey: ['crop-plans', activeFarmId],
    queryFn: () => api.get('/crop-plans', { params: activeFarmId ? { farm_id: activeFarmId } : {} }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post('/harvest', { ...d, farm_id: activeFarmId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['harvest'] }); qc.invalidateQueries({ queryKey: ['crop-plans'] }); setModalOpen(false); reset(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/harvest/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['harvest'] }),
  });

  const totalYield = (records ?? []).reduce((s, r) => s + Number(r.yield_total ?? 0), 0);
  const totalRevenue = (records ?? []).reduce((s, r) => s + Number(r.total_revenue ?? 0), 0);
  const avgYieldHa = (records ?? []).filter(r => r.yield_per_ha).length > 0
    ? (records ?? []).reduce((s, r) => s + Number(r.yield_per_ha ?? 0), 0) / (records ?? []).filter(r => r.yield_per_ha).length
    : 0;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Harvest Records"
          subtitle="Track yields, grades, and revenue from each paddock harvest"
          action={
            <button onClick={() => { reset(); setModalOpen(true); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Record Harvest
            </button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card p-4">
            <p className="text-2xl font-bold text-gray-900">{(records ?? []).length}</p>
            <p className="text-xs text-gray-500">Total Records</p>
          </div>
          <div className="card p-4 bg-amber-50 border-amber-200">
            <p className="text-2xl font-bold text-amber-700">{totalYield.toFixed(1)}</p>
            <p className="text-xs text-amber-600">Total Yield (t)</p>
          </div>
          <div className="card p-4 bg-green-50 border-green-200">
            <p className="text-2xl font-bold text-green-700">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-green-600">Total Revenue</p>
          </div>
          <div className="card p-4 bg-blue-50 border-blue-200">
            <p className="text-2xl font-bold text-blue-700">{avgYieldHa.toFixed(2)}</p>
            <p className="text-xs text-blue-600">Avg Yield (t/ha)</p>
          </div>
        </div>

        {isLoading ? <Spinner /> : (records ?? []).length === 0 ? (
          <EmptyState icon={Wheat} title="No harvest records" description="Record your harvest results to track yield performance over time." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Paddock</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Crop</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Total Yield</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Yield/ha</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Moisture</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Grade</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Revenue</th>
                  <th className="text-right py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {(records ?? []).map(r => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-gray-700">{formatDate(r.harvest_date)}</td>
                    <td className="py-3 px-4 font-medium text-gray-900">{r.paddock_name ?? '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{r.crop ?? '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-700 font-medium">{r.yield_total ? `${Number(r.yield_total).toFixed(1)} ${r.yield_unit}` : '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{r.yield_per_ha ? `${Number(r.yield_per_ha).toFixed(2)} t/ha` : '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-500">{r.moisture_pct ? `${r.moisture_pct}%` : '—'}</td>
                    <td className="py-3 px-4">
                      {r.grade && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{r.grade}</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-green-700">{r.total_revenue ? formatCurrency(Number(r.total_revenue)) : '—'}</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(r.id); }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="Record Harvest">
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Paddock</label>
                <select className="input" {...register('paddock_id', { required: true })}>
                  <option value="">Select</option>
                  {(paddocks ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Harvest Date</label>
                <input type="date" className="input" defaultValue={new Date().toISOString().split('T')[0]} {...register('harvest_date', { required: true })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Crop</label>
                <input className="input" placeholder="e.g. Wheat" {...register('crop')} />
              </div>
              <div>
                <label className="label">Link to Crop Plan</label>
                <select className="input" {...register('crop_plan_id')}>
                  <option value="">None</option>
                  {(plans ?? []).map(p => <option key={p.id} value={p.id}>{p.paddock_name} — {p.season}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Total Yield</label>
                <input type="number" step="0.01" className="input" placeholder="150.5" {...register('yield_total')} />
              </div>
              <div>
                <label className="label">Yield/ha</label>
                <input type="number" step="0.01" className="input" placeholder="3.50" {...register('yield_per_ha')} />
              </div>
              <div>
                <label className="label">Moisture %</label>
                <input type="number" step="0.1" className="input" placeholder="12.5" {...register('moisture_pct')} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Grade</label>
                <input className="input" placeholder="e.g. APH1" {...register('grade')} />
              </div>
              <div>
                <label className="label">Price/unit ($)</label>
                <input type="number" step="0.01" className="input" {...register('price_per_unit')} />
              </div>
              <div>
                <label className="label">Total Revenue ($)</label>
                <input type="number" step="0.01" className="input" {...register('total_revenue')} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input h-16" {...register('notes')} />
            </div>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full">
              {createMutation.isPending ? 'Saving…' : 'Record Harvest'}
            </button>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
