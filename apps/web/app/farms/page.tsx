'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Plus, Pencil, Trash2, MapPin, Layers,
  AlertCircle, Upload, FileText, X, ArrowRight,
  Cloud, Wind, Droplets, Thermometer, ChevronDown, FlaskConical, Eye,
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
import type { Farm, FarmStats, Paddock, SoilReport } from '@/types';
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

  // ── Paddock add / edit / detail ───────────────────────────────────────────
  const [addPaddockOpen, setAddPaddockOpen] = useState(false);
  const [editPaddock, setEditPaddock]       = useState<Paddock | null>(null);
  const [deletePaddock, setDeletePaddock]   = useState<Paddock | null>(null);
  const [detailPaddock, setDetailPaddock]   = useState<Paddock | null>(null);

  // ── Soil report upload ────────────────────────────────────────────────────
  const [soilParsed, setSoilParsed]   = useState<ParsedSoil | null>(null);
  const [soilParsing, setSoilParsing] = useState(false);
  const [soilError, setSoilError]     = useState<string | null>(null);
  const soilFileRef = useRef<HTMLInputElement>(null);

  const createFarmForm  = useForm<FarmForm>({ defaultValues: { country: 'Australia' } });
  const editFarmForm    = useForm<FarmForm>({ defaultValues: { country: 'Australia' } });
  const paddockForm     = useForm<PaddockForm>();

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: farms, isLoading: farmsLoading } = useQuery<Farm[]>({
    queryKey: ['farms'],
    queryFn: () => api.get('/farms').then(r => r.data),
  });

  const farm = (activeFarmId ? farms?.find(f => f.id === activeFarmId) : null) ?? farms?.[0] ?? null;

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

  const { data: detailSoilReports } = useQuery<SoilReport[]>({
    queryKey: ['soil-reports', detailPaddock?.id],
    queryFn: () => api.get('/soil-reports', { params: { paddock_id: detailPaddock!.id } }).then(r => r.data),
    enabled: !!detailPaddock,
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

  // Auto-select farm and keep activeFarmId in sync
  useEffect(() => {
    if (farm && farm.id !== activeFarmId) setActiveFarmId(farm.id);
  }, [farm?.id]);

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
  const resetSoil = () => { setSoilParsed(null); setSoilParsing(false); setSoilError(null); };

  const handleSoilFile = async (file: File) => {
    if (!file.name.match(/\.pdf$/i)) { setSoilError('Please upload a PDF file.'); return; }
    setSoilParsing(true); setSoilError(null); setSoilParsed(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Do NOT set Content-Type — axios must auto-set multipart/form-data WITH boundary
      const res = await api.post('/soil-reports/parse', formData, {
        headers: { 'Content-Type': undefined },
      });
      const parsed: ParsedSoil = res.data;
      setSoilParsed(parsed);
      if (parsed.crop) {
        const matched = CROPS.find(c =>
          parsed.crop!.toLowerCase().includes(c.label.toLowerCase()) ||
          c.label.toLowerCase().includes(parsed.crop!.toLowerCase().split(' ')[0])
        );
        if (matched && !paddockForm.getValues('crop_type')) paddockForm.setValue('crop_type', matched.label);
      }
      if (parsed.area_ha && !paddockForm.getValues('land_area'))
        paddockForm.setValue('land_area', parsed.area_ha.toString());
    } catch { setSoilError('Failed to parse soil report.'); }
    finally { setSoilParsing(false); }
  };

  const createPaddockMutation = useMutation({
    mutationFn: async (d: PaddockForm) => {
      const res = await api.post('/paddocks', {
        farm_id: farm!.id, name: d.name,
        crop_type: d.crop_type || null,
        land_area: d.land_area ? parseFloat(d.land_area) : null,
        sowing_date: d.sowing_date || null,
      });
      if (soilParsed && farm) {
        try { await api.post('/soil-reports', { paddock_id: res.data.id, farm_id: farm.id, ...soilParsed }); } catch {}
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paddocks'] });
      qc.invalidateQueries({ queryKey: ['farm-stats'] });
      setAddPaddockOpen(false); paddockForm.reset(); resetSoil();
    },
  });

  const updatePaddockMutation = useMutation({
    mutationFn: async (d: PaddockForm) => {
      const res = await api.patch(`/paddocks/${editPaddock!.id}`, {
        name: d.name, crop_type: d.crop_type || null,
        land_area: d.land_area ? parseFloat(d.land_area) : null,
        sowing_date: d.sowing_date || null,
      });
      if (soilParsed && farm) {
        try { await api.post('/soil-reports', { paddock_id: editPaddock!.id, farm_id: farm.id, ...soilParsed }); } catch {}
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paddocks'] });
      setEditPaddock(null); paddockForm.reset(); resetSoil();
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
                          onClick={() => setDetailPaddock(p)}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="View soil report details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
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
      <Modal open={addPaddockOpen} onClose={() => { setAddPaddockOpen(false); paddockForm.reset(); resetSoil(); }} title="Add Paddock" className="max-w-md">
        <div className="space-y-4">
          <SoilUploadSection
            parsed={soilParsed} parsing={soilParsing} error={soilError}
            fileRef={soilFileRef} onFile={handleSoilFile} onClear={resetSoil}
          />
          <PaddockFormFields form={paddockForm} />
          <div className="flex gap-3">
            <button type="button" onClick={() => { setAddPaddockOpen(false); paddockForm.reset(); resetSoil(); }} className="btn-secondary flex-1">Cancel</button>
            <button
              type="button"
              onClick={paddockForm.handleSubmit(d => createPaddockMutation.mutate(d))}
              disabled={createPaddockMutation.isPending}
              className="btn-primary flex-1"
            >
              {createPaddockMutation.isPending ? 'Saving…' : 'Create Paddock'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Paddock Modal ─────────────────────────────────────────────── */}
      <Modal open={!!editPaddock} onClose={() => { setEditPaddock(null); paddockForm.reset(); resetSoil(); }} title={`Edit: ${editPaddock?.name ?? ''}`} className="max-w-md">
        <div className="space-y-4">
          <SoilUploadSection
            parsed={soilParsed} parsing={soilParsing} error={soilError}
            fileRef={soilFileRef} onFile={handleSoilFile} onClear={resetSoil}
          />
          <PaddockFormFields form={paddockForm} />
          <div className="flex gap-3">
            <button type="button" onClick={() => { setEditPaddock(null); paddockForm.reset(); resetSoil(); }} className="btn-secondary flex-1">Cancel</button>
            <button
              type="button"
              onClick={paddockForm.handleSubmit(d => updatePaddockMutation.mutate(d))}
              disabled={updatePaddockMutation.isPending}
              className="btn-primary flex-1"
            >
              {updatePaddockMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
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

      {/* ── Paddock Detail Modal ───────────────────────────────────────────── */}
      {detailPaddock && (
        <PaddockDetailModal
          paddock={detailPaddock}
          soilReports={detailSoilReports ?? []}
          onClose={() => setDetailPaddock(null)}
          onEdit={() => { setDetailPaddock(null); openEditPaddock(detailPaddock); }}
        />
      )}

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

// ── Soil status badge ─────────────────────────────────────────────────────────
const SOIL_BADGE: Record<string, string> = {
  Satisfactory: 'bg-green-100 text-green-700', Sufficient: 'bg-green-100 text-green-700',
  High: 'bg-orange-100 text-orange-700',        Marginal:   'bg-yellow-100 text-yellow-700',
  Low:  'bg-red-100 text-red-700',              Excess:     'bg-red-100 text-red-700',
  Unknown: 'bg-gray-100 text-gray-500',
};
function SBadge({ s }: { s: string }) {
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${SOIL_BADGE[s] ?? 'bg-gray-100 text-gray-500'}`}>{s}</span>;
}

// ── Soil upload section ───────────────────────────────────────────────────────
type ParsedSoil = Omit<SoilReport, 'id' | 'paddock_id' | 'farm_id' | 'created_at'>;

function SoilUploadSection({
  parsed, parsing, error, fileRef, onFile, onClear,
}: {
  parsed: ParsedSoil | null;
  parsing: boolean;
  error: string | null;
  fileRef: React.RefObject<HTMLInputElement>;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const nutrients = [
    { l: 'pH',  v: parsed?.ph_topsoil != null ? String(parsed.ph_topsoil) : null,           s: parsed?.ph_topsoil_status },
    { l: 'OC%', v: parsed?.organic_carbon != null ? `${parsed.organic_carbon}%` : null,      s: parsed?.organic_carbon_status },
    { l: 'N',   v: parsed?.nitrate_n != null ? `${parsed.nitrate_n} mg/kg` : null,           s: parsed?.nitrate_n_status },
    { l: 'P',   v: parsed?.phosphorus != null ? `${parsed.phosphorus} mg/kg` : null,         s: parsed?.phosphorus_status },
    { l: 'Zn',  v: parsed?.zinc != null ? `${parsed.zinc} mg/kg` : null,                    s: parsed?.zinc_status },
    { l: 'Mg',  v: parsed?.magnesium != null ? `${parsed.magnesium} cmol+/kg` : null,        s: parsed?.magnesium_status },
  ].filter(n => n.v);

  return (
    <div>
      <label className="label flex items-center gap-1.5">
        <FlaskConical className="w-3.5 h-3.5 text-emerald-600" />
        Soil Report (PDF)
        <span className="text-gray-400 font-normal text-xs">— auto-fills crop, area &amp; nutrients</span>
      </label>

      {!parsed && !parsing && (
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
          onDragOver={e => e.preventDefault()}
          className="flex items-center gap-3 border-2 border-dashed border-emerald-200 rounded-xl px-4 py-3 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors"
        >
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Drop soil report PDF here</p>
            <p className="text-xs text-gray-400">Pinnacle Ag &amp; similar lab formats supported</p>
          </div>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        </div>
      )}

      {parsing && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          Parsing soil report…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {parsed && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Soil Report Extracted</span>
              {parsed.lab_name && <span className="text-xs text-emerald-500">· {parsed.lab_name}</span>}
            </div>
            <button type="button" onClick={onClear} className="p-1 text-emerald-400 hover:text-red-500 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-emerald-700">
            {parsed.crop && <span>Crop: <strong>{parsed.crop}</strong></span>}
            {parsed.target_yield_t_ha && <span>Target: <strong>{parsed.target_yield_t_ha} t/ha</strong></span>}
            {parsed.area_ha && <span>Area: <strong>{parsed.area_ha} ha</strong></span>}
            {parsed.sample_date && <span>Sampled: <strong>{parsed.sample_date}</strong></span>}
          </div>

          {nutrients.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {nutrients.map(n => (
                <div key={n.l} className="flex items-center justify-between bg-white rounded-lg px-2 py-1.5">
                  <span className="text-xs text-gray-500">{n.l}</span>
                  <div className="flex items-center gap-1.5 ml-1 flex-shrink-0">
                    <span className="text-xs font-semibold text-gray-800">{n.v}</span>
                    {n.s && <SBadge s={n.s} />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(parsed.n_rate_kg_ha || parsed.p_rate_kg_ha) && (
            <div className="flex flex-wrap gap-3 text-[10px] bg-white rounded-lg px-2 py-1.5 text-emerald-700">
              {parsed.n_rate_kg_ha  && <span>N: <strong>{parsed.n_rate_kg_ha} kg/ha</strong></span>}
              {parsed.p_rate_kg_ha  && <span>P: <strong>{parsed.p_rate_kg_ha} kg/ha</strong></span>}
              {parsed.s_rate_kg_ha  && <span>S: <strong>{parsed.s_rate_kg_ha} kg/ha</strong></span>}
              {parsed.zn_rate_kg_ha && <span>Zn: <strong>{parsed.zn_rate_kg_ha} kg/ha</strong></span>}
            </div>
          )}
        </div>
      )}
    </div>
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

// ── Paddock Detail Modal ──────────────────────────────────────────────────────
const NUTRIENT_ROWS = [
  { key: 'ph_topsoil',       label: 'pH (topsoil)',        statusKey: 'ph_topsoil_status',       unit: '' },
  { key: 'ph_subsoil',       label: 'pH (subsoil)',         statusKey: 'ph_subsoil_status',       unit: '' },
  { key: 'organic_carbon',   label: 'Organic Carbon',      statusKey: 'organic_carbon_status',   unit: '%' },
  { key: 'ec_topsoil',       label: 'EC (topsoil)',         statusKey: null,                      unit: 'dS/m' },
  { key: 'nitrate_n',        label: 'Nitrate-N',           statusKey: 'nitrate_n_status',        unit: 'mg/kg' },
  { key: 'phosphorus',       label: 'Phosphorus',          statusKey: 'phosphorus_status',       unit: 'mg/kg' },
  { key: 'potassium',        label: 'Potassium',           statusKey: 'potassium_status',        unit: 'cmol+/kg' },
  { key: 'sulfate_s',        label: 'Sulfate-S',           statusKey: 'sulfate_s_status',        unit: 'mg/kg' },
  { key: 'calcium',          label: 'Calcium',             statusKey: 'calcium_status',          unit: 'cmol+/kg' },
  { key: 'magnesium',        label: 'Magnesium',           statusKey: 'magnesium_status',        unit: 'cmol+/kg' },
  { key: 'zinc',             label: 'Zinc',                statusKey: 'zinc_status',             unit: 'mg/kg' },
  { key: 'copper',           label: 'Copper',              statusKey: 'copper_status',           unit: 'mg/kg' },
  { key: 'manganese',        label: 'Manganese',           statusKey: null,                      unit: 'mg/kg' },
  { key: 'boron',            label: 'Boron',               statusKey: null,                      unit: 'mg/kg' },
] as const;

function PaddockDetailModal({
  paddock, soilReports, onClose, onEdit,
}: {
  paddock: Paddock;
  soilReports: SoilReport[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const [reportIdx, setReportIdx] = useState(0);
  const report = soilReports[reportIdx] ?? null;
  const crop = CROP_MAP[paddock.crop_type ?? ''];

  return (
    <Modal open onClose={onClose} title={paddock.name} className="max-w-2xl">
      <div className="space-y-5">

        {/* Paddock summary row */}
        <div className="flex flex-wrap gap-3">
          {crop && (
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${crop.color}`}>
              <span>{crop.emoji}</span> {crop.label}
            </span>
          )}
          {paddock.land_area && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
              <MapPin className="w-3.5 h-3.5" /> {paddock.land_area} ha
            </span>
          )}
          {paddock.sowing_date && (
            <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
              Sown {new Date(paddock.sowing_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
          {paddock.latitude != null && (
            <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-500">
              {paddock.latitude.toFixed(4)}°, {paddock.longitude!.toFixed(4)}°
            </span>
          )}
        </div>

        {/* Soil reports section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-gray-900">Soil Reports</h3>
              {soilReports.length > 0 && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                  {soilReports.length} uploaded
                </span>
              )}
            </div>
            {soilReports.length > 1 && (
              <div className="flex items-center gap-1">
                {soilReports.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setReportIdx(i)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${i === reportIdx ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {new Date(soilReports[i].created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </button>
                ))}
              </div>
            )}
          </div>

          {soilReports.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
              <FlaskConical className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No soil report uploaded yet.</p>
              <p className="text-xs text-gray-300 mt-0.5">Upload a PDF from the Edit Paddock screen.</p>
            </div>
          ) : report && (
            <div className="space-y-4">
              {/* Report meta */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-emerald-700">
                {report.lab_name && <span><span className="text-emerald-500">Lab:</span> <strong>{report.lab_name}</strong></span>}
                {report.adviser_name && <span><span className="text-emerald-500">Adviser:</span> <strong>{report.adviser_name}</strong></span>}
                {report.sample_date && <span><span className="text-emerald-500">Sampled:</span> <strong>{report.sample_date}</strong></span>}
                {report.crop && <span><span className="text-emerald-500">Crop:</span> <strong>{report.crop}</strong></span>}
                {report.target_yield_t_ha && <span><span className="text-emerald-500">Target:</span> <strong>{report.target_yield_t_ha} t/ha</strong></span>}
                {report.soil_texture && <span><span className="text-emerald-500">Texture:</span> <strong>{report.soil_texture}</strong></span>}
              </div>

              {/* Nutrient table */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Nutrient Analysis</p>
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Nutrient</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Value</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {NUTRIENT_ROWS.map(({ key, label, statusKey, unit }) => {
                        const val = (report as any)[key];
                        const status = statusKey ? (report as any)[statusKey] : null;
                        if (val == null) return null;
                        return (
                          <tr key={key} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2 text-gray-700 font-medium">{label}</td>
                            <td className="px-3 py-2 text-right text-gray-900 font-semibold">{val}{unit ? ` ${unit}` : ''}</td>
                            <td className="px-3 py-2 text-right">
                              {status ? <SBadge s={status} /> : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fertiliser rates */}
              {(report.n_rate_kg_ha || report.p_rate_kg_ha || report.s_rate_kg_ha || report.zn_rate_kg_ha) && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fertiliser Requirements</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Nitrogen', value: report.n_rate_kg_ha, color: 'bg-blue-50 border-blue-100 text-blue-700' },
                      { label: 'Phosphorus', value: report.p_rate_kg_ha, color: 'bg-purple-50 border-purple-100 text-purple-700' },
                      { label: 'Sulfur', value: report.s_rate_kg_ha, color: 'bg-yellow-50 border-yellow-100 text-yellow-700' },
                      { label: 'Zinc', value: report.zn_rate_kg_ha, color: 'bg-orange-50 border-orange-100 text-orange-700' },
                    ].filter(r => r.value).map(r => (
                      <div key={r.label} className={`border rounded-xl p-3 text-center ${r.color}`}>
                        <p className="text-lg font-bold">{r.value}</p>
                        <p className="text-[10px] font-semibold">kg/ha</p>
                        <p className="text-[10px] mt-0.5 opacity-70">{r.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Product recommendations */}
              {report.recommendations && Array.isArray(report.recommendations) && report.recommendations.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Product Recommendations</p>
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Timing</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Product</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Application</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-500">Rate</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-500">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {report.recommendations.map((rec, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-600">{rec.timing}</td>
                            <td className="px-3 py-2 font-medium text-gray-900">{rec.product}</td>
                            <td className="px-3 py-2 text-gray-600">{rec.application}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{rec.rate}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-900">{rec.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Close</button>
          <button onClick={onEdit} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Pencil className="w-3.5 h-3.5" /> Edit Paddock
          </button>
        </div>
      </div>
    </Modal>
  );
}
