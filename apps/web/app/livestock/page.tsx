'use client';

import { useState, useEffect } from 'react';
import { useFarm } from '@/lib/farm-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Beef, Filter, ArrowRight, Search, Save, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import type { Mob, Species, Breed, AnimalClass } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import { isAdmin, getRole } from '@/lib/role';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';

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

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<MobForm>({
    defaultValues: { purchase_date: new Date().toISOString().split('T')[0] }
  });

  const selectedSpeciesId = watch('species_id');

  useEffect(() => { setRole(getRole()); }, []);

  const { data: mobs, isLoading: mobsLoading } = useQuery<Mob[]>({
    queryKey: ['mobs', activeFarmId, statusFilter],
    queryFn: () => api.get('/livestock/mobs', { params: { farm_id: activeFarmId, status: statusFilter } }).then(r => r.data),
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
      setModalOpen(false);
      reset();
      router.push(`/livestock/${res.data.id}`);
    },
  });

  const canAdd = isAdmin(role as any);

  // Summaries
  const totalHead = mobs?.reduce((acc, m) => acc + m.head_count, 0) || 0;
  const activeMobsCount = mobs?.length || 0;
  // In a real app, we'd check if they have a current assignment. 
  // For now we'll just show the active ones.
  const mobsInPaddocks = mobs?.filter(m => m.status === 'active').length || 0; 

  const getSpeciesName = (id: string) => species?.find(s => s.id === id)?.name || '—';
  const getBreedName = (id: string | null) => id ? breeds?.find(b => b.id === id)?.name || '—' : '—';
  const getClassName = (id: string | null) => id ? animalClasses?.find(c => c.id === id)?.name || '—' : '—';

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Livestock"
          subtitle="Manage your mobs and tracking"
          action={canAdd && (
            <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Mob
            </button>
          )}
        />

        {/* Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard title="Total Head on Farm" value={totalHead} icon={Beef} iconColor="text-emerald-600" />
          <StatCard title="Active Mobs" value={activeMobsCount} icon={Filter} iconColor="text-blue-500" />
          <StatCard title="Mobs in Paddocks" value={mobsInPaddocks} icon={ArrowRight} iconColor="text-orange-500" />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center justify-between">
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
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Mob Name', 'Species', 'Breed', 'Class', 'Head Count', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
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
                      <td className="px-4 py-3 text-gray-600">{getSpeciesName(mob.species_id)}</td>
                      <td className="px-4 py-3 text-gray-600">{getBreedName(mob.breed_id)}</td>
                      <td className="px-4 py-3 text-gray-600">{getClassName(mob.animal_class_id)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{mob.head_count}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          mob.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                          mob.status === 'sold' ? 'bg-blue-50 text-blue-700' :
                          'bg-gray-50 text-gray-700'
                        }`}>
                          {mob.status.charAt(0).toUpperCase() + mob.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/livestock/${mob.id}`} className="text-farm-600 hover:text-farm-800 text-xs font-medium">
                          View Details
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
