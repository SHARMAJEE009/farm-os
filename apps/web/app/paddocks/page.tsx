'use client';

import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Map, Pencil, Trash2, MapPin, Upload, X, FileText, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Paddock, Farm } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm, useWatch } from 'react-hook-form';
import type { LatLngTuple } from '@/components/ui/MapPicker';

// Dynamically import the map to avoid SSR issues with Leaflet
const MapPicker = dynamic(
  () => import('@/components/ui/MapPicker').then(m => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
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
  land_area: string;
  sowing_date: string;
  description: string;
}

// ── KML parser ────────────────────────────────────────────────
interface KmlResult {
  coords: LatLngTuple[];          // [lng, lat] pairs
  centroid: { lat: number; lng: number };
  name: string | null;
  description: string | null;
  area_ha: number | null;
}

/** Haversine area of a polygon in hectares */
function polygonAreaHa(coords: LatLngTuple[]): number {
  const R = 6371000; // earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[(i + 1) % n];
    area += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((area * R * R) / 2) / 10_000;
}

function parseKml(text: string): KmlResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  // Check parse error
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid KML file — could not parse XML.');
  }

  // Grab first Placemark
  const placemark = doc.querySelector('Placemark');

  const kmlName = placemark?.querySelector('name')?.textContent?.trim() ?? null;
  const kmlDesc = placemark?.querySelector('description')?.textContent?.trim() ?? null;

  // Find coordinates element — works for Polygon, LineString, Point
  const coordsEl =
    doc.querySelector('Polygon outerBoundaryIs coordinates') ??
    doc.querySelector('Polygon coordinates') ??
    doc.querySelector('LinearRing coordinates') ??
    doc.querySelector('LineString coordinates') ??
    doc.querySelector('coordinates');

  if (!coordsEl?.textContent) {
    throw new Error('No coordinates found in KML file.');
  }

  // KML coordinate tuples: "lng,lat[,alt]" separated by whitespace
  const raw = coordsEl.textContent.trim();
  const tuples = raw.split(/\s+/).filter(Boolean);

  const coords: LatLngTuple[] = tuples.map(t => {
    const parts = t.split(',').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      throw new Error(`Invalid coordinate tuple: "${t}"`);
    }
    return [parts[0], parts[1]]; // [lng, lat]
  });

  if (coords.length < 1) {
    throw new Error('KML file contains no valid coordinates.');
  }

  // Centroid of bounding box
  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const centroid = {
    lat: parseFloat((((Math.min(...lats) + Math.max(...lats)) / 2)).toFixed(6)),
    lng: parseFloat((((Math.min(...lngs) + Math.max(...lngs)) / 2)).toFixed(6)),
  };

  const area_ha = coords.length >= 3 ? parseFloat(polygonAreaHa(coords).toFixed(2)) : null;

  return { coords, centroid, name: kmlName, description: kmlDesc, area_ha };
}

