'use client';

import { useState, useEffect } from 'react';
import { useFarm } from '@/lib/farm-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Beef, Filter, ArrowRight, Search, Save, AlertCircle, MapPin, Map as MapIcon, MoveRight } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import type { Mob, Species, Breed, AnimalClass, Paddock } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import { isAdmin, getRole } from '@/lib/role';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const FarmPaddockMap = dynamic(
  () => import('@/components/ui/GoogleMapPicker').then(m => m.FarmPaddockMap),
  { ssr: false, loading: () => <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center"><span className="text-sm text-gray-400">Loading map…</span></div> }
);

interface MobForm {
  name: string;
  species_id: string;
  breed_id: string;
  animal_class_id: string;
  head_count: string;
  source_farm: string;
  purchase_date: string;
  purchase_price_per_head: string;
}

export default function LivestockPage() {
  const { activeFarmId } = useFarm();
  const router = useRouter();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [role, setRole] = useState<string>('staff');
  const [modalOpen, setModalOpen] = useState(false);
  const [moveModal, setMoveModal] = useState<{ open: boolean; mob: any | null }>({ open: false, mob: null });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<MobForm>({
    defaultValues: { purchase_date: new Date().toISOString().split('T')[0] }
  });

  const selectedSpeciesId = watch('species_id');

  useEffect(() => { setRole(getRole()); }, []);

  const { data: mobs, isLoading: mobsLoading } = useQuery<any[]>({
    queryKey: ['mobs', activeFarmId, statusFilter],
    queryFn: () => api.get('/livestock/mobs', { params: { farm_id: activeFarmId, status: statusFilter } }).then(r => r.data),
    enabled: !!activeFarmId,
  });

  const { data: paddocks } = useQuery<Paddock[]>({
    queryKey: ['paddocks', activeFarmId],
    queryFn: () => api.get('/paddocks', { params: { farm_id: activeFarmId } }).then(r => r.data),
    enabled: !!activeFarmId,
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
    queryKey: ['animal-classes', selectedSpeciesId],
    queryFn: () => api.get('/livestock/animal-classes', { params: { species_id: selectedSpeciesId } }).then(r => r.data),
    enabled: !!selectedSpeciesId,
  });

  const { data: mobLocations } = useQuery<any[]>({
    queryKey: ['mob-locations', activeFarmId],
    queryFn: () => api.get('/livestock/mob-locations', { params: { farm_id: activeFarmId } }).then(r => r.data),
    enabled: !!activeFarmId,
  });

  const mutation = useMutation({
    mutationFn: (data: MobForm) => api.post('/livestock/mobs', {
      ...data,
      farm_id: activeFarmId,
      head_count: parseInt(data.head_count),
      purchase_price_per_head: data.purchase_price_per_head ? parseFloat(data.purchase_price_per_head) : null,
      breed_id: data.breed_id || null,
      animal_class_id: data.animal_class_id || null,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['mobs'] });
      qc.invalidateQueries({ queryKey: ['mob-locations'] });
      setModalOpen(false);
      reset();
      router.push(`/livestock/${res.data.id}`);
    },
  });

  const canAdd = isAdmin(role as any);

  // Summaries
  const totalHead = mobs?.reduce((acc, m) => acc + m.head_count, 0) || 0;
  const activeMobsCount = mobs?.filter(m => m.status === 'active').length || 0;
  const mobsInPaddocks = mobs?.filter(m => m.status === 'active' && m.current_paddock_id).length || 0;
  const unassignedMobs = activeMobsCount - mobsInPaddocks;

  const getSpeciesName = (id: string) => species?.find(s => s.id === id)?.name || '—';
  const getBreedName = (id: string | null) => id ? breeds?.find(b => b.id === id)?.name || '—' : '—';
  const getClassName = (id: string | null) => id ? animalClasses?.find(c => c.id === id)?.name || '—' : '—';

  // Move Modal Logic
  const moveForm = useForm({ defaultValues: { destination_paddock_id: '', move_date: new Date().toISOString().split('T')[0], head_count: 0, notes: '' } });

  const moveMutation = useMutation({
    mutationFn: (data: any) => api.post(`/livestock/mobs/${moveModal.mob.id}/move`, {
      ...data,
      head_count: parseInt(data.head_count)
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mobs'] });
      qc.invalidateQueries({ queryKey: ['mob-locations'] });
      setMoveModal({ open: false, mob: null });
      moveForm.reset();
    }
  });

  const openMoveModal = (mob: any) => {
    setMoveModal({ open: true, mob });
    moveForm.setValue('head_count', mob.paddock_head_count || mob.head_count);
  };

  const handlePaddockClick = (paddockId: string) => {
    // If a mob is in this paddock, we could open their details or the move modal.
    // For now, let's just find the mob and open move modal if it exists.
    const mobInPaddock = mobs?.find(m => m.current_paddock_id === paddockId);
    if (mobInPaddock && canAdd) {
      openMoveModal(mobInPaddock);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader
          title="Livestock"
          subtitle="Map and track your mobs across the farm"
          action={canAdd && (
            <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Mob
            </button>
          )}
        />

        {/* Top Map Section */}
        <div className="card p-0 overflow-hidden border-emerald-100 bg-emerald-50/10">
          <div className="flex items-center justify-between p-4 border-b border-emerald-100">
            <h2 className="font-semibold text-emerald-900 flex items-center gap-2">
              <MapIcon className="w-5 h-5 text-emerald-600" />
              Livestock Map
            </h2>
            <p className="text-xs text-emerald-600 font-medium">Click on a cattle badge to move them</p>
          </div>
          <div className="h-[400px]">
            {paddocks && paddocks.length > 0 ? (
              <FarmPaddockMap 
                paddocks={paddocks as any} 
                mobLocations={mobLocations} 
                onPaddockClick={handlePaddockClick} 
                height={400} 
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-400 bg-gray-50">
                No paddock boundaries found. Add paddocks on the Farms page first.
              </div>
            )}
          </div>
        </div>

        {/* Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="Total Head" value={totalHead} icon={Beef} iconColor="text-emerald-600" />
          <StatCard title="Active Mobs" value={activeMobsCount} icon={Filter} iconColor="text-blue-500" />
          <StatCard title="In Paddocks" value={mobsInPaddocks} icon={MapPin} iconColor="text-emerald-500" />
          <StatCard title="Unassigned" value={unassignedMobs} icon={AlertCircle} iconColor="text-orange-500" />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-10" placeholder="Search mobs..." />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm text-gray-500 whitespace-nowrap">Status:</span>
            <select 
              className="input py-1.5" 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="deceased">Deceased</option>
              <option value="transferred">Transferred</option>
              <option value="">All</option>
            </select>
          </div>
        </div>

        {/* Mob List */}
        {mobsLoading ? <Spinner /> : 
         mobs && mobs.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mob Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Species & Breed</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Head Count</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Paddock</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {mobs.map((mob) => (
                    <tr key={mob.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <Link href={`/livestock/${mob.id}`} className="font-medium text-farm-700 hover:underline">
                          {mob.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {getSpeciesName(mob.species_id)} 
                        {mob.breed_id && <span className="text-gray-400"> ({getBreedName(mob.breed_id)})</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{mob.head_count}</td>
                      <td className="px-4 py-3">
                        {mob.current_paddock_name ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-medium text-gray-900">{mob.current_paddock_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          mob.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                          mob.status === 'sold' ? 'bg-blue-50 text-blue-700' :
                          'bg-gray-50 text-gray-700'
                        }`}>
                          {mob.status.charAt(0).toUpperCase() + mob.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-3">
                        {canAdd && mob.current_paddock_id && mob.status === 'active' && (
                          <button onClick={() => openMoveModal(mob)} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium inline-flex items-center gap-1">
                            <MoveRight className="w-3.5 h-3.5" /> Move
                          </button>
                        )}
                        <Link href={`/livestock/${mob.id}`} className="text-farm-600 hover:text-farm-800 text-xs font-medium">
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
         ) : (
          <EmptyState 
            icon={Beef} 
            title="No mobs found" 
            description="You haven't added any livestock mobs to this farm yet." 
            action={canAdd && <button onClick={() => setModalOpen(true)} className="btn-primary">Add your first mob</button>} 
          />
         )
        }

        {/* Move Livestock Modal */}
        <Modal open={moveModal.open} onClose={() => { setMoveModal({ open: false, mob: null }); moveForm.reset(); }} title="Move Livestock">
          {moveModal.mob && (
            <form onSubmit={moveForm.handleSubmit(d => moveMutation.mutate(d))} className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Moving</p>
                  <p className="font-bold text-gray-900">{moveModal.mob.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">From</p>
                  <p className="font-semibold text-emerald-700">{moveModal.mob.current_paddock_name}</p>
                </div>
              </div>

              <div>
                <label className="label">Destination Paddock</label>
                <select className="input" {...moveForm.register('destination_paddock_id', { required: true })}>
                  <option value="">Select destination…</option>
                  {paddocks?.filter(p => p.id !== moveModal.mob.current_paddock_id).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.land_area} ha)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Move Date</label>
                  <input type="date" className="input" {...moveForm.register('move_date', { required: true })} />
                </div>
                <div>
                  <label className="label">Head to Move</label>
                  <input 
                    type="number" 
                    className="input" 
                    max={moveModal.mob.paddock_head_count || moveModal.mob.head_count} 
                    {...moveForm.register('head_count', { required: true })} 
                  />
                  {moveForm.watch('head_count') < (moveModal.mob.paddock_head_count || moveModal.mob.head_count) && (
                    <p className="text-[10px] text-orange-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Gate split: {(moveModal.mob.paddock_head_count || moveModal.mob.head_count) - moveForm.watch('head_count')} will remain
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="label">Notes (Optional)</label>
                <input className="input" placeholder="e.g. Moved to better pasture" {...moveForm.register('notes')} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setMoveModal({ open: false, mob: null }); moveForm.reset(); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={moveMutation.isPending} className="btn-primary flex-1">
                  {moveMutation.isPending ? 'Moving…' : 'Confirm Move'}
                </button>
              </div>
            </form>
          )}
        </Modal>

        {/* Add Mob Modal */}
        <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="Add New Mob" className="max-w-2xl">
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5">
            {mutation.isError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> Failed to save. Please check your data.
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="label">Mob Name *</label>
                <input className="input" placeholder="e.g. 2024 Heifers - North" {...register('name', { required: true })} />
                {errors.name && <p className="text-xs text-red-500 mt-1">Name is required</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Species *</label>
                  <select className="input" {...register('species_id', { required: true })}>
                    <option value="">Select species…</option>
                    {species?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {errors.species_id && <p className="text-xs text-red-500 mt-1">Species is required</p>}
                </div>

                <div>
                  <label className="label">Breed</label>
                  <select className="input" {...register('breed_id')} disabled={!selectedSpeciesId}>
                    <option value="">Select breed…</option>
                    {breeds?.filter(b => b.species_id === selectedSpeciesId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Animal Class</label>
                  <select className="input" {...register('animal_class_id')} disabled={!selectedSpeciesId}>
                    <option value="">Select class…</option>
                    {animalClasses?.filter(c => c.species_id === selectedSpeciesId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Head Count *</label>
                  <input className="input" type="number" min="1" placeholder="50" {...register('head_count', { required: true })} />
                  {errors.head_count && <p className="text-xs text-red-500 mt-1">Required</p>}
                </div>
              </div>

              <hr className="border-gray-100 my-1" />

              <div>
                <label className="label">Source Farm / Vendor</label>
                <input className="input" placeholder="e.g. Hamilton Saleyards" {...register('source_farm')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Purchase Date</label>
                  <input className="input" type="date" {...register('purchase_date')} />
                </div>
                <div>
                  <label className="label">Price per Head ($)</label>
                  <input className="input" type="number" step="0.01" placeholder="1250.00" {...register('purchase_price_per_head')} />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => { setModalOpen(false); reset(); }} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {mutation.isPending ? 'Saving…' : <><Save className="w-4 h-4" /> Save Mob</>}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
