'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Warehouse, Plus, Pencil, Trash2, AlertTriangle, ArrowDown, ArrowUp, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFarm } from '@/lib/farm-context';
import { formatDate } from '@/lib/utils';
import type { InventoryItem } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';

const CAT_ICONS: Record<string, string> = { chemical: '🧪', fertilizer: '🌿', seed: '🌱', adjuvant: '💧' };

export default function InventoryPage() {
  const qc = useQueryClient();
  const { activeFarmId } = useFarm();
  const [modalOpen, setModalOpen] = useState(false);
  const [adjustModal, setAdjustModal] = useState<InventoryItem | null>(null);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);

  const { register, handleSubmit, reset, setValue } = useForm();
  const adjustForm = useForm();

  const { data: items, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['inventory', activeFarmId],
    queryFn: () => api.get('/inventory', { params: activeFarmId ? { farm_id: activeFarmId } : {} }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => editItem
      ? api.patch(`/inventory/${editItem.id}`, d)
      : api.post('/inventory', { ...d, farm_id: activeFarmId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); setModalOpen(false); setEditItem(null); reset(); },
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/inventory/${id}/adjust`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); setAdjustModal(null); adjustForm.reset(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    Object.entries(item).forEach(([k, v]) => { if (v !== null) setValue(k, v); });
    setModalOpen(true);
  };

  const lowStock = (items ?? []).filter(i => i.reorder_level && Number(i.current_stock) <= Number(i.reorder_level));
  const expiringSoon = (items ?? []).filter(i => {
    if (!i.expiry_date) return false;
    const diff = (new Date(i.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff <= 30 && diff >= 0;
  });

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Inventory / Shed"
          subtitle="Track your on-farm chemical, fertilizer, and seed stocks"
          action={
            <button onClick={() => { reset(); setEditItem(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          }
        />

        {/* Alerts */}
        {lowStock.length > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800"><strong>{lowStock.length}</strong> item{lowStock.length > 1 ? 's' : ''} below reorder level: {lowStock.map(i => i.product_name).join(', ')}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card p-4">
            <p className="text-2xl font-bold text-gray-900">{(items ?? []).length}</p>
            <p className="text-xs text-gray-500">Total Items</p>
          </div>
          <div className="card p-4 bg-amber-50 border-amber-200">
            <p className="text-2xl font-bold text-amber-700">{lowStock.length}</p>
            <p className="text-xs text-amber-600">Low Stock</p>
          </div>
          <div className="card p-4 bg-red-50 border-red-200">
            <p className="text-2xl font-bold text-red-700">{expiringSoon.length}</p>
            <p className="text-xs text-red-600">Expiring Soon</p>
          </div>
          <div className="card p-4 bg-green-50 border-green-200">
            <p className="text-2xl font-bold text-green-700">{(items ?? []).filter(i => Number(i.current_stock) > 0).length}</p>
            <p className="text-xs text-green-600">In Stock</p>
          </div>
        </div>

        {isLoading ? <Spinner /> : (items ?? []).length === 0 ? (
          <EmptyState icon={Warehouse} title="Inventory empty" description="Add chemicals, fertilizers, and seeds to track your stock levels." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Product</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Location</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Stock</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Reorder</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Batch</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Expiry</th>
                  <th className="text-right py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map(item => {
                  const isLow = item.reorder_level && Number(item.current_stock) <= Number(item.reorder_level);
                  return (
                    <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isLow ? 'bg-amber-50/50' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{CAT_ICONS[item.category] ?? '📦'}</span>
                          <div>
                            <p className="font-medium text-gray-900">{item.product_name}</p>
                            <p className="text-xs text-gray-400 capitalize">{item.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{item.location ?? '—'}</td>
                      <td className={`py-3 px-4 text-right font-bold ${isLow ? 'text-amber-700' : 'text-gray-900'}`}>
                        {Number(item.current_stock).toFixed(1)} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500">{item.reorder_level ? `${item.reorder_level} ${item.unit}` : '—'}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{item.batch_number ?? '—'}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{item.expiry_date ? formatDate(item.expiry_date) : '—'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => { adjustForm.reset(); setAdjustModal(item); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Adjust stock">
                            <Package className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(item.id); }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); reset(); }} title={editItem ? 'Edit Item' : 'Add Inventory Item'}>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Product Name</label>
              <input className="input" placeholder="e.g. Roundup 540" {...register('product_name', { required: true })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Category</label>
                <select className="input" {...register('category')}>
                  <option value="chemical">Chemical</option>
                  <option value="fertilizer">Fertilizer</option>
                  <option value="seed">Seed</option>
                  <option value="adjuvant">Adjuvant</option>
                </select>
              </div>
              <div>
                <label className="label">Current Stock</label>
                <input type="number" step="0.1" className="input" {...register('current_stock', { required: true })} />
              </div>
              <div>
                <label className="label">Unit</label>
                <select className="input" {...register('unit')}>
                  <option value="L">Litres</option>
                  <option value="kg">kg</option>
                  <option value="mL">mL</option>
                  <option value="g">Grams</option>
                  <option value="bags">Bags</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Reorder Level</label>
                <input type="number" step="0.1" className="input" {...register('reorder_level')} />
              </div>
              <div>
                <label className="label">Location / Shed</label>
                <input className="input" placeholder="e.g. Main Shed" {...register('location')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Batch Number</label>
                <input className="input" {...register('batch_number')} />
              </div>
              <div>
                <label className="label">Expiry Date</label>
                <input type="date" className="input" {...register('expiry_date')} />
              </div>
            </div>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full">
              {createMutation.isPending ? 'Saving…' : editItem ? 'Update' : 'Add Item'}
            </button>
          </form>
        </Modal>

        {/* Adjust Stock Modal */}
        <Modal open={!!adjustModal} onClose={() => setAdjustModal(null)} title={`Adjust Stock — ${adjustModal?.product_name}`}>
          <form onSubmit={adjustForm.handleSubmit(d => adjustMutation.mutate({ id: adjustModal!.id, data: d }))} className="space-y-4">
            <p className="text-sm text-gray-500">Current stock: <strong>{adjustModal?.current_stock} {adjustModal?.unit}</strong></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select className="input" {...adjustForm.register('transaction_type', { required: true })}>
                  <option value="received">Received (+)</option>
                  <option value="used">Used (−)</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="disposed">Disposed (−)</option>
                </select>
              </div>
              <div>
                <label className="label">Quantity</label>
                <input type="number" step="0.1" className="input" {...adjustForm.register('quantity', { required: true })} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" placeholder="Reason for adjustment" {...adjustForm.register('notes')} />
            </div>
            <button type="submit" disabled={adjustMutation.isPending} className="btn-primary w-full">
              {adjustMutation.isPending ? 'Saving…' : 'Adjust Stock'}
            </button>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
