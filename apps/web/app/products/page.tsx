'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Plus, Pencil, Trash2, Search, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFarm } from '@/lib/farm-context';
import type { Product } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';

const CATEGORIES = [
  { value: 'chemical', label: 'Chemical', emoji: '🧪', color: 'bg-purple-100 text-purple-700' },
  { value: 'fertilizer', label: 'Fertilizer', emoji: '🌿', color: 'bg-green-100 text-green-700' },
  { value: 'seed', label: 'Seed', emoji: '🌱', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'adjuvant', label: 'Adjuvant', emoji: '💧', color: 'bg-blue-100 text-blue-700' },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

const SIGNAL_COLORS: Record<string, string> = {
  Caution: 'bg-yellow-100 text-yellow-800',
  Warning: 'bg-orange-100 text-orange-800',
  Danger: 'bg-red-100 text-red-800',
};

export default function ProductsPage() {
  const qc = useQueryClient();
  const { activeFarmId } = useFarm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const { register, handleSubmit, reset, setValue } = useForm();

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['products', activeFarmId, catFilter],
    queryFn: () => {
      const params: any = {};
      if (activeFarmId) params.farm_id = activeFarmId;
      if (catFilter !== 'all') params.category = catFilter;
      return api.get('/products', { params }).then(r => r.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => editItem
      ? api.patch(`/products/${editItem.id}`, d)
      : api.post('/products', { ...d, farm_id: activeFarmId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setModalOpen(false); setEditItem(null); reset(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const openEdit = (p: Product) => {
    setEditItem(p);
    Object.entries(p).forEach(([k, v]) => { if (v !== null) setValue(k, v); });
    setModalOpen(true);
  };

  const filtered = (products ?? []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.active_ingredient ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Product Library"
          subtitle="Manage your chemicals, fertilizers, seeds, and adjuvants"
          action={
            <button onClick={() => { reset(); setEditItem(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" className="input pl-9" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input w-auto text-sm">
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
          </select>
        </div>

        {isLoading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={FlaskConical} title="No products yet" description="Add chemicals, fertilizers, and seeds to your product library." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => {
              const cat = CAT_MAP[p.category] ?? { label: p.category, emoji: '📦', color: 'bg-gray-100 text-gray-700' };
              return (
                <div key={p.id} className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${cat.color}`}>
                      {cat.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                      <p className="text-xs text-gray-500">{cat.label}{p.manufacturer ? ` · ${p.manufacturer}` : ''}</p>
                      {p.active_ingredient && <p className="text-xs text-gray-400 mt-0.5">Active: {p.active_ingredient}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.default_rate && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.default_rate} {p.rate_unit}</span>}
                        {p.withholding_period_days && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">WHP: {p.withholding_period_days}d</span>}
                        {p.reentry_interval_hours && <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">REI: {p.reentry_interval_hours}h</span>}
                        {p.signal_word && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SIGNAL_COLORS[p.signal_word] ?? 'bg-gray-100 text-gray-600'}`}>{p.signal_word}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { if (confirm('Delete this product?')) deleteMutation.mutate(p.id); }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create/Edit Modal */}
        <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); reset(); }} title={editItem ? 'Edit Product' : 'Add Product'}>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Product Name</label>
              <input className="input" placeholder="e.g. Roundup PowerMAX" {...register('name', { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <select className="input" {...register('category')}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Manufacturer</label>
                <input className="input" placeholder="e.g. Bayer" {...register('manufacturer')} />
              </div>
            </div>
            <div>
              <label className="label">Active Ingredient</label>
              <input className="input" placeholder="e.g. Glyphosate 540g/L" {...register('active_ingredient')} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Default Rate</label>
                <input type="number" step="0.001" className="input" {...register('default_rate')} />
              </div>
              <div>
                <label className="label">Rate Unit</label>
                <input className="input" placeholder="L/ha" {...register('rate_unit')} />
              </div>
              <div>
                <label className="label">Unit</label>
                <select className="input" {...register('unit')}>
                  <option value="L">Litres (L)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="mL">Millilitres (mL)</option>
                  <option value="g">Grams (g)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">WHP (days)</label>
                <input type="number" className="input" {...register('withholding_period_days')} />
              </div>
              <div>
                <label className="label">REI (hours)</label>
                <input type="number" className="input" {...register('reentry_interval_hours')} />
              </div>
              <div>
                <label className="label">Signal Word</label>
                <select className="input" {...register('signal_word')}>
                  <option value="">None</option>
                  <option value="Caution">Caution</option>
                  <option value="Warning">Warning</option>
                  <option value="Danger">Danger</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input h-16" {...register('notes')} />
            </div>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full">
              {createMutation.isPending ? 'Saving…' : editItem ? 'Update Product' : 'Add Product'}
            </button>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