export default function PaddocksPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Paddock | null>(null);

  // KML state
  const [kmlBoundary, setKmlBoundary] = useState<LatLngTuple[] | null>(null);
  const [kmlFileName, setKmlFileName] = useState<string | null>(null);
  const [kmlError, setKmlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    land_area: d.land_area ? parseFloat(d.land_area) : null,
    sowing_date: d.sowing_date || null,
    description: d.description || null,
    boundary_geojson: kmlBoundary
      ? { type: 'Polygon', coordinates: [kmlBoundary] }
      : null,
  });

  const createMutation = useMutation({
    mutationFn: (d: PaddockForm) => api.post('/paddocks', toPayload(d, defaultFarmId)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paddocks'] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: (d: PaddockForm) => {
      const { farm_id, ...updatePayload } = toPayload(d, editItem!.farm_id);
      return api.patch(`/paddocks/${editItem!.id}`, updatePayload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paddocks'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/paddocks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paddocks'] }),
  });

  const openCreate = () => {
    reset();
    setEditItem(null);
    setKmlBoundary(null);
    setKmlFileName(null);
    setKmlError(null);
    setModalOpen(true);
  };

  const openEdit = (p: Paddock) => {
    setEditItem(p);
    setValue('name', p.name);
    setValue('crop_type', p.crop_type ?? '');
    setValue('country', p.country ?? '');
    setValue('city', p.city ?? '');
    setValue('latitude', p.latitude?.toString() ?? '');
    setValue('longitude', p.longitude?.toString() ?? '');
    setValue('land_area', p.land_area?.toString() ?? '');
    setValue('sowing_date', p.sowing_date?.slice(0, 10) ?? '');
    setValue('description', p.description ?? '');
    // Restore boundary if stored
    const boundary = (p.boundary_geojson as any)?.coordinates?.[0] ?? null;
    setKmlBoundary(boundary);
    setKmlFileName(boundary ? 'existing boundary' : null);
    setKmlError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditItem(null);
    reset();
    setKmlBoundary(null);
    setKmlFileName(null);
    setKmlError(null);
  };

  const onSubmit = (d: PaddockForm) => {
    editItem ? updateMutation.mutate(d) : createMutation.mutate(d);
  };

  const handleMapSelect = (lat: number, lng: number) => {
    setValue('latitude', lat.toString());
    setValue('longitude', lng.toString());
  };

  // ── KML file handler ─────────────────────────────────────────
  const handleKmlFile = useCallback((file: File) => {
    setKmlError(null);
    if (!file.name.match(/\.(kml|kmz)$/i)) {
      setKmlError('Please upload a .kml file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = parseKml(e.target!.result as string);
        setKmlBoundary(result.coords);
        setKmlFileName(file.name);

        // Auto-fill centroid as lat/lng
        setValue('latitude', result.centroid.lat.toString());
        setValue('longitude', result.centroid.lng.toString());

        // Auto-fill area if not already set
        if (result.area_ha && result.area_ha > 0) {
          setValue('land_area', result.area_ha.toString());
        }
        // Auto-fill name if form is empty
        if (result.name) {
          const currentName = (document.querySelector('input[name="name"]') as HTMLInputElement)?.value;
          if (!currentName) setValue('name', result.name);
        }
        // Auto-fill description
        if (result.description) {
          setValue('description', result.description);
        }
      } catch (err: any) {
        setKmlError(err.message ?? 'Failed to parse KML file.');
        setKmlBoundary(null);
        setKmlFileName(null);
      }
    };
    reader.readAsText(file);
  }, [setValue]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleKmlFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleKmlFile(file);
  };

  const clearKml = () => {
    setKmlBoundary(null);
    setKmlFileName(null);
    setKmlError(null);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
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
                  {p.sowing_date && (
                    <p className="text-sm text-gray-500">
                      Sowing: {new Date(p.sowing_date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                  {p.latitude != null && p.longitude != null && (
                    <p className="text-xs text-gray-400">
                      {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                    </p>
                  )}
                  {p.boundary_geojson && (
                    <p className="text-xs text-farm-600 flex items-center gap-1">
                      <Map className="w-3 h-3" />
                      Boundary mapped
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

            {/* ── KML Upload ──────────────────────────────────────── */}
            <div>
              <label className="label">Boundary — Upload KML File</label>

              {!kmlFileName ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl px-4 py-5 cursor-pointer hover:border-farm-400 hover:bg-farm-50/40 transition-colors"
                >
                  <div className="w-10 h-10 bg-farm-50 rounded-xl flex items-center justify-center">
                    <Upload className="w-5 h-5 text-farm-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Drop a .kml file here</p>
                    <p className="text-xs text-gray-400 mt-0.5">or click to browse · Area, coords & name auto-filled</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".kml,.kmz"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-farm-50 border border-farm-200 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 bg-farm-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-farm-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-farm-800 truncate">{kmlFileName}</p>
                    <p className="text-xs text-farm-600">Boundary loaded · shown on map below</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearKml}
                    className="p-1 text-farm-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {kmlError && (
                <div className="flex items-center gap-2 mt-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {kmlError}
                </div>
              )}
            </div>

            {/* Map picker */}
            <div>
              <label className="label">
                Location — {kmlBoundary ? 'KML boundary shown · click to move pin' : 'click the map to pin coordinates'}
              </label>
              <MapPicker
                lat={mapLat}
                lng={mapLng}
                onSelect={handleMapSelect}
                kmlBoundary={kmlBoundary}
              />
            </div>

            {/* Lat / Lng */}
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
                <label className="label">Sowing Date</label>
                <input
                  className="input"
                  type="date"
                  {...register('sowing_date')}
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
