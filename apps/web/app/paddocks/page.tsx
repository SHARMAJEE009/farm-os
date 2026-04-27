'use client';

import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Map, Pencil, Trash2, Upload, X, FileText, AlertCircle,
  ChevronDown, Layers, Building2, FlaskConical,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFarm } from '@/lib/farm-context';
import type { Paddock, Farm } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm, useWatch } from 'react-hook-form';
import type { LatLngTuple, KmlPlacemark } from '@/components/ui/GoogleMapPicker';
import { parseKmlMulti } from '@/components/ui/GoogleMapPicker';

const GoogleMapPicker = dynamic(
  () => import('@/components/ui/GoogleMapPicker').then(m => m.GoogleMapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
        <span className="text-sm text-gray-400">Loading map…</span>
      </div>
    ),
  }
);

// ── Crop catalogue ──────────────────────────────────────────────────────────
interface Crop { label: string; emoji: string; color: string; bg: string; }

const CROPS: Crop[] = [
  { label: 'Wheat',     emoji: '🌾', color: 'bg-yellow-100 text-yellow-800', bg: 'bg-yellow-50'  },
  { label: 'Barley',    emoji: '🌾', color: 'bg-amber-100  text-amber-800',  bg: 'bg-amber-50'   },
  { label: 'Canola',    emoji: '🌼', color: 'bg-lime-100   text-lime-800',   bg: 'bg-lime-50'    },
  { label: 'Corn',      emoji: '🌽', color: 'bg-yellow-100 text-yellow-800', bg: 'bg-yellow-50'  },
  { label: 'Soybeans',  emoji: '🫘', color: 'bg-green-100  text-green-800',  bg: 'bg-green-50'   },
  { label: 'Sorghum',   emoji: '🌿', color: 'bg-red-100    text-red-800',    bg: 'bg-red-50'     },
  { label: 'Cotton',    emoji: '🤍', color: 'bg-sky-100    text-sky-800',    bg: 'bg-sky-50'     },
  { label: 'Sunflower', emoji: '🌻', color: 'bg-yellow-100 text-yellow-800', bg: 'bg-yellow-50'  },
  { label: 'Oats',      emoji: '🌾', color: 'bg-orange-100 text-orange-800', bg: 'bg-orange-50'  },
  { label: 'Rice',      emoji: '🍚', color: 'bg-emerald-100 text-emerald-800', bg: 'bg-emerald-50' },
  { label: 'Chickpeas', emoji: '🫘', color: 'bg-amber-100  text-amber-800',  bg: 'bg-amber-50'   },
  { label: 'Lentils',   emoji: '🫘', color: 'bg-orange-100 text-orange-800', bg: 'bg-orange-50'  },
  { label: 'Potatoes',  emoji: '🥔', color: 'bg-stone-100  text-stone-800',  bg: 'bg-stone-50'   },
  { label: 'Lucerne',   emoji: '🌿', color: 'bg-green-100  text-green-800',  bg: 'bg-green-50'   },
  { label: 'Other',     emoji: '🌱', color: 'bg-gray-100   text-gray-700',   bg: 'bg-gray-50'    },
];
const CROP_MAP = Object.fromEntries(CROPS.map(c => [c.label, c]));



// ── Form ────────────────────────────────────────────────────────────────────
interface PaddockForm {
  name: string;
  crop_type: string;
  latitude: string;
  longitude: string;
  land_area: string;
  sowing_date: string;
}

// ── Bulk import modal ───────────────────────────────────────────────────────
interface BulkImportModalProps {
  open: boolean;
  placemarks: KmlPlacemark[];
  farmId: string;
  onClose: () => void;
  onDone: () => void;
}

