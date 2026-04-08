'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Map, Pencil, Trash2, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Paddock, Farm } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm, useWatch } from 'react-hook-form';

// Dynamically import the map to avoid SSR issues with Leaflet
const MapPicker = dynamic(
  () => import('@/components/ui/MapPicker').then(m => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[220px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
        <span className="text-sm text-gray-400">Loading map…</span>
      </div>
    ),
  }
);

interface PaddockForm {
  name: string;
  crop_type: string;
  country: string;
  city: string;
  latitude: string;
  longitude: string;
  area_hectares: string;
  land_area: string;
  description: string;
}

export default function PaddocksPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Paddock | null>(null);

  // Fetch paddocks
  const { data: paddocks, isLoading } = useQuery<Paddock[]>({
    queryKey: ['paddocks'],
    queryFn: () => api.get('/paddocks').then(r => r.data),
  });

  // Fetch farms to get farm_id for new paddocks
  const { data: farms } = useQuery<Farm[]>({
    queryKey: ['farms'],
    queryFn: () => api.get('/farms').then(r => r.data),
  });
  const defaultFarmId = farms?.[0]?.id ?? '';

  const { register, handleSubmit, reset, setValue, control } = useForm<PaddockForm>();

  // Watch land_area and auto-fill area_hectares
  const watchedLandArea = useWatch({ control, name: 'land_area' });
  useEffect(() => {
    if (watchedLandArea) {
      setValue('area_hectares', watchedLandArea);
    }
  }, [watchedLandArea, setValue]);

  // Watch lat/lng for the map marker
  const watchedLat = useWatch({ control, name: 'latitude' });
  const watchedLng = useWatch({ control, name: 'longitude' });
  const mapLat = watchedLat ? parseFloat(watchedLat) : null;
  const mapLng = watchedLng ? parseFloat(watchedLng) : null;

  const toPayload = (d: PaddockForm, farmId: string) => ({
    farm_id: farmId,
    name: d.name,
    crop_type: d.crop_type || null,
    country: d.country || null,
    city: d.city || null,
    latitude: d.latitude ? parseFloat(d.latitude) : null,
    longitude: d.longitude ? parseFloat(d.longitude) : null,
    area_hectares: d.area_hectares ? parseFloat(d.area_hectares) : null,
    land_area: d.land_area ? parseFloat(d.land_area) : null,
    description: d.description || null,
  });

  const createMutation = useMutation({
    mutationFn: (d: PaddockForm) => api.post('/paddocks', toPayload(d, defaultFarmId)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paddocks'] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: (d: PaddockForm) =>
      api.patch(`/paddocks/${editItem!.id}`, toPayload(d, editItem!.farm_id)),
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
    setValue('crop_type', p.crop_type ?? '');
    setValue('country', p.country ?? '');
    setValue('city', p.city ?? '');
    setValue('latitude', p.latitude?.toString() ?? '');
    setValue('longitude', p.longitude?.toString() ?? '');
    setValue('area_hectares', p.area_hectares?.toString() ?? '');
    setValue('land_area', p.land_area?.toString() ?? '');
    setValue('description', p.description ?? '');
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditItem(null); reset(); };

  const onSubmit = (d: PaddockForm) => {
    editItem ? updateMutation.mutate(d) : createMutation.mutate(d);
  };

  const handleMapSelect = (lat: number, lng: number) => {
    setValue('latitude', lat.toString());
    setValue('longitude', lng.toString());
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

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
                  {p.crop_type && (
                    <span className="inline-block text-xs bg-farm-100 text-farm-700 px-2 py-0.5 rounded-full font-medium">
                      {p.crop_type}
                    </span>
                  )}
                  {(p.city || p.country) && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {[p.city, p.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {p.land_area && (
                    <p className="text-sm text-gray-500">Land area: {p.land_area} ha</p>
                  )}
                  {p.area_hectares && (
                    <p className="text-sm text-gray-500">Area: {p.area_hectares} ha</p>
                  )}
                  {p.latitude != null && p.longitude != null && (
                    <p className="text-xs text-gray-400">
                      {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                    </p>
                  )}
                  {p.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">{p.description}</p>
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
          className="max-w-xl"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div>
              <label className="label">Paddock Name *</label>
              <input
                className="input"
                placeholder="e.g. North Block"
                {...register('name', { required: true })}
              />
            </div>

            {/* Crop type */}
            <div>
              <label className="label">Crop Type</label>
              <input
                className="input"
                placeholder="e.g. Wheat, Canola, Barley"
                {...register('crop_type')}
              />
            </div>

            {/* Country / City */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Country</label>
                <input className="input" placeholder="e.g. Australia" {...register('country')} />
              </div>
              <div>
                <label className="label">City</label>
                <input className="input" placeholder="e.g. Perth" {...register('city')} />
              </div>
            </div>

            {/* Map picker */}
            <div>
              <label className="label">
                Location — click the map to pin coordinates
              </label>
              <MapPicker lat={mapLat} lng={mapLng} onSelect={handleMapSelect} />
            </div>

            {/* Lat / Lng (editable — also updated by map click) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Latitude</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  placeholder="e.g. -31.9505"
                  {...register('latitude')}
                />
              </div>
              <div>
                <label className="label">Longitude</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  placeholder="e.g. 115.8605"
                  {...register('longitude')}
                />
              </div>
            </div>

            {/* Land Area → auto-fills Area (hectares) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Land Area (ha)</label>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 100.0"
                  {...register('land_area')}
                />
              </div>
              <div>
                <label className="label">Area (hectares)</label>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  placeholder="Auto-filled from Land Area"
                  {...register('area_hectares')}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                rows={3}
                placeholder="e.g. North-facing block with sandy loam soil…"
                {...register('description')}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="btn-primary flex-1">
                {isPending ? 'Saving…' : editItem ? 'Save Changes' : 'Create Paddock'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
