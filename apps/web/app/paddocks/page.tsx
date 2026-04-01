'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Map, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/lib/utils';
import type { Paddock } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';

interface PaddockForm {
  name: string;
  area_hectares: string;
  crop_type: string;
}

export default function PaddocksPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Paddock | null>(null);

  const { data: paddocks, isLoading } = useQuery<Paddock[]>({
    queryKey: ['paddocks'],
    queryFn: () => api.get('/paddocks').then(r => r.data),
  });

  const { register, handleSubmit, reset, setValue } = useForm<PaddockForm>();

  const createMutation = useMutation({
    mutationFn: (d: PaddockForm) =>
      api.post('/paddocks', { ...d, area_hectares: parseFloat(d.area_hectares) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paddocks'] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: (d: PaddockForm) =>
      api.patch(`/paddocks/${editItem!.id}`, { ...d, area_hectares: parseFloat(d.area_hectares) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paddocks'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/paddocks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paddocks'] }),
  });

  const openCreate = () => { reset(); setEditItem(null); setModalOpen(true); };
  const openEdit = (p: Paddock) => {
    setEditItem(p);
    setValue('name', p.name);
    setValue('area_hectares', p.area_hectares?.toString() ?? '');
    setValue('crop_type', p.crop_type ?? '');
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditItem(null); reset(); };

  const onSubmit = (d: PaddockForm) => {
    editItem ? updateMutation.mutate(d) : createMutation.mutate(d);
  };

  return (
    <AppLayout>
      <div className="p-6">
        <PageHeader
          title="Paddocks"
          subtitle="Manage your farm paddocks and crop records"
          action={
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Paddock
            </button>
          }
        />

        {isLoading ? (
          <Spinner />
        ) : paddocks && paddocks.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paddocks.map((p) => (
              <div key={p.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-farm-100 rounded-xl flex items-center justify-center">
                    <Map className="w-5 h-5 text-farm-600" />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1.5 text-gray-400 hover:text-farm-600 hover:bg-farm-50 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(p.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900">{p.name}</h3>
                <div className="mt-2 space-y-1">
                  {p.area_hectares && (
                    <p className="text-sm text-gray-500">{p.area_hectares} ha</p>
                  )}
                  {p.crop_type && (
                    <span className="inline-block text-xs bg-farm-100 text-farm-700 px-2 py-0.5 rounded-full font-medium">
                      {p.crop_type}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Map}
            title="No paddocks yet"
            description="Add your first paddock to start tracking crop data and costs."
            action={
              <button onClick={openCreate} className="btn-primary">
                Add your first paddock
              </button>
            }
          />
        )}

        <Modal
          open={modalOpen}
          onClose={closeModal}
          title={editItem ? 'Edit Paddock' : 'Add Paddock'}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Paddock Name *</label>
              <input className="input" placeholder="e.g. North Block" {...register('name', { required: true })} />
            </div>
            <div>
              <label className="label">Area (hectares)</label>
              <input className="input" type="number" step="0.1" placeholder="e.g. 45.5" {...register('area_hectares')} />
            </div>
            <div>
              <label className="label">Crop Type</label>
              <input className="input" placeholder="e.g. Wheat, Canola, Barley" {...register('crop_type')} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1">
                {editItem ? 'Save Changes' : 'Create Paddock'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