function BulkImportModal({ open, placemarks, farmId, onClose, onDone }: BulkImportModalProps) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(() => new Set(placemarks.map((_, i) => i)));
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const toggleAll = () => {
    if (selected.size === placemarks.length) setSelected(new Set());
    else setSelected(new Set(placemarks.map((_, i) => i)));
  };
  const toggleOne = (i: number) => {
    const s = new Set(selected);
    if (s.has(i)) s.delete(i); else s.add(i);
    setSelected(s);
  };

  const handleImport = async () => {
    setImporting(true);
    const toImport = placemarks.filter((_, i) => selected.has(i));
    await Promise.allSettled(
      toImport.map(pm =>
        api.post('/paddocks', {
          farm_id: farmId,
          name: pm.name ?? 'Unnamed Paddock',
          latitude: pm.centroid.lat,
          longitude: pm.centroid.lng,
          land_area: pm.area_ha ?? null,
          boundary_geojson: pm.coords.length >= 3
            ? { type: 'Polygon', coordinates: [pm.coords] }
            : null,
        }),
      ),
    );
    await qc.invalidateQueries({ queryKey: ['paddocks'] });
    setImporting(false);
    setDone(true);
    setTimeout(() => { setDone(false); onDone(); }, 1000);
  };

  return (
    <Modal open={open} onClose={onClose} title="Import Paddocks from KML" className="max-w-lg">
      <p className="text-sm text-gray-500 mb-4">
        Found <strong>{placemarks.length}</strong> placemark{placemarks.length !== 1 ? 's' : ''} in the KML file.
        Select which ones to import as paddocks.
      </p>

      <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
          <input type="checkbox" checked={selected.size === placemarks.length} onChange={toggleAll} className="w-4 h-4 accent-farm-600" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select all</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {placemarks.map((pm, i) => (
            <label key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
              <input type="checkbox" checked={selected.has(i)} onChange={() => toggleOne(i)} className="w-4 h-4 mt-0.5 accent-farm-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{pm.name ?? `Placemark ${i + 1}`}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  {pm.area_ha && <span>{pm.area_ha} ha</span>}
                  <span>{pm.centroid.lat.toFixed(5)}, {pm.centroid.lng.toFixed(5)}</span>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button onClick={handleImport} disabled={selected.size === 0 || importing || done} className="btn-primary flex-1">
          {done ? '✓ Imported!' : importing ? 'Importing…' : `Import ${selected.size} Paddock${selected.size !== 1 ? 's' : ''}`}
        </button>
      </div>
    </Modal>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function PaddocksPage() {
  const qc = useQueryClient();
  const { activeFarmId } = useFarm();

  const [modalOpen, setModalOpen]     = useState(false);
  const [editItem, setEditItem]       = useState<Paddock | null>(null);
  const [kmlBoundary, setKmlBoundary] = useState<LatLngTuple[] | null>(null);
  const [kmlFileName, setKmlFileName] = useState<string | null>(null);
  const [kmlError, setKmlError]       = useState<string | null>(null);

  const bulkFileInputRef  = useRef<HTMLInputElement>(null);

  const { data: paddocks, isLoading } = useQuery<Paddock[]>({
    queryKey: ['paddocks', activeFarmId],
    queryFn: () => api.get('/paddocks', { params: activeFarmId ? { farm_id: activeFarmId } : {} }).then(r => r.data),
  });

  const { data: farms } = useQuery<Farm[]>({
    queryKey: ['farms'],
    queryFn: () => api.get('/farms').then(r => r.data),
  });

  const resolvedFarmId = activeFarmId ?? farms?.[0]?.id ?? '';

  const { register, handleSubmit, reset, setValue, control } = useForm<PaddockForm>();
  const watchedLat      = useWatch({ control, name: 'latitude' });
  const watchedLng      = useWatch({ control, name: 'longitude' });
  const watchedCropType = useWatch({ control, name: 'crop_type' });

  const mapLat       = watchedLat ? parseFloat(watchedLat) : null;
  const mapLng       = watchedLng ? parseFloat(watchedLng) : null;
  const selectedCrop = CROP_MAP[watchedCropType] ?? null;

  const toPayload = (d: PaddockForm, farmId: string) => ({
    farm_id: farmId,
    name: d.name,
    crop_type: d.crop_type || null,
    latitude: d.latitude ? parseFloat(d.latitude) : null,
    longitude: d.longitude ? parseFloat(d.longitude) : null,
    land_area: d.land_area ? parseFloat(d.land_area) : null,
    sowing_date: d.sowing_date || null,
    boundary_geojson: kmlBoundary ? { type: 'Polygon', coordinates: [kmlBoundary] } : null,
  });

  const createMutation = useMutation({
    mutationFn: async (d: PaddockForm) => {
      const res = await api.post('/paddocks', toPayload(d, resolvedFarmId));
      return res;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paddocks'] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: async (d: PaddockForm) => {
      const { farm_id, ...payload } = toPayload(d, editItem!.farm_id);
      const res = await api.patch(`/paddocks/${editItem!.id}`, payload);
      return res;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paddocks'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/paddocks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paddocks'] }),
  });

  const openCreate = () => {
    reset(); setEditItem(null);
    setKmlBoundary(null); setKmlFileName(null); setKmlError(null);
    setModalOpen(true);
  };

  const openEdit = (p: Paddock) => {
    setEditItem(p);
    setValue('name', p.name);
    setValue('crop_type', p.crop_type ?? '');
    setValue('latitude', p.latitude?.toString() ?? '');
    setValue('longitude', p.longitude?.toString() ?? '');
    setValue('land_area', p.land_area?.toString() ?? '');
    setValue('sowing_date', p.sowing_date?.slice(0, 10) ?? '');
    const boundary = (p.boundary_geojson as any)?.coordinates?.[0] ?? null;
    setKmlBoundary(boundary); setKmlFileName(boundary ? 'existing boundary' : null); setKmlError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false); setEditItem(null); reset();
    setKmlBoundary(null); setKmlFileName(null); setKmlError(null);
  };

  const handleMapSelect = (lat: number, lng: number) => {
    setValue('latitude', lat.toString());
    setValue('longitude', lng.toString());
  };

  // Single-paddock KML
  const handleKmlFile = useCallback((file: File) => {
    setKmlError(null);
    if (!file.name.match(/\.(kml|kmz)$/i)) { setKmlError('Please upload a .kml file.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const results = parseKmlMulti(e.target!.result as string);
        if (results.length === 0) { setKmlError('No valid placemarks found.'); return; }
        const pm = results[0];
        setKmlBoundary(pm.coords);
        setKmlFileName(file.name);
        setValue('latitude', pm.centroid.lat.toString());
        setValue('longitude', pm.centroid.lng.toString());
        if (pm.area_ha && pm.area_ha > 0) setValue('land_area', pm.area_ha.toString());
        if (pm.name) {
          const el = document.querySelector('input[name="name"]') as HTMLInputElement;
          if (!el?.value) setValue('name', pm.name);
        }
      } catch (err: any) {
        setKmlError(err.message ?? 'Failed to parse KML.'); setKmlBoundary(null); setKmlFileName(null);
      }
    };
    reader.readAsText(file);
  }, [setValue]);



  // Bulk KML
  const handleBulkKmlFile = useCallback((file: File) => {
    if (!file.name.match(/\.(kml|kmz)$/i)) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const results = parseKmlMulti(e.target!.result as string);
        if (results.length === 0) { alert('No valid placemarks found in KML.'); return; }
        setBulkPlacemarks(results);
        setBulkOpen(true);
      } catch (err: any) {
        alert(err.message ?? 'Failed to parse KML.');
      }
    };
    reader.readAsText(file);
  }, []);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Paddocks"
          subtitle={resolvedFarmId
            ? `Paddocks for ${farms?.find(f => f.id === resolvedFarmId)?.name ?? 'selected farm'}`
            : 'Select a farm above to manage paddocks'}
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => bulkFileInputRef.current?.click()}
                className="btn-secondary flex items-center gap-2 text-sm"
                title="Import multiple paddocks from a KML file"
              >
                <Layers className="w-4 h-4" /> Import KML
              </button>
              <input
                ref={bulkFileInputRef}
                type="file"
                accept=".kml,.kmz"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleBulkKmlFile(f); e.target.value = ''; }}
              />
              <button onClick={openCreate} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Paddock
              </button>
            </div>
          }
        />

        {!resolvedFarmId && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 mb-4">
            <Building2 className="w-5 h-5 flex-shrink-0" />
            No farm selected. Go to <strong>Farms</strong> and set an active farm first.
          </div>
        )}

        {isLoading ? (
          <Spinner />
        ) : paddocks && paddocks.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paddocks.map((p) => {
              const crop = CROP_MAP[p.crop_type ?? ''];
              return (
                <div key={p.id} className="card hover:shadow-md transition-shadow overflow-hidden p-0">
                  <div className={`flex items-center gap-3 px-4 py-3 ${crop ? crop.bg : 'bg-farm-50'} border-b border-gray-100`}>
                    <span className="text-3xl leading-none">{crop ? crop.emoji : '🌱'}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${crop ? crop.color : 'bg-farm-100 text-farm-700'}`}>
                      {crop ? crop.label : (p.crop_type || 'No crop')}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{p.name}</h3>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-farm-600 hover:bg-farm-50 rounded-lg transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteMutation.mutate(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {p.land_area && <p className="text-sm text-gray-500">Land area: {p.land_area} ha</p>}
                      {p.sowing_date && (
                        <p className="text-sm text-gray-500">
                          Sowing: {(() => {
                            const [y, m, d] = p.sowing_date!.slice(0, 10).split('-');
                            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                            return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
                          })()}
                        </p>
                      )}
                      {p.latitude != null && p.longitude != null && (
                        <p className="text-xs text-gray-400">{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</p>
                      )}
                      {p.boundary_geojson && (
                        <p className="text-xs text-farm-600 flex items-center gap-1">
                          <Map className="w-3 h-3" /> Boundary mapped
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Map}
            title="No paddocks yet"
            description={resolvedFarmId
              ? 'Add your first paddock or import boundaries from a KML file.'
              : 'Select a farm to view its paddocks.'}
            action={resolvedFarmId
              ? <button onClick={openCreate} className="btn-primary">Add your first paddock</button>
              : undefined}
          />
        )}

        {/* Create / Edit paddock modal */}
        <Modal open={modalOpen} onClose={closeModal} title={editItem ? 'Edit Paddock' : 'Add Paddock'} className="max-w-xl">
          <form onSubmit={handleSubmit(d => editItem ? updateMutation.mutate(d) : createMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Paddock Name *</label>
              <input className="input" placeholder="e.g. North Block" {...register('name', { required: true })} />
            </div>



            <div>
              <label className="label">Crop Type</label>
              <div className="relative">
                <select className="input appearance-none pr-9" {...register('crop_type')} onChange={e => setValue('crop_type', e.target.value)}>
                  <option value="">Select a crop…</option>
                  {CROPS.map(c => <option key={c.label} value={c.label}>{c.emoji} {c.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              {selectedCrop && (
                <div className={`mt-2 rounded-xl flex items-center gap-3 px-4 py-3 ${selectedCrop.bg} border border-gray-100`}>
                  <span className="text-4xl leading-none">{selectedCrop.emoji}</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{selectedCrop.label}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${selectedCrop.color}`}>Selected crop</span>
                  </div>
                </div>
              )}
            </div>

            {/* KML Upload */}
            <div>
              <label className="label">Boundary — Upload KML File</label>
              {!kmlFileName ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleKmlFile(f); }}
                  onDragOver={e => e.preventDefault()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl px-4 py-5 cursor-pointer hover:border-farm-400 hover:bg-farm-50/40 transition-colors"
                >
                  <div className="w-10 h-10 bg-farm-50 rounded-xl flex items-center justify-center">
                    <Upload className="w-5 h-5 text-farm-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Drop a .kml file here</p>
                    <p className="text-xs text-gray-400 mt-0.5">or click to browse · Area, coords &amp; name auto-filled</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".kml,.kmz" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleKmlFile(f); e.target.value = ''; }} />
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
                  <button type="button" onClick={() => { setKmlBoundary(null); setKmlFileName(null); setKmlError(null); }} className="p-1 text-farm-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {kmlError && (
                <div className="flex items-center gap-2 mt-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {kmlError}
                </div>
              )}
            </div>

            {/* Map */}
            <div>
              <label className="label">
                Location — {kmlBoundary ? 'KML boundary shown on satellite view · click to move pin' : 'click to pin on satellite map'}
              </label>
              <GoogleMapPicker lat={mapLat} lng={mapLng} onSelect={handleMapSelect} kmlBoundary={kmlBoundary} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Latitude</label>
                <input className="input" type="number" step="any" placeholder="-31.9505" {...register('latitude')} />
              </div>
              <div>
                <label className="label">Longitude</label>
                <input className="input" type="number" step="any" placeholder="115.8605" {...register('longitude')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Land Area (ha)</label>
                <input className="input" type="number" step="any" placeholder="100.0" {...register('land_area')} />
              </div>
              <div>
                <label className="label">Sowing Date</label>
                <input className="input" type="date" {...register('sowing_date')} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={isPending} className="btn-primary flex-1">
                {isPending ? 'Saving…' : editItem ? 'Save Changes' : 'Create Paddock'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Bulk KML import modal */}
        <BulkImportModal
          open={bulkOpen}
          placemarks={bulkPlacemarks}
          farmId={resolvedFarmId}
          onClose={() => setBulkOpen(false)}
          onDone={() => setBulkOpen(false)}
        />
      </div>
    </AppLayout>
  );
}
