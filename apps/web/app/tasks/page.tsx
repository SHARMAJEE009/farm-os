'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListChecks, Plus, Pencil, Trash2, Clock, CheckCircle2, AlertCircle, User } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFarm } from '@/lib/farm-context';
import { formatDate } from '@/lib/utils';
import type { Task, Paddock } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

const TASK_TYPES = ['general', 'spraying', 'fertilizing', 'fencing', 'maintenance', 'livestock'];

export default function TasksPage() {
  const qc = useQueryClient();
  const { activeFarmId } = useFarm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const { register, handleSubmit, reset, setValue } = useForm();

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', activeFarmId, statusFilter],
    queryFn: () => {
      const params: any = {};
      if (activeFarmId) params.farm_id = activeFarmId;
      if (statusFilter !== 'all') params.status = statusFilter;
      return api.get('/tasks', { params }).then(r => r.data);
    },
  });

  const { data: paddocks } = useQuery<Paddock[]>({
    queryKey: ['paddocks', activeFarmId],
    queryFn: () => api.get('/paddocks', { params: activeFarmId ? { farm_id: activeFarmId } : {} }).then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: (d: any) => editItem
      ? api.patch(`/tasks/${editItem.id}`, d)
      : api.post('/tasks', { ...d, farm_id: activeFarmId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setModalOpen(false); setEditItem(null); reset(); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/tasks/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const openEdit = (t: Task) => {
    setEditItem(t);
    Object.entries(t).forEach(([k, v]) => { if (v !== null && v !== undefined) setValue(k, v); });
    setModalOpen(true);
  };

  const overdue = (tasks ?? []).filter(t => t.due_date && new Date(t.due_date) < new Date() && !['completed', 'cancelled'].includes(t.status));

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Tasks & Work Orders"
          subtitle="Assign, track, and complete field tasks for your team"
          action={
            <button onClick={() => { reset(); setEditItem(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Task
            </button>
          }
        />

        {/* Overdue alert */}
        {overdue.length > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800"><strong>{overdue.length}</strong> overdue task{overdue.length > 1 ? 's' : ''} need attention</p>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          {['all', 'pending', 'assigned', 'in_progress', 'completed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-farm-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>

        {isLoading ? <Spinner /> : (tasks ?? []).length === 0 ? (
          <EmptyState icon={ListChecks} title="No tasks" description="Create work orders to dispatch to your field staff." />
        ) : (
          <div className="space-y-3">
            {(tasks ?? []).map(t => {
              const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['completed', 'cancelled'].includes(t.status);
              return (
                <div key={t.id} className={`card p-4 hover:shadow-md transition-shadow ${isOverdue ? 'border-red-200 bg-red-50/30' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => statusMutation.mutate({ id: t.id, status: t.status === 'completed' ? 'pending' : 'completed' })}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          t.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'
                        }`}
                      >
                        {t.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-semibold ${t.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{t.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{t.status.replace('_', ' ')}</span>
                      </div>
                      {t.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.description}</p>}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                        {t.paddock_name && <span>📍 {t.paddock_name}</span>}
                        {t.assigned_to_name && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {t.assigned_to_name}</span>}
                        {t.task_type !== 'general' && <span className="capitalize">🏷️ {t.task_type}</span>}
                        {t.estimated_hours && <span>⏱️ {t.estimated_hours}h est.</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {t.due_date && (
                        <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                          {isOverdue && '⚠️ '}Due {formatDate(t.due_date)}
                        </p>
                      )}
                      <div className="flex gap-1 mt-2 justify-end">
                        <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(t.id); }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); reset(); }} title={editItem ? 'Edit Task' : 'New Task'}>
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Title</label>
              <input className="input" placeholder="e.g. Spray paddock 5 for weeds" {...register('title', { required: true })} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input h-20" {...register('description')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Paddock</label>
                <select className="input" {...register('paddock_id')}>
                  <option value="">None</option>
                  {(paddocks ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Task Type</label>
                <select className="input" {...register('task_type')}>
                  {TASK_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Priority</label>
                <select className="input" {...register('priority')}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="label">Due Date</label>
                <input type="date" className="input" {...register('due_date')} />
              </div>
              <div>
                <label className="label">Est. Hours</label>
                <input type="number" step="0.5" className="input" {...register('estimated_hours')} />
              </div>
            </div>
            <div>
              <label className="label">Assigned To</label>
              <input className="input" placeholder="e.g. John Smith" {...register('assigned_to_name')} />
            </div>
            {editItem && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Status</label>
                  <select className="input" {...register('status')}>
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="label">Actual Hours</label>
                  <input type="number" step="0.5" className="input" {...register('actual_hours')} />
                </div>
              </div>
            )}
            <button type="submit" disabled={mutation.isPending} className="btn-primary w-full">
              {mutation.isPending ? 'Saving…' : editItem ? 'Update Task' : 'Create Task'}
            </button>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
