'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Plus, Pencil, Trash2, MapPin, Layers,
  AlertCircle, Upload, FileText, X, ArrowRight,
  Cloud, Wind, Droplets, Thermometer, ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFarm } from '@/lib/farm-context';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';
import { formatCurrency } from '@/lib/utils';
import type { Farm, FarmStats, Paddock } from '@/types';
import { parseFarmKml, type FarmKmlData, type KmlPlacemark } from '@/components/ui/GoogleMapPicker';

// ── Dynamic imports (Google Maps needs client-only) ───────────────────────────
const FarmPaddockMap = dynamic(
  () => import('@/components/ui/GoogleMapPicker').then(m => m.FarmPaddockMap),
  { ssr: false, loading: () => <div className="h-[480px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center"><span className="text-sm text-gray-400">Loading map…</span></div> }
);

// ── Constants ────────────────────────────────────────────────────────────────
const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
const AGRO_KEY  = '587b1967699157991ef25e887b576015';

const CROPS = [
  { label: 'Wheat',     emoji: '🌾', color: 'bg-yellow-100 text-yellow-800' },
  { label: 'Barley',    emoji: '🌾', color: 'bg-amber-100  text-amber-800'  },
  { label: 'Canola',    emoji: '🌼', color: 'bg-lime-100   text-lime-800'   },
  { label: 'Corn',      emoji: '🌽', color: 'bg-yellow-100 text-yellow-800' },
  { label: 'Soybeans',  emoji: '🫘', color: 'bg-green-100  text-green-800'  },
  { label: 'Sorghum',   emoji: '🌿', color: 'bg-red-100    text-red-800'    },
  { label: 'Cotton',    emoji: '🤍', color: 'bg-sky-100    text-sky-800'    },
  { label: 'Sunflower', emoji: '🌻', color: 'bg-yellow-100 text-yellow-800' },
  { label: 'Oats',      emoji: '🌾', color: 'bg-orange-100 text-orange-800' },
  { label: 'Rice',      emoji: '🍚', color: 'bg-emerald-100 text-emerald-800' },
  { label: 'Chickpeas', emoji: '🫘', color: 'bg-amber-100  text-amber-800'  },
  { label: 'Lentils',   emoji: '🫘', color: 'bg-orange-100 text-orange-800' },
  { label: 'Potatoes',  emoji: '🥔', color: 'bg-stone-100  text-stone-800'  },
  { label: 'Lucerne',   emoji: '🌿', color: 'bg-green-100  text-green-800'  },
  { label: 'Other',     emoji: '🌱', color: 'bg-gray-100   text-gray-700'   },
];
const CROP_MAP = Object.fromEntries(CROPS.map(c => [c.label, c]));

function windDir(deg: number) {
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg / 45) % 8];
}

// ── Types ────────────────────────────────────────────────────────────────────
interface FarmForm {
  name: string; location: string; state: string; postcode: string;
  country: string; description: string; total_area_hectares: string;
}
interface PaddockForm {
  name: string; crop_type: string; land_area: string; sowing_date: string;
}

