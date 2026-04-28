'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFarm } from '@/lib/farm-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Beef, ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import type { Species, Breed, AnimalClass } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

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

export default function NewMobPage() {
  const router = useRouter();
  const { activeFarmId } = useFarm();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<MobForm>({
    defaultValues: { purchase_date: new Date().toISOString().split('T')[0] }
  });

  const selectedSpeciesId = watch('species_id');

  const { data: species } = useQuery<Species[]>({
    queryKey: ['species'],
    queryFn: () => api.get('/livestock/species').then(r => r.data),
  });

  const { data: breeds } = useQuery<Breed[]>({
    queryKey: ['breeds', selectedSpeciesId],
    queryFn: () => api.get('/livestock/breeds', { params: { species_id: selectedSpeciesId } }).then(r => r.data),
    enabled: !!selectedSpeciesId,
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
      router.push(`/livestock/${res.data.id}`);
    },
  });

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <Link href="/livestock" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to List
        </Link>

        <PageHeader title="Add New Mob" subtitle="Record a new group of animals on your farm" />

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="card space-y-6">
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
                  {breeds?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Animal Class</label>
                <select className="input" {...register('animal_class_id')} disabled={!selectedSpeciesId}>
                  <option value="">Select class…</option>
                  {animalClasses?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Head Count *</label>
                <input className="input" type="number" min="1" placeholder="50" {...register('head_count', { required: true })} />
                {errors.head_count && <p className="text-xs text-red-500 mt-1">Required</p>}
              </div>
            </div>

            <hr className="border-gray-100 my-2" />

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

          <div className="flex gap-4 pt-4 border-t border-gray-50">
            <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {mutation.isPending ? 'Saving…' : <><Save className="w-4 h-4" /> Save Mob</>}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
