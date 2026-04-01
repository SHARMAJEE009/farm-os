'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Leaf, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, getStatusColor } from '@/lib/utils';
import type { Recommendation, Paddock } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';

interface RecForm {
  paddock_id: string;
  type: string;
  description: string;
}

const REC_TYPES = ['Spray', 'Fertiliser', 'Irrigation', 'Cultivation', 'Sowing', 'Harvest', 'Soil Test', 'Other'];

export default function AgronomistPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: recs, isLoading } = useQuery<Recommendation[]>({
    queryKey: ['recommendations'],
    queryFn: () => api.get('/recommendations').then(r => r.data),
  });

  const { data: paddocks } = useQuery<Paddock[]>({
    queryKey: ['paddocks'],
    queryFn: () => api.get('/paddocks').then(r => r.data),
  });

  const { register, handleSubmit, reset } = useForm<RecForm>();

  const createMutation = useMutation({
    mutationFn: (d: RecForm) => api.post('/recommendations', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recommendations'] }); setModalOpen(false); reset(); },
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

  const statusIcon = (s: string) => {
    if (s === 'approved') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (s === 'rejected') return <XCircle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <AppLayout>
      <div className="p-6">
        <PageHeader
          title="Agronomy"
          subtitle="Manage paddock recommendations and spray programs"
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Recommendation
            </button>
          }
        />

        {isLoading ? (
          <Spinner />
        ) : recs && recs.length > 0 ? (
          <div className="space-y-3">
            {recs.map((r) => (
              <div key={r.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5">{statusIcon(r.status)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{r.type}</span>
                        <span className={getStatusColor(r.status)}>{r.status}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-sm text-gray-500">{r.paddock?.name ?? r.paddock_id}</span>
                      </div>
                      {r.description && (
                        <p className="text-sm text-gray-600 mt-1">{r.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{formatDate(r.created_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.status === 'draft' && (
                      <>
                        <button
                          onClick={() => statusMutation.mutate({ id: r.id, status: 'approved' })}
                          className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => statusMutation.mutate({ id: r.id, status: 'rejected' })}
                          className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(r.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Leaf}
            title="No recommendations yet"
            description="Create a paddock recommendation to start the agronomy workflow."
            action={<button onClick={() => setModalOpen(true)} className="btn-primary">Create first recommendation</button>}
          />
        )}

        <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="New Recommendation">
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Paddock *</label>
              <select className="input" {...register('paddock_id', { required: true })}>
                <option value="">Select paddock…</option>
                {paddocks?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Type *</label>
              <select className="input" {...register('type', { required: true })}>
                <option value="">Select type…</option>
                {REC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="input min-h-[100px] resize-none"
                placeholder="Describe the recommendation in detail…"
                {...register('description')}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setModalOpen(false); reset(); }} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1">Create Draft</button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