// ── Weather widget ────────────────────────────────────────────────────────────
function WeatherWidget({ lat, lon }: { lat: number; lon: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['farm-weather', lat.toFixed(4), lon.toFixed(4)],
    queryFn: async () => {
      const url = `https://api.agromonitoring.com/agro/1.0/weather?lat=${lat}&lon=${lon}&units=metric&appid=${AGRO_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Weather fetch failed');
      const d = await res.json();
      return Array.isArray(d) ? d[0] : d;
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) return (
    <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl p-4 text-white animate-pulse h-32" />
  );
  if (isError || !data) return (
    <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl p-4 text-white flex items-center gap-2 text-sm">
      <AlertCircle className="w-4 h-4" /> Weather unavailable
    </div>
  );

  const w = data.weather?.[0];
  return (
    <div className="bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 rounded-2xl overflow-hidden text-white">
      <div className="px-4 pt-4 pb-3">
        <p className="text-sky-200 text-xs font-medium uppercase tracking-wide mb-1">Current Weather</p>
        <div className="flex items-end gap-3">
          <span className="text-5xl font-bold">{Math.round(data.main.temp)}°</span>
          <div className="mb-1">
            <p className="text-sky-100 text-sm capitalize">{w?.description ?? ''}</p>
            <p className="text-sky-200 text-xs">Feels like {Math.round(data.main.feels_like)}°C</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-white/20 bg-white/10 border-t border-white/20">
        <div className="flex flex-col items-center py-2 gap-0.5">
          <Droplets className="w-3.5 h-3.5 text-sky-200" />
          <span className="text-sm font-bold">{data.main.humidity}%</span>
          <span className="text-[10px] text-sky-200">Humidity</span>
        </div>
        <div className="flex flex-col items-center py-2 gap-0.5">
          <Wind className="w-3.5 h-3.5 text-sky-200" />
          <span className="text-sm font-bold">{data.wind.speed}m/s</span>
          <span className="text-[10px] text-sky-200">{windDir(data.wind.deg)}</span>
        </div>
        <div className="flex flex-col items-center py-2 gap-0.5">
          <Cloud className="w-3.5 h-3.5 text-sky-200" />
          <span className="text-sm font-bold">{data.clouds.all}%</span>
          <span className="text-[10px] text-sky-200">Cloud</span>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-2 text-xs text-sky-200">
        <span className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-blue-300" />{Math.round(data.main.temp_min)}° min</span>
        <span className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-red-300" />{Math.round(data.main.temp_max)}° max</span>
        <span>{data.main.pressure} hPa</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FarmsPage() {
  const qc = useQueryClient();
  const { activeFarmId, setActiveFarmId } = useFarm();

  // ── Create farm modal ─────────────────────────────────────────────────────
  const [createOpen, setCreateOpen]         = useState(false);
  const [kmlData, setKmlData]               = useState<FarmKmlData | null>(null);
  const [kmlFileName, setKmlFileName]       = useState('');
  const [kmlError, setKmlError]             = useState('');
  const [selectedPlacemarks, setSelected]   = useState<Set<number>>(new Set());
  const [creating, setCreating]             = useState(false);
  const [createError, setCreateError]       = useState('');
  const kmlRef = useRef<HTMLInputElement>(null);

  // ── Edit / delete farm ────────────────────────────────────────────────────
  const [editFarmOpen, setEditFarmOpen]     = useState(false);
  const [deleteConfirm, setDeleteConfirm]   = useState(false);

  // ── Paddock add / edit ────────────────────────────────────────────────────
  const [addPaddockOpen, setAddPaddockOpen] = useState(false);
  const [editPaddock, setEditPaddock]       = useState<Paddock | null>(null);
  const [deletePaddock, setDeletePaddock]   = useState<Paddock | null>(null);

  const createFarmForm  = useForm<FarmForm>({ defaultValues: { country: 'Australia' } });
  const editFarmForm    = useForm<FarmForm>({ defaultValues: { country: 'Australia' } });
  const paddockForm     = useForm<PaddockForm>();

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: farms, isLoading: farmsLoading } = useQuery<Farm[]>({
    queryKey: ['farms'],
    queryFn: () => api.get('/farms').then(r => r.data),
  });

  const farm = farms?.[0] ?? null;

  const { data: paddocks, isLoading: paddocksLoading } = useQuery<Paddock[]>({
    queryKey: ['paddocks', farm?.id],
    queryFn: () => api.get('/paddocks', { params: { farm_id: farm!.id } }).then(r => r.data),
    enabled: !!farm,
  });

  const { data: farmStats } = useQuery<FarmStats>({
    queryKey: ['farm-stats', farm?.id],
    queryFn: () => api.get(`/farms/${farm!.id}/stats`).then(r => r.data),
    enabled: !!farm,
  });

  // Derive farm centre for weather from paddock centroids
  const farmCenter = useMemo(() => {
    const pts = (paddocks ?? []).filter(p => p.latitude != null && p.longitude != null);
    if (pts.length === 0) return null;
    return {
      lat: pts.reduce((s, p) => s + p.latitude!, 0) / pts.length,
      lon: pts.reduce((s, p) => s + p.longitude!, 0) / pts.length,
    };
  }, [paddocks]);

  // Auto-select farm
  useEffect(() => {
    if (farm && !activeFarmId) setActiveFarmId(farm.id);
  }, [farm, activeFarmId, setActiveFarmId]);

  // ── KML handling ──────────────────────────────────────────────────────────
  const handleKml = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setKmlError(''); setKmlFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = parseFarmKml(ev.target!.result as string);
        setKmlData(data);
        setSelected(new Set(data.placemarks.map((_, i) => i)));
        if (data.farmName) createFarmForm.setValue('name', data.farmName);
        if (data.description) createFarmForm.setValue('description', data.description);
        if (data.totalAreaHa > 0) createFarmForm.setValue('total_area_hectares', data.totalAreaHa.toString());
      } catch (err: any) {
        setKmlError(err.message ?? 'Failed to parse KML.'); setKmlData(null); setSelected(new Set());
      }
    };
    reader.readAsText(file);
  }, [createFarmForm]);

  const clearKml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setKmlData(null); setKmlFileName(''); setKmlError(''); setSelected(new Set());
    createFarmForm.reset({ country: 'Australia' });
    if (kmlRef.current) kmlRef.current.value = '';
  };

  const closeCreateModal = () => {
    setCreateOpen(false); setKmlData(null); setKmlFileName(''); setKmlError('');
    setSelected(new Set()); setCreating(false); setCreateError('');
    createFarmForm.reset({ country: 'Australia' });
    if (kmlRef.current) kmlRef.current.value = '';
  };

  const togglePlacemark = (i: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };
  const toggleAll = () => {
    if (!kmlData) return;
    setSelected(selectedPlacemarks.size === kmlData.placemarks.length ? new Set() : new Set(kmlData.placemarks.map((_, i) => i)));
  };

  // ── Create farm + paddocks ────────────────────────────────────────────────
  const onCreateFarm = createFarmForm.handleSubmit(async (d) => {
    setCreating(true); setCreateError('');
    try {
      const res = await api.post('/farms', {
        name: d.name, location: d.location || null, state: d.state || null,
        postcode: d.postcode || null, country: d.country || 'Australia',
        description: d.description || null,
        total_area_hectares: d.total_area_hectares ? parseFloat(d.total_area_hectares) : null,
      });
      const newFarm = res.data;
      setActiveFarmId(newFarm.id);
      if (kmlData) {
        const toImport = kmlData.placemarks.filter((_, i) => selectedPlacemarks.has(i));
        for (const p of toImport) {
          await api.post('/paddocks', {
            farm_id: newFarm.id, name: p.name ?? 'Unnamed Paddock',
            land_area: p.area_ha, latitude: p.centroid.lat, longitude: p.centroid.lng,
            boundary_geojson: p.coords.length > 0 ? { type: 'Polygon', coordinates: [p.coords] } : undefined,
          });
        }
      }
      qc.invalidateQueries({ queryKey: ['farms'] });
      qc.invalidateQueries({ queryKey: ['paddocks'] });
      closeCreateModal();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? 'Failed to create farm.');
      setCreating(false);
    }
  });

  // ── Update farm ───────────────────────────────────────────────────────────
  const updateFarmMutation = useMutation({
    mutationFn: (d: FarmForm) => api.patch(`/farms/${farm!.id}`, {
      name: d.name, location: d.location || null, state: d.state || null,
      postcode: d.postcode || null, country: d.country || 'Australia',
      description: d.description || null,
      total_area_hectares: d.total_area_hectares ? parseFloat(d.total_area_hectares) : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['farms'] }); setEditFarmOpen(false); },
  });

  const openEditFarm = () => {
    if (!farm) return;
    editFarmForm.setValue('name', farm.name); editFarmForm.setValue('location', farm.location ?? '');
    editFarmForm.setValue('state', farm.state ?? ''); editFarmForm.setValue('postcode', farm.postcode ?? '');
    editFarmForm.setValue('country', farm.country); editFarmForm.setValue('description', farm.description ?? '');
    editFarmForm.setValue('total_area_hectares', farm.total_area_hectares?.toString() ?? '');
    setEditFarmOpen(true);
  };

  // ── Delete farm ───────────────────────────────────────────────────────────
  const deleteFarmMutation = useMutation({
    mutationFn: () => api.delete(`/farms/${farm!.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['farms'] }); setDeleteConfirm(false); },
  });

  // ── Paddock mutations ─────────────────────────────────────────────────────
  const createPaddockMutation = useMutation({
    mutationFn: (d: PaddockForm) => api.post('/paddocks', {
      farm_id: farm!.id, name: d.name,
      crop_type: d.crop_type || null,
      land_area: d.land_area ? parseFloat(d.land_area) : null,
      sowing_date: d.sowing_date || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paddocks'] });
      qc.invalidateQueries({ queryKey: ['farm-stats'] });
      setAddPaddockOpen(false); paddockForm.reset();
    },
  });

  const updatePaddockMutation = useMutation({
    mutationFn: (d: PaddockForm) => api.patch(`/paddocks/${editPaddock!.id}`, {
      name: d.name, crop_type: d.crop_type || null,
      land_area: d.land_area ? parseFloat(d.land_area) : null,
      sowing_date: d.sowing_date || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paddocks'] });
      setEditPaddock(null); paddockForm.reset();
    },
  });

  const deletePaddockMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/paddocks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paddocks'] });
      qc.invalidateQueries({ queryKey: ['farm-stats'] });
      setDeletePaddock(null);
    },
  });

  const openEditPaddock = (p: Paddock) => {
    setEditPaddock(p);
    paddockForm.setValue('name', p.name);
    paddockForm.setValue('crop_type', p.crop_type ?? '');
    paddockForm.setValue('land_area', p.land_area?.toString() ?? '');
    paddockForm.setValue('sowing_date', p.sowing_date?.slice(0, 10) ?? '');
  };

  const openEditPaddockById = (id: string) => {
    const p = paddocks?.find(p => p.id === id);
    if (p) openEditPaddock(p);
  };

  const selectedCount = kmlData ? selectedPlacemarks.size : 0;
  const btnLabel = selectedCount > 0
    ? `Create Farm & Import ${selectedCount} Paddock${selectedCount !== 1 ? 's' : ''}`
    : 'Create Farm';

  // ── Loading ───────────────────────────────────────────────────────────────
  if (farmsLoading) {
    return <AppLayout><div className="flex justify-center py-24"><Spinner /></div></AppLayout>;
  }

  // ── No farm → Empty state ─────────────────────────────────────────────────
  if (!farm) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6">
          <PageHeader title="Farm" subtitle="Set up your farm property" />
          <EmptyState
            icon={Building2}
            title="No farm set up yet"
            description="Add your farm to get started. Upload a KML file to automatically import farm and paddock details."
            action={<button onClick={() => setCreateOpen(true)} className="btn-primary">Set up your farm</button>}
          />
        </div>

        {/* Create modal (same as below) */}
        {createOpen && <CreateFarmModal
          createFarmForm={createFarmForm} onCreateFarm={onCreateFarm} closeModal={closeCreateModal}
          kmlData={kmlData} kmlFileName={kmlFileName} kmlError={kmlError} kmlRef={kmlRef}
          handleKml={handleKml} clearKml={clearKml}
          selectedPlacemarks={selectedPlacemarks} togglePlacemark={togglePlacemark} toggleAll={toggleAll}
          creating={creating} createError={createError} btnLabel={btnLabel}
        />}
      </AppLayout>
    );
  }

  // ── Farm exists → Detail view ─────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* ── Farm header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Building2 className="w-4 h-4 text-farm-600" />
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Your Farm</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{farm.name}</h1>
            {(farm.location || farm.state) && (
              <p className="text-gray-500 text-sm mt-0.5">
                {[farm.location, farm.state, farm.postcode].filter(Boolean).join(', ')}
              </p>
            )}
            {farm.description && (
              <p className="text-gray-400 text-sm mt-1 max-w-lg">{farm.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={openEditFarm} className="btn-secondary flex items-center gap-1.5 text-sm">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── KPI row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Weather card */}
          <div className="lg:col-span-1">
            {farmCenter ? (
              <WeatherWidget lat={farmCenter.lat} lon={farmCenter.lon} />
            ) : (
              <div className="h-full min-h-[120px] bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl p-5 text-white flex flex-col gap-2 opacity-70">
                <Cloud className="w-5 h-5" />
                <p className="text-sm font-medium">Weather unavailable</p>
                <p className="text-xs text-sky-200">Add paddocks with coordinates to see live weather</p>
              </div>
            )}
          </div>

          {/* Paddocks KPI */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Paddocks</span>
              <div className="w-9 h-9 rounded-xl bg-farm-50 flex items-center justify-center">
                <Layers className="w-4.5 h-4.5 text-farm-600" />
              </div>
            </div>
            <div>
              <p className="text-4xl font-bold text-gray-900 leading-none">
                {farmStats ? farmStats.paddock_count : <span className="text-gray-300">—</span>}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {farmStats && farmStats.paddock_count > 0
                  ? `across ${farmStats.total_hectares.toFixed(0)} ha total`
                  : 'No paddocks yet'}
              </p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(farmStats?.paddock_count ?? 0, 8) }).map((_, i) => (
                <div key={i} className="h-1.5 flex-1 rounded-full bg-farm-400 opacity-80" style={{ opacity: 0.4 + i * 0.07 }} />
              ))}
              {Array.from({ length: Math.max(0, 8 - (farmStats?.paddock_count ?? 0)) }).map((_, i) => (
                <div key={i} className="h-1.5 flex-1 rounded-full bg-gray-100" />
              ))}
            </div>
          </div>

          {/* Total Area KPI */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Area</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <MapPin className="w-4.5 h-4.5 text-emerald-600" />
              </div>
            </div>
            <div>
              <div className="flex items-end gap-1.5">
                <p className="text-4xl font-bold text-gray-900 leading-none">
                  {farmStats ? farmStats.total_hectares.toFixed(1) : <span className="text-gray-300">—</span>}
                </p>
                {farmStats && <span className="text-lg text-gray-400 font-medium mb-0.5">ha</span>}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {farmStats && farmStats.total_hectares > 0
                  ? `≈ ${(farmStats.total_hectares * 2.471).toFixed(0)} acres`
                  : 'No area recorded'}
              </p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-emerald-400 h-1.5 rounded-full transition-all duration-700"
                style={{ width: farmStats ? `${Math.min((farmStats.total_hectares / 2000) * 100, 100)}%` : '0%' }}
              />
            </div>
          </div>

        </div>

        {/* ── Satellite map ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Paddock Map</h2>
            <p className="text-xs text-gray-400">Click a paddock to edit it</p>
          </div>
          {paddocksLoading ? (
            <div className="h-[480px] bg-gray-100 rounded-xl animate-pulse" />
          ) : paddocks && paddocks.length > 0 ? (
            <FarmPaddockMap paddocks={paddocks} onPaddockClick={openEditPaddockById} height={480} />
          ) : (
            <div className="h-40 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-400">
              No paddock boundaries yet — add paddocks below
            </div>
          )}
        </div>

        {/* ── Paddocks section ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              Paddocks
              {paddocks && <span className="ml-2 text-sm font-normal text-gray-400">({paddocks.length})</span>}
            </h2>
            <button onClick={() => { paddockForm.reset(); setAddPaddockOpen(true); }} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Paddock
            </button>
          </div>

          {paddocksLoading ? <Spinner /> : paddocks && paddocks.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paddocks.map(p => {
                const crop = CROP_MAP[p.crop_type ?? ''];
                return (
                  <div key={p.id} className="card hover:shadow-md transition-shadow overflow-hidden p-0">
                    <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 ${crop ? 'bg-farm-50' : 'bg-gray-50'}`}>
                      <span className="text-2xl leading-none">{crop ? crop.emoji : '🌱'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                        {crop && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${crop.color}`}>{crop.label}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditPaddock(p)}
                          className="p-1.5 text-gray-400 hover:text-farm-600 hover:bg-farm-50 rounded-lg transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletePaddock(p)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="p-4 space-y-1">
                      {p.land_area && <p className="text-sm text-gray-500">{p.land_area} ha</p>}
                      {p.sowing_date && (
                        <p className="text-sm text-gray-500">
                          Sown {new Date(p.sowing_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                      {p.latitude != null && p.longitude != null && (
                        <p className="text-xs text-gray-400">{p.latitude.toFixed(4)}°, {p.longitude.toFixed(4)}°</p>
                      )}
                      {p.boundary_geojson && (
                        <p className="text-xs text-farm-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Boundary mapped
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">
              No paddocks yet — click "Add Paddock" or upload a KML when creating the farm.
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Farm Modal ────────────────────────────────────────────────── */}
      <Modal open={editFarmOpen} onClose={() => setEditFarmOpen(false)} title="Edit Farm" className="max-w-lg">
        <form onSubmit={editFarmForm.handleSubmit(d => updateFarmMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Farm Name *</label>
            <input className="input" placeholder="e.g. Riverdale Station" {...editFarmForm.register('name', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Location / Town</label><input className="input" placeholder="e.g. Dubbo" {...editFarmForm.register('location')} /></div>
            <div>
              <label className="label">State</label>
              <select className="input" {...editFarmForm.register('state')}>
                <option value="">Select…</option>
                {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Postcode</label><input className="input" placeholder="2830" {...editFarmForm.register('postcode')} /></div>
            <div><label className="label">Total Area (ha)</label><input className="input" type="number" step="any" {...editFarmForm.register('total_area_hectares')} /></div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={3} {...editFarmForm.register('description')} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditFarmOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={updateFarmMutation.isPending} className="btn-primary flex-1">
              {updateFarmMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Farm Modal ──────────────────────────────────────────────── */}
      <Modal open={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="Delete Farm" className="max-w-sm">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>{farm.name}</strong>? This will also delete all paddocks and records. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteConfirm(false)} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => deleteFarmMutation.mutate()}
            disabled={deleteFarmMutation.isPending}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700"
          >
            {deleteFarmMutation.isPending ? 'Deleting…' : 'Delete Farm'}
          </button>
        </div>
      </Modal>

      {/* ── Add Paddock Modal ──────────────────────────────────────────────── */}
      <Modal open={addPaddockOpen} onClose={() => { setAddPaddockOpen(false); paddockForm.reset(); }} title="Add Paddock" className="max-w-md">
        <PaddockFormFields form={paddockForm} />
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => { setAddPaddockOpen(false); paddockForm.reset(); }} className="btn-secondary flex-1">Cancel</button>
          <button
            type="button"
            onClick={paddockForm.handleSubmit(d => createPaddockMutation.mutate(d))}
            disabled={createPaddockMutation.isPending}
            className="btn-primary flex-1"
          >
            {createPaddockMutation.isPending ? 'Saving…' : 'Create Paddock'}
          </button>
        </div>
      </Modal>

      {/* ── Edit Paddock Modal ─────────────────────────────────────────────── */}
      <Modal open={!!editPaddock} onClose={() => { setEditPaddock(null); paddockForm.reset(); }} title={`Edit: ${editPaddock?.name ?? ''}`} className="max-w-md">
        <PaddockFormFields form={paddockForm} />
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => { setEditPaddock(null); paddockForm.reset(); }} className="btn-secondary flex-1">Cancel</button>
          <button
            type="button"
            onClick={paddockForm.handleSubmit(d => updatePaddockMutation.mutate(d))}
            disabled={updatePaddockMutation.isPending}
            className="btn-primary flex-1"
          >
            {updatePaddockMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* ── Delete Paddock Confirm ─────────────────────────────────────────── */}
      <Modal open={!!deletePaddock} onClose={() => setDeletePaddock(null)} title="Delete Paddock" className="max-w-sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete <strong>{deletePaddock?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeletePaddock(null)} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => deletePaddock && deletePaddockMutation.mutate(deletePaddock.id)}
            disabled={deletePaddockMutation.isPending}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700"
          >
            {deletePaddockMutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* ── Create Farm Modal ──────────────────────────────────────────────── */}
      {createOpen && <CreateFarmModal
        createFarmForm={createFarmForm} onCreateFarm={onCreateFarm} closeModal={closeCreateModal}
        kmlData={kmlData} kmlFileName={kmlFileName} kmlError={kmlError} kmlRef={kmlRef}
        handleKml={handleKml} clearKml={clearKml}
        selectedPlacemarks={selectedPlacemarks} togglePlacemark={togglePlacemark} toggleAll={toggleAll}
        creating={creating} createError={createError} btnLabel={btnLabel}
      />}
    </AppLayout>
  );
}

// ── Paddock form fields (reused in add + edit modals) ─────────────────────────
function PaddockFormFields({ form }: { form: ReturnType<typeof useForm<PaddockForm>> }) {
  const { register, setValue, watch } = form;
  const cropType = watch('crop_type');
  const crop = CROP_MAP[cropType ?? ''];
  return (
    <div className="space-y-4">
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
        {crop && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-2xl">{crop.emoji}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${crop.color}`}>{crop.label}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Land Area (ha)</label>
          <input className="input" type="number" step="any" placeholder="100" {...register('land_area')} />
        </div>
        <div>
          <label className="label">Sowing Date</label>
          <input className="input" type="date" {...register('sowing_date')} />
        </div>
      </div>
    </div>
  );
}

// ── Create farm modal (extracted to keep main component readable) ──────────────
function CreateFarmModal({
  createFarmForm, onCreateFarm, closeModal,
  kmlData, kmlFileName, kmlError, kmlRef,
  handleKml, clearKml,
  selectedPlacemarks, togglePlacemark, toggleAll,
  creating, createError, btnLabel,
}: any) {
  return (
    <Modal open onClose={closeModal} title="Add Farm" className="max-w-lg">
      <div className="space-y-4">
        {createError && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {createError}
          </div>
        )}

        {/* KML Upload */}
        <div>
          <label className="label">
            Upload KML File
            <span className="text-gray-400 font-normal ml-1">(auto-fills farm & paddock details)</span>
          </label>
          {!kmlData ? (
            <div
              onClick={() => kmlRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-farm-400 hover:bg-farm-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-farm-50 flex items-center justify-center">
                <Upload className="w-5 h-5 text-farm-600" />
              </div>
              <p className="text-sm font-medium text-gray-700">Click to upload .kml file</p>
              <p className="text-xs text-gray-400 text-center">Farm name, area, and all paddock boundaries extracted automatically</p>
            </div>
          ) : (
            <div className="bg-farm-50 border border-farm-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-farm-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-farm-800">{kmlFileName}</p>
                  <p className="text-xs text-farm-600">
                    {kmlData.placemarks.length} paddock{kmlData.placemarks.length !== 1 ? 's' : ''} detected
                    {kmlData.totalAreaHa > 0 && ` · ${kmlData.totalAreaHa.toFixed(1)} ha total`}
                  </p>
                </div>
              </div>
              <button onClick={clearKml} className="text-gray-400 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <input ref={kmlRef} type="file" accept=".kml" className="hidden" onChange={handleKml} />
          {kmlError && <p className="text-xs text-red-500 mt-1">{kmlError}</p>}
        </div>

        {/* KML preview map */}
        {kmlData && kmlData.placemarks.length > 0 && (
          <FarmPaddockMap placemarks={kmlData.placemarks} height={260} />
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400 font-medium">Farm Details</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <form onSubmit={onCreateFarm} className="space-y-3">
          <div>
            <label className="label">Farm Name *</label>
            <input className="input" placeholder="e.g. Riverdale Station" {...createFarmForm.register('name', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Location / Town</label><input className="input" placeholder="e.g. Dubbo" {...createFarmForm.register('location')} /></div>
            <div>
              <label className="label">State</label>
              <select className="input" {...createFarmForm.register('state')}>
                <option value="">Select…</option>
                {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Postcode</label><input className="input" placeholder="2830" {...createFarmForm.register('postcode')} /></div>
            <div><label className="label">Total Area (ha)</label><input className="input" type="number" step="any" placeholder="1200" {...createFarmForm.register('total_area_hectares')} /></div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} placeholder="Brief description…" {...createFarmForm.register('description')} />
          </div>
        </form>

        {/* Paddock checklist */}
        {kmlData && kmlData.placemarks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Paddocks to import</span>
                <span className="text-xs bg-farm-100 text-farm-700 px-2 py-0.5 rounded-full font-medium">
                  {selectedPlacemarks.size} / {kmlData.placemarks.length}
                </span>
              </div>
              <button type="button" onClick={toggleAll} className="text-xs text-farm-600 hover:underline font-medium">
                {selectedPlacemarks.size === kmlData.placemarks.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-2">
              {kmlData.placemarks.map((p: KmlPlacemark, i: number) => (
                <label key={i} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                  <input type="checkbox" checked={selectedPlacemarks.has(i)} onChange={() => togglePlacemark(i)} className="rounded border-gray-300 text-farm-600" />
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{p.name ?? 'Unnamed Paddock'}</span>
                    {p.area_ha != null && <span className="text-xs text-gray-400 flex-shrink-0">{p.area_ha.toFixed(1)} ha</span>}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
          <button
            type="button" onClick={onCreateFarm} disabled={creating}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {creating ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
            ) : (
              <>{btnLabel}<ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
