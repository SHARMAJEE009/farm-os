'use client';

import { useState } from 'react';
import { useFarm } from '@/lib/farm-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, Fuel, Trash2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Timesheet, FuelLog, Paddock, User } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';

type Tab = 'timesheets' | 'fuel';

interface TimesheetForm {
  user_id: string;
  paddock_id: string;
  hours: string;
  hourly_rate: string;
  date: string;
}

interface FuelForm {
  paddock_id: string;
  litres: string;
  price_per_litre: string;
  date: string;
}

export default function StaffPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('timesheets');
  const [tsModalOpen, setTsModalOpen] = useState(false);
  const [fuelModalOpen, setFuelModalOpen] = useState(false);

  const { activeFarmId } = useFarm();
  const farmParams = activeFarmId ? { farm_id: activeFarmId } : {};

  const { data: timesheets, isLoading: tsLoading } = useQuery<Timesheet[]>({
    queryKey: ['timesheets', activeFarmId],
    queryFn: () => api.get('/timesheets').then(r => r.data),
  });

  const { data: fuelLogs, isLoading: fuelLoading } = useQuery<FuelLog[]>({
    queryKey: ['fuel-logs', activeFarmId],
    queryFn: () => api.get('/fuel-logs').then(r => r.data),
  });

  const { data: paddocks } = useQuery<Paddock[]>({
    queryKey: ['paddocks', activeFarmId],
    queryFn: () => api.get('/paddocks', { params: farmParams }).then(r => r.data),
  });

  const { data: staffUsers } = useQuery<User[]>({
    queryKey: ['staff-users'],
    queryFn: () => api.get('/users?role=staff').then(r => r.data),
  });

  const tsForm = useForm<TimesheetForm>({ defaultValues: { date: new Date().toISOString().split('T')[0] } });
  const fuelForm = useForm<FuelForm>({ defaultValues: { date: new Date().toISOString().split('T')[0] } });

  const tsMutation = useMutation({
    mutationFn: (d: TimesheetForm) => {
      const payload: any = {
        paddock_id: d.paddock_id,
        hours: parseFloat(d.hours),
        hourly_rate: parseFloat(d.hourly_rate),
        date: d.date,
      };
      if (d.user_id) payload.user_id = d.user_id;
      return api.post('/timesheets', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      qc.invalidateQueries({ queryKey: ['financial-transactions'] });
      setTsModalOpen(false);
      tsForm.reset({ date: new Date().toISOString().split('T')[0] });
    },
  });

  const fuelMutation = useMutation({
    mutationFn: (d: FuelForm) =>
      api.post('/fuel-logs', { ...d, litres: parseFloat(d.litres), price_per_litre: parseFloat(d.price_per_litre) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel-logs'] });
      qc.invalidateQueries({ queryKey: ['financial-transactions'] });
      setFuelModalOpen(false);
      fuelForm.reset({ date: new Date().toISOString().split('T')[0] });
    },
  });

  const deleteTsMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/timesheets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
  });

  const deleteFuelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/fuel-logs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-logs'] }),
  });

  const tabs = [
    { id: 'timesheets' as Tab, label: 'Timesheets', icon: Clock },
    { id: 'fuel' as Tab, label: 'Fuel Logs', icon: Fuel },
  ];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Staff"
          subtitle="Track labour hours and fuel usage by paddock"
          action={
            <button
              onClick={() => tab === 'timesheets' ? setTsModalOpen(true) : setFuelModalOpen(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {tab === 'timesheets' ? 'Log Hours' : 'Log Fuel'}
            </button>
          }
        />

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Timesheets table */}
        {tab === 'timesheets' && (
          tsLoading ? <Spinner /> :
          timesheets && timesheets.length > 0 ? (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Staff', 'Paddock', 'Date', 'Hours', 'Rate/hr', 'Total', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {timesheets.map((ts) => (
                    <tr key={ts.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-gray-600">
                        {ts.user?.name ?? ts.staff_name ?? '—'}
                        {!ts.user_id && ts.staff_name && (
                          <span className="ml-1.5 text-xs text-gray-400">(manual)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{ts.paddock?.name ?? ts.paddock_id}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(ts.date)}</td>
                      <td className="px-4 py-3 text-gray-700">{ts.hours}h</td>
                      <td className="px-4 py-3 text-gray-500">{formatCurrency(ts.hourly_rate)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(ts.total_cost)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteTsMutation.mutate(ts.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : (
            <EmptyState icon={Clock} title="No timesheets yet" description="Start logging staff hours against paddocks." action={<button onClick={() => setTsModalOpen(true)} className="btn-primary">Log first hours</button>} />
          )
        )}

        {/* Fuel logs table */}
        {tab === 'fuel' && (
          fuelLoading ? <Spinner /> :
          fuelLogs && fuelLogs.length > 0 ? (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[440px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Paddock', 'Date', 'Litres', 'Price/L', 'Total', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fuelLogs.map((fl) => (
                    <tr key={fl.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{fl.paddock?.name ?? fl.paddock_id}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(fl.date)}</td>
                      <td className="px-4 py-3 text-gray-700">{fl.litres}L</td>
                      <td className="px-4 py-3 text-gray-500">{formatCurrency(fl.price_per_litre)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(fl.total_cost)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteFuelMutation.mutate(fl.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : (
            <EmptyState icon={Fuel} title="No fuel logs yet" description="Track fuel usage per paddock to understand machinery costs." action={<button onClick={() => setFuelModalOpen(true)} className="btn-primary">Log first fuel entry</button>} />
          )
        )}

        {/* Timesheet modal */}
        <Modal open={tsModalOpen} onClose={() => { setTsModalOpen(false); tsForm.reset(); }} title="Log Hours">
          <form onSubmit={tsForm.handleSubmit(d => tsMutation.mutate(d))} className="space-y-4">
            {tsMutation.isError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Failed to save. Please check all fields and try again.
              </div>
            )}
            <div>
              <label className="label">Staff Member *</label>
              <select className="input" {...tsForm.register('user_id', { required: true })}>
                <option value="">Select staff member…</option>
                {staffUsers?.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Paddock *</label>
              <select className="input" {...tsForm.register('paddock_id', { required: true })}>
                <option value="">Select paddock…</option>
                {paddocks?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Hours *</label>
                <input className="input" type="number" step="0.5" min="0.5" placeholder="8" {...tsForm.register('hours', { required: true })} />
              </div>
              <div>
                <label className="label">Rate ($/hr) *</label>
                <input className="input" type="number" step="0.01" min="0" placeholder="28.00" {...tsForm.register('hourly_rate', { required: true })} />
              </div>
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" {...tsForm.register('date')} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setTsModalOpen(false); tsForm.reset(); }} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={tsMutation.isPending} className="btn-primary flex-1">
                {tsMutation.isPending ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Fuel modal */}
        <Modal open={fuelModalOpen} onClose={() => { setFuelModalOpen(false); fuelForm.reset(); }} title="Log Fuel">
          <form onSubmit={fuelForm.handleSubmit(d => fuelMutation.mutate(d))} className="space-y-4">
            {fuelMutation.isError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Failed to save. Please check all fields and try again.
              </div>
            )}
            <div>
              <label className="label">Paddock *</label>
              <select className="input" {...fuelForm.register('paddock_id', { required: true })}>
                <option value="">Select paddock…</option>
                {paddocks?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Litres *</label>
                <input className="input" type="number" step="0.1" min="0.1" placeholder="120" {...fuelForm.register('litres', { required: true })} />
              </div>
              <div>
                <label className="label">Price/Litre *</label>
                <input className="input" type="number" step="0.001" min="0" placeholder="2.15" {...fuelForm.register('price_per_litre', { required: true })} />
              </div>
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" {...fuelForm.register('date')} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setFuelModalOpen(false); fuelForm.reset(); }} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={fuelMutation.isPending} className="btn-primary flex-1">
                {fuelMutation.isPending ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
