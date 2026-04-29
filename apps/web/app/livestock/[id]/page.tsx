'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Beef, ArrowLeft, MapPin, Activity, Scale, Plus, 
  Calendar, AlertCircle, History, TrendingUp, TrendingDown, Layers,
  DollarSign
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Mob, MobPaddockAssignment, HealthEvent, WeighEvent, Paddock, Species, Breed, AnimalClass } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { isAdmin, getRole } from '@/lib/role';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const FarmPaddockMap = dynamic(
  () => import('@/components/ui/GoogleMapPicker').then(m => m.FarmPaddockMap),
  { ssr: false, loading: () => <div className="h-[300px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center text-sm text-gray-400">Loading map…</div> }
);

export default function MobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'health' | 'weigh'>('health');
  const [role, setRole] = useState<string>('staff');
  
  const [assignModal, setAssignModal] = useState(false);
  const [exitModal, setExitModal] = useState(false);
  const [healthModal, setHealthModal] = useState(false);
  const [weighModal, setWeighModal] = useState(false);

  useEffect(() => { setRole(getRole()); }, []);
  const isWritable = isAdmin(role as any);

  // Queries
  const { data: mob, isLoading: mobLoading } = useQuery<Mob>({
    queryKey: ['mob', id],
    queryFn: () => api.get(`/livestock/mobs/${id}`).then(r => r.data),
  });

  // We now get active assignment data directly inside the 'mob' query

  const { data: healthEvents, isLoading: healthLoading } = useQuery<HealthEvent[]>({
    queryKey: ['mob-health', id],
    queryFn: () => api.get(`/livestock/mobs/${id}/health-events`).then(r => r.data),
  });

  const { data: weighEvents, isLoading: weighLoading } = useQuery<WeighEvent[]>({
    queryKey: ['mob-weigh', id],
    queryFn: () => api.get(`/livestock/mobs/${id}/weigh-events`).then(r => r.data),
  });

  const { data: paddocks } = useQuery<Paddock[]>({
    queryKey: ['paddocks'],
    queryFn: () => api.get('/paddocks', { params: { farm_id: mob?.farm_id } }).then(r => r.data),
    enabled: !!mob?.farm_id,
  });

  const { data: species } = useQuery<Species[]>({
    queryKey: ['species'],
    queryFn: () => api.get('/livestock/species').then(r => r.data),
  });
  const { data: breeds } = useQuery<Breed[]>({
    queryKey: ['breeds'],
    queryFn: () => api.get('/livestock/breeds').then(r => r.data),
  });
  const { data: animalClasses } = useQuery<AnimalClass[]>({
    queryKey: ['animal-classes'],
    queryFn: () => api.get('/livestock/animal-classes').then(r => r.data),
  });

  // Forms
  const assignForm = useForm({ defaultValues: { paddock_id: '', entry_date: new Date().toISOString().split('T')[0], entry_head_count: mob?.head_count || 0 } });
  const exitForm = useForm({ defaultValues: { exit_date: new Date().toISOString().split('T')[0], exit_head_count: mob?.head_count || 0, exit_reason: 'moved' } });
  const healthForm = useForm({ defaultValues: { date: new Date().toISOString().split('T')[0], head_count_affected: mob?.head_count || 0 } });
  const weighForm = useForm({ defaultValues: { date: new Date().toISOString().split('T')[0], head_count_weighed: mob?.head_count || 0 } });

  const onPaddockClick = (paddockId: string) => {
    if (mob.current_paddock_name) return; // Already assigned, maybe handle move logic later
    assignForm.setValue('paddock_id', paddockId);
    setAssignModal(true);
  };

  // Mutations
  const assignMutation = useMutation({
    mutationFn: (d: any) => api.post(`/livestock/mobs/${id}/assign-paddock`, {
      ...d,
      entry_head_count: parseInt(d.entry_head_count)
    }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['mob', id] }); 
      setAssignModal(false); 
    },
  });

  const exitMutation = useMutation({
    mutationFn: (d: any) => api.patch(`/livestock/mobs/${id}/exit-paddock`, {
      ...d,
      exit_head_count: parseInt(d.exit_head_count),
      sale_price_per_head: d.sale_price_per_head ? parseFloat(d.sale_price_per_head) : null
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mob', id] }); setExitModal(false); },
  });

  const healthMutation = useMutation({
    mutationFn: (d: any) => api.post(`/livestock/mobs/${id}/health-events`, {
      ...d,
      head_count_affected: parseInt(d.head_count_affected),
      withholding_period_days: d.withholding_period_days ? parseInt(d.withholding_period_days) : null,
      cost_amount: d.cost_amount ? parseFloat(d.cost_amount) : 0
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mob-health', id] }); setHealthModal(false); },
  });

  const weighMutation = useMutation({
    mutationFn: (d: any) => api.post(`/livestock/mobs/${id}/weigh-events`, {
      ...d,
      head_count_weighed: parseInt(d.head_count_weighed),
      average_weight_kg: parseFloat(d.average_weight_kg)
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mob-weigh', id] }); setWeighModal(false); },
  });

  if (mobLoading) return <AppLayout><div className="py-24 flex justify-center"><Spinner /></div></AppLayout>;
  if (!mob) return <AppLayout><div className="p-6 text-center">Mob not found</div></AppLayout>;

  const speciesName = species?.find(s => s.id === mob.species_id)?.name || '—';
  const breedName = mob.breed_id ? breeds?.find(b => b.id === mob.breed_id)?.name || '—' : '—';
  const className = mob.animal_class_id ? animalClasses?.find(c => c.id === mob.animal_class_id)?.name || '—' : '—';

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <Link href="/livestock" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to List
        </Link>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <PageHeader 
            title={mob.name} 
            subtitle={`${speciesName} · ${breedName} · ${className}`} 
          />
          <div className="flex gap-2">
            {isWritable && !mob.current_paddock_name && (
              <button onClick={() => setAssignModal(true)} className="btn-primary flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Assign Paddock
              </button>
            )}
            {isWritable && mob.current_paddock_name && (
              <button onClick={() => setExitModal(true)} className="btn-secondary text-red-600 border-red-100 hover:bg-red-50 flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 rotate-180" /> Exit Paddock
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Info Card */}
          <div className="card h-full">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Mob Details</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Status</span>
                <span className="text-sm font-medium capitalize text-emerald-600">{mob.status}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Head Count</span>
                <span className="text-sm font-bold text-gray-900">{mob.head_count}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Purchase Date</span>
                <span className="text-sm text-gray-900">{mob.purchase_date ? formatDate(mob.purchase_date) : '—'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Source Farm</span>
                <span className="text-sm text-gray-900">{mob.source_farm || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-500">Cost per Head</span>
                <span className="text-sm text-gray-900 font-semibold">{mob.purchase_price_per_head ? formatCurrency(mob.purchase_price_per_head) : '—'}</span>
              </div>
            </div>
          </div>

          {/* Current Location Card */}
          <div className="lg:col-span-2 card bg-emerald-50/30 border-emerald-100 overflow-hidden p-0">
            <div className="p-5 pb-4">
              <h3 className="text-sm font-semibold text-emerald-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Current Location
              </h3>
              {mob.current_paddock_name ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-emerald-600 font-medium uppercase mb-1">Paddock</p>
                    <p className="text-xl font-bold text-gray-900">{mob.current_paddock_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-medium uppercase mb-1">Entry Date</p>
                    <p className="text-lg font-medium text-gray-900">
                      {mob.current_entry_date ? formatDate(mob.current_entry_date) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-medium uppercase mb-1">Stocking Rate</p>
                    <p className="text-lg font-bold text-emerald-700">
                      {mob.stocking_rate_per_ha ? Number(mob.stocking_rate_per_ha).toFixed(2) : '—'} <span className="text-xs font-normal">head/ha</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-gray-500 italic text-sm">
                    <AlertCircle className="w-4 h-4 opacity-50" />
                    Not currently assigned to a paddock
                  </div>
                  {isWritable && <button onClick={() => setAssignModal(true)} className="btn-secondary text-xs">Assign Paddock</button>}
                </div>
              )}
            </div>

            {/* Map Integration */}
            <div className="h-[300px] border-t border-emerald-100">
              <FarmPaddockMap 
                paddocks={paddocks || []} 
                height={300} 
                onPaddockClick={onPaddockClick}
              />
            </div>
            {!mob.current_paddock_name && (
              <div className="px-5 py-2 bg-emerald-100/50 text-[10px] text-emerald-700 font-medium flex items-center gap-1.5">
                <Layers className="w-3 h-3" /> Click a paddock on the map to assign this mob
              </div>
            )}
          </div>
        </div>

        {/* Events Tabs */}
        <div className="card p-0 overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button 
              onClick={() => setActiveTab('health')}
              className={`px-6 py-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'health' ? 'border-farm-600 text-farm-700 bg-farm-50/30' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Activity className="w-4 h-4" /> Health Events
            </button>
            <button 
              onClick={() => setActiveTab('weigh')}
              className={`px-6 py-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'weigh' ? 'border-farm-600 text-farm-700 bg-farm-50/30' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Scale className="w-4 h-4" /> Weigh Events
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'health' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-base font-semibold text-gray-900">Health History</h4>
                  {isWritable && (
                    <button onClick={() => setHealthModal(true)} className="btn-secondary flex items-center gap-2 text-xs">
                      <Plus className="w-3 h-3" /> Add Event
                    </button>
                  )}
                </div>
                {healthLoading ? <Spinner /> : healthEvents?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Date</th>
                          <th className="text-left px-4 py-2 font-medium">Event Type</th>
                          <th className="text-left px-4 py-2 font-medium">Product/Dose</th>
                          <th className="text-left px-4 py-2 font-medium">Affected</th>
                          <th className="text-left px-4 py-2 font-medium">WHP Expiry</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {healthEvents.map(ev => (
                          <tr key={ev.id}>
                            <td className="px-4 py-3">{formatDate(ev.date)}</td>
                            <td className="px-4 py-3 capitalize font-medium">{ev.event_type}</td>
                            <td className="px-4 py-3 text-gray-500">{ev.product_used || '—'} {ev.dose ? `(${ev.dose})` : ''}</td>
                            <td className="px-4 py-3">{ev.head_count_affected}</td>
                            <td className="px-4 py-3">
                              {ev.whp_expiry_date ? (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${new Date(ev.whp_expiry_date) > new Date() ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-400'}`}>
                                  {formatDate(ev.whp_expiry_date)}
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="text-center py-10 text-gray-400 text-sm">No health events recorded.</div>}
              </div>
            )}

            {activeTab === 'weigh' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-base font-semibold text-gray-900">Weight Monitoring</h4>
                  {isWritable && (
                    <button onClick={() => setWeighModal(true)} className="btn-secondary flex items-center gap-2 text-xs">
                      <Plus className="w-3 h-3" /> Add Weigh
                    </button>
                  )}
                </div>
                {weighLoading ? <Spinner /> : weighEvents?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Date</th>
                          <th className="text-left px-4 py-2 font-medium">Head Weighed</th>
                          <th className="text-left px-4 py-2 font-medium">Avg Weight</th>
                          <th className="text-left px-4 py-2 font-medium">Total Weight</th>
                          <th className="text-left px-4 py-2 font-medium">ADG</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {weighEvents.map(ev => (
                          <tr key={ev.id}>
                            <td className="px-4 py-3">{formatDate(ev.date)}</td>
                            <td className="px-4 py-3">{ev.head_count_weighed}</td>
                            <td className="px-4 py-3 font-semibold">{ev.average_weight_kg} kg</td>
                            <td className="px-4 py-3 text-gray-500">{ev.total_weight_kg} kg</td>
                            <td className="px-4 py-3">
                              {ev.adg_since_last_kg != null ? (
                                <div className={`flex items-center gap-1 font-bold ${ev.adg_since_last_kg >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {ev.adg_since_last_kg >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {ev.adg_since_last_kg.toFixed(2)} <span className="text-[10px] font-normal opacity-70">kg/day</span>
                                </div>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="text-center py-10 text-gray-400 text-sm">No weight records.</div>}
              </div>
            )}
          </div>
        </div>

        {/* MODALS */}
        <Modal open={assignModal} onClose={() => setAssignModal(false)} title="Assign to Paddock">
          <form onSubmit={assignForm.handleSubmit(d => assignMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Select Paddock</label>
              <select className="input" {...assignForm.register('paddock_id', { required: true })}>
                <option value="">Choose paddock…</option>
                {paddocks?.map(p => <option key={p.id} value={p.id}>{p.name} ({p.land_area} ha)</option>)}
              </select>
            </div>
            <div>
              <label className="label">Entry Date</label>
              <input type="date" className="input" {...assignForm.register('entry_date', { required: true })} />
            </div>
            <div>
              <label className="label">Head Count at Entry</label>
              <input type="number" className="input" {...assignForm.register('entry_head_count', { required: true })} />
            </div>
            <button type="submit" disabled={assignMutation.isPending} className="btn-primary w-full mt-4">
              {assignMutation.isPending ? 'Assigning…' : 'Confirm Assignment'}
            </button>
          </form>
        </Modal>

        <Modal open={exitModal} onClose={() => setExitModal(false)} title="Exit Paddock">
          <form onSubmit={exitForm.handleSubmit(d => exitMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Exit Date</label>
              <input type="date" className="input" {...exitForm.register('exit_date', { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Head Count at Exit</label>
                <input type="number" className="input" {...exitForm.register('exit_head_count', { required: true })} />
              </div>
              <div>
                <label className="label">Reason</label>
                <select className="input" {...exitForm.register('exit_reason', { required: true })}>
                  <option value="moved">Moved</option>
                  <option value="sold">Sold</option>
                  <option value="deceased">Deceased</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            {exitForm.watch('exit_reason') === 'sold' && (
              <div>
                <label className="label">Sale Price (per head)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input type="number" step="0.01" className="input pl-9" placeholder="0.00" {...exitForm.register('sale_price_per_head', { required: true })} />
                </div>
              </div>
            )}
            <button type="submit" disabled={exitMutation.isPending} className="btn-primary w-full mt-4 bg-red-600 hover:bg-red-700">
              {exitMutation.isPending ? 'Processing…' : 'Record Exit'}
            </button>
          </form>
        </Modal>

        {/* Health Event Modal */}
        <Modal open={healthModal} onClose={() => setHealthModal(false)} title="Add Health Event">
          <form onSubmit={healthForm.handleSubmit(d => healthMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Event Type</label>
                <select className="input" {...healthForm.register('event_type', { required: true })}>
                  <option value="treatment">Treatment</option>
                  <option value="vaccination">Vaccination</option>
                  <option value="mortality">Mortality</option>
                  <option value="condition_score">Condition Score</option>
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" {...healthForm.register('date', { required: true })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Product Used</label>
                <input className="input" placeholder="e.g. Dectomax" {...healthForm.register('product_used')} />
              </div>
              <div>
                <label className="label">Dose</label>
                <input className="input" placeholder="e.g. 5ml" {...healthForm.register('dose')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">WHP (days)</label>
                <input type="number" className="input" placeholder="28" {...healthForm.register('withholding_period_days')} />
              </div>
              <div>
                <label className="label">WHP Expiry</label>
                <input type="date" className="input" {...healthForm.register('whp_expiry_date')} />
              </div>
            </div>
            <div>
              <label className="label">Head Count Affected</label>
              <input type="number" className="input" {...healthForm.register('head_count_affected', { required: true })} />
            </div>
            <div>
              <label className="label">Treatment Cost</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input type="number" step="0.01" className="input pl-9" placeholder="0.00" {...healthForm.register('cost_amount')} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input h-20" {...healthForm.register('notes')} />
            </div>
            <button type="submit" disabled={healthMutation.isPending} className="btn-primary w-full">
              {healthMutation.isPending ? 'Saving…' : 'Save Health Event'}
            </button>
          </form>
        </Modal>

        {/* Weigh Event Modal */}
        <Modal open={weighModal} onClose={() => setWeighModal(false)} title="Add Weigh Event">
          <form onSubmit={weighForm.handleSubmit(d => weighMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" {...weighForm.register('date', { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Head Count Weighed</label>
                <input type="number" className="input" {...weighForm.register('head_count_weighed', { required: true })} />
              </div>
              <div>
                <label className="label">Average Weight (kg)</label>
                <input type="number" step="0.1" className="input" placeholder="450.5" {...weighForm.register('average_weight_kg', { required: true })} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input h-20" {...weighForm.register('notes')} />
            </div>
            <button type="submit" disabled={weighMutation.isPending} className="btn-primary w-full">
              {weighMutation.isPending ? 'Saving…' : 'Save Weigh Event'}
            </button>
          </form>
        </Modal>

      </div>
    </AppLayout>
  );
}
