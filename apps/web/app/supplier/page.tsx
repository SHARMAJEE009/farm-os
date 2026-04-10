'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ShoppingCart, Truck, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import type { SupplierOrder, Paddock } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';

interface OrderForm {
  paddock_id: string;
  supplier_name: string;
  product_name: string;
  quantity: string;
  unit_price: string;
}

const STATUS_OPTIONS = ['pending', 'ordered', 'delivered'];

export default function SupplierPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: orders, isLoading } = useQuery<SupplierOrder[]>({
    queryKey: ['supplier-orders'],
    queryFn: () => api.get('/supplier-orders').then(r => r.data),
  });

  const { data: paddocks } = useQuery<Paddock[]>({
    queryKey: ['paddocks'],
    queryFn: () => api.get('/paddocks').then(r => r.data),
  });

  const { register, handleSubmit, reset } = useForm<OrderForm>();

  const createMutation = useMutation({
    mutationFn: (d: OrderForm) =>
      api.post('/supplier-orders', {
        paddock_id: d.paddock_id,
        supplier_name: d.supplier_name || null,
        product_name: d.product_name,
        quantity: parseFloat(d.quantity),
        unit_price: parseFloat(d.unit_price),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['supplier-orders'] }); setModalOpen(false); reset(); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/supplier-orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-orders'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/supplier-orders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-orders'] }),
  });

  return (
    <AppLayout>
      <div className="p-6">
        <PageHeader
          title="Supplier Orders"
          subtitle="Manage product orders and fulfilment status"
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Supplier Order
            </button>
          }
        />

        {isLoading ? (
          <Spinner />
        ) : orders && orders.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Product', 'Supplier', 'Paddock', 'Qty', 'Unit Price', 'Total', 'Status', 'Date', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{o.product_name}</td>
                    <td className="px-4 py-3 text-gray-500">{o.supplier_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{o.paddock?.name ?? o.paddock_id}</td>
                    <td className="px-4 py-3 text-gray-700">{o.quantity}</td>
                    <td className="px-4 py-3 text-gray-500">{formatCurrency(o.unit_price)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(o.total_price)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={o.status}
                        onChange={(e) => statusMutation.mutate({ id: o.id, status: e.target.value })}
                        className={`text-xs rounded-full px-2 py-1 font-medium border-0 cursor-pointer ${getStatusColor(o.status)}`}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteMutation.mutate(o.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ShoppingCart}
            title="No orders yet"
            description="Create a supplier order linked to a paddock to track inputs and costs."
            action={<button onClick={() => setModalOpen(true)} className="btn-primary">Create first order</button>}
          />
        )}

        <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="New Supplier Order">
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Paddock *</label>
              <select className="input" {...register('paddock_id', { required: true })}>
                <option value="">Select paddock…</option>
                {paddocks?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Supplier Name</label>
              <input className="input" placeholder="e.g. Elders, Nutrien Ag" {...register('supplier_name')} />
            </div>
            <div>
              <label className="label">Product Name *</label>
              <input className="input" placeholder="e.g. Urea 46%, Roundup 500L" {...register('product_name', { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Quantity *</label>
                <input className="input" type="number" step="0.01" placeholder="100" {...register('quantity', { required: true })} />
              </div>
              <div>
                <label className="label">Unit Price ($) *</label>
                <input className="input" type="number" step="0.01" placeholder="2.50" {...register('unit_price', { required: true })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setModalOpen(false); reset(); }} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1">Create Order</button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
