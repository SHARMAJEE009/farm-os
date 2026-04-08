'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Award, TrendingUp, Info, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/lib/utils';
import type { BenchmarkingData, BenchmarkPaddock } from '@/types';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';

// ── palette ──────────────────────────────────────────────────
const G = { farm: '#16a34a', fuel: '#f97316', supplier: '#0ea5e9', industry: '#9ca3af' };

// ── custom tooltip ────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-green-100 rounded-xl shadow-lg px-3 py-2.5 text-xs min-w-[150px]">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map((e: any) => (
        <div key={e.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
            {e.name}
          </span>
          <span className="font-semibold text-gray-800">
            {typeof e.value === 'number' && e.name?.includes('%') ? `${e.value}%` : formatCurrency(e.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function PctTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-green-100 rounded-xl shadow-lg px-3 py-2.5 text-xs min-w-[140px]">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map((e: any) => (
        <div key={e.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.fill }} />
            {e.name}
          </span>
          <span className="font-semibold text-gray-800">{e.value}%</span>
        </div>
      ))}
    </div>
  );
}

// ── percentile bar ────────────────────────────────────────────
function PercentileBar({ value, label }: { value: number; label: string }) {
  const fill  = value >= 75 ? '#16a34a' : value >= 50 ? '#0ea5e9' : value >= 25 ? '#f59e0b' : '#ef4444';
  const text  = value >= 75 ? 'text-green-700' : value >= 50 ? 'text-sky-700' : value >= 25 ? 'text-amber-700' : 'text-red-600';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-400">{label}</span>
        <span className={`text-[10px] font-bold ${text}`}>{value}th percentile</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: fill }} />
      </div>
    </div>
  );
}

// ── rank badge ────────────────────────────────────────────────
function getRankBadge(rank: number) {
  if (rank === 0) return { label: '1st', cls: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-100' };
  if (rank === 1) return { label: '2nd', cls: 'bg-gray-50  text-gray-500  border-gray-200  ring-gray-50' };
  if (rank === 2) return { label: '3rd', cls: 'bg-orange-50 text-orange-600 border-orange-200 ring-orange-50' };
  return           { label: `${rank + 1}th`, cls: 'bg-white text-gray-400 border-gray-100 ring-gray-50' };
}

// ── skeleton ──────────────────────────────────────────────────
function ChartSkeleton({ height = 240 }: { height?: number }) {
  return <div className="animate-pulse bg-gray-50 rounded-xl" style={{ height }} />;
}

// ── sort type ─────────────────────────────────────────────────
type SortBy = 'efficiency' | 'total';
type ChartTab = 'cph' | 'mix' | 'category';

export default function BenchmarkingPage() {
  const [sortBy,   setSortBy]   = useState<SortBy>('efficiency');
  const [chartTab, setChartTab] = useState<ChartTab>('cph');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<BenchmarkingData>({
    queryKey: ['benchmarking'],
    queryFn: () => api.get('/dashboard/benchmarking').then(r => r.data),
  });

  const rawPaddocks = data?.paddocks ?? [];
  const benchmark   = data?.industry_benchmark;

  const paddocks = [...rawPaddocks].sort((a, b) =>
    sortBy === 'efficiency'
      ? (a.cost_per_hectare ?? Infinity) - (b.cost_per_hectare ?? Infinity)
      : b.total_cost - a.total_cost
  );

  const byEfficiency = [...rawPaddocks]
    .filter(p => p.cost_per_hectare !== null)
    .sort((a, b) => (a.cost_per_hectare ?? 0) - (b.cost_per_hectare ?? 0));

  // chart data
  const cphChart = [...rawPaddocks]
    .filter(p => p.cost_per_hectare !== null)
    .sort((a, b) => (a.cost_per_hectare ?? 0) - (b.cost_per_hectare ?? 0))
    .map(p => ({
      name: p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name,
      'Cost/ha': p.cost_per_hectare,
      'Industry Avg': benchmark?.cost_per_hectare ?? 320,
    }));

  const categoryChart = rawPaddocks.map(p => ({
    name: p.name.length > 10 ? p.name.slice(0, 10) + '…' : p.name,
    Labour: p.labour_pct,
    Fuel: p.fuel_pct,
    Supplier: p.supplier_pct,
  }));

  const avgLabourPct   = rawPaddocks.length > 0 ? Math.round(rawPaddocks.reduce((s, p) => s + p.labour_pct,   0) / rawPaddocks.length) : 0;
  const avgFuelPct     = rawPaddocks.length > 0 ? Math.round(rawPaddocks.reduce((s, p) => s + p.fuel_pct,     0) / rawPaddocks.length) : 0;
  const avgSupplierPct = rawPaddocks.length > 0 ? Math.round(rawPaddocks.reduce((s, p) => s + p.supplier_pct, 0) / rawPaddocks.length) : 0;

  const radarData = [
    { subject: 'Labour %',   farm: avgLabourPct,   industry: benchmark?.labour_pct   ?? 35 },
    { subject: 'Fuel %',     farm: avgFuelPct,     industry: benchmark?.fuel_pct     ?? 25 },
    { subject: 'Supplier %', farm: avgSupplierPct, industry: benchmark?.supplier_pct ?? 40 },
  ];

  const chartTabs: { key: ChartTab; label: string }[] = [
    { key: 'cph',      label: 'Cost / ha' },
    { key: 'mix',      label: 'Cost Mix' },
    { key: 'category', label: 'Category %' },
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">

        {/* ── header ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Benchmarking</h1>
            <p className="text-sm text-gray-400 mt-0.5">Compare paddock efficiency and performance against industry benchmarks</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <ChartSkeleton height={320} />
            <ChartSkeleton height={280} />
          </div>
        ) : rawPaddocks.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm text-center py-16">
            <BarChart3 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No cost data yet</p>
            <p className="text-sm text-gray-400 mt-1">Log labour, fuel, or supplier costs to see benchmarks.</p>
          </div>
        ) : (
          <>
            {/* ── efficiency leaderboard ── */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm mb-4 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50">
                <Award className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-gray-900 flex-1">Cost Efficiency Ranking</h2>

                {/* sort toggle */}
                <div className="flex bg-gray-50 border border-gray-200 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setSortBy('efficiency')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${sortBy === 'efficiency' ? 'bg-white text-green-700 shadow-sm border border-green-100' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    By $/ha
                  </button>
                  <button
                    onClick={() => setSortBy('total')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${sortBy === 'total' ? 'bg-white text-green-700 shadow-sm border border-green-100' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    By Total
                  </button>
                </div>

                <span className="text-xs text-gray-400 hidden sm:block">Lower $/ha = more efficient</span>
              </div>

              <div className="divide-y divide-gray-50">
                {paddocks.map((p, rank) => {
                  const badge     = getRankBadge(rank);
                  const belowAvg  = p.cost_per_hectare !== null && p.cost_per_hectare <= (benchmark?.cost_per_hectare ?? 320);
                  const isOpen    = expanded === p.id;

                  return (
                    <div key={p.id}>
                      <button
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-green-50/40 transition-colors text-left"
                        onClick={() => setExpanded(isOpen ? null : p.id)}
                      >
                        {/* rank */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold border ring-2 flex-shrink-0 ${badge.cls}`}>
                          {badge.label}
                        </div>

                        {/* name + crop */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 leading-none">{p.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {p.crop_type ?? 'No crop'} · {p.area_hectares ? `${p.area_hectares} ha` : 'Area unknown'}
                          </p>
                        </div>

                        {/* cost bar (compact) */}
                        {p.total_cost > 0 && (
                          <div className="hidden sm:flex h-1.5 rounded-full overflow-hidden w-20 bg-gray-100 flex-shrink-0">
                            <div className="bg-green-500"  style={{ width: `${p.labour_pct}%` }} />
                            <div className="bg-orange-400" style={{ width: `${p.fuel_pct}%` }} />
                            <div className="bg-sky-400"    style={{ width: `${p.supplier_pct}%` }} />
                          </div>
                        )}

                        {/* cost + cph */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(p.total_cost)}</p>
                          {p.cost_per_hectare !== null && (
                            <p className={`text-xs font-semibold ${belowAvg ? 'text-green-600' : 'text-red-500'}`}>
                              {formatCurrency(p.cost_per_hectare)}/ha {belowAvg ? '✓' : '↑'}
                            </p>
                          )}
                        </div>

                        {/* expand icon */}
                        <div className="text-gray-300 flex-shrink-0">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {/* expanded detail */}
                      {isOpen && (
                        <div className="bg-green-50/30 border-t border-green-50 px-5 py-3 space-y-3">
                          {/* cost breakdown bar */}
                          {p.total_cost > 0 && (
                            <div>
                              <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-wide font-semibold">Cost mix</p>
                              <div className="flex h-3 rounded-lg overflow-hidden bg-gray-100 mb-1">
                                <div className="bg-green-500  transition-all" style={{ width: `${p.labour_pct}%` }} title={`Labour ${p.labour_pct}%`} />
                                <div className="bg-orange-400 transition-all" style={{ width: `${p.fuel_pct}%` }}   title={`Fuel ${p.fuel_pct}%`} />
                                <div className="bg-sky-400    transition-all" style={{ width: `${p.supplier_pct}%` }} title={`Supplier ${p.supplier_pct}%`} />
                              </div>
                              <div className="flex gap-3">
                                {[['bg-green-500','Labour',p.labour_pct],['bg-orange-400','Fuel',p.fuel_pct],['bg-sky-400','Supplier',p.supplier_pct]].map(([c,l,v]) => (
                                  <span key={String(l)} className="flex items-center gap-1 text-[10px] text-gray-500">
                                    <span className={`w-2 h-2 rounded-sm ${c}`} />
                                    {l}: {v}%
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* percentile */}
                          {p.percentile !== null && (
                            <PercentileBar value={p.percentile} label="Cost efficiency percentile (within farm)" />
                          )}
                          {/* breakdown amounts */}
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: 'Labour', val: p.labour_cost, color: 'text-green-700' },
                              { label: 'Fuel',   val: p.fuel_cost,   color: 'text-orange-600' },
                              { label: 'Supplier',val:p.supplier_cost,color:'text-sky-600' },
                            ].map(({ label, val, color }) => (
                              <div key={label} className="bg-white border border-gray-100 rounded-lg px-2.5 py-1.5 text-center">
                                <p className={`text-xs font-bold ${color}`}>{formatCurrency(val)}</p>
                                <p className="text-[10px] text-gray-400">{label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* legend */}
              <div className="flex gap-4 px-5 py-2.5 border-t border-gray-50 bg-gray-50/40">
                {[['bg-green-500','Labour'],['bg-orange-400','Fuel'],['bg-sky-400','Supplier']].map(([c,l]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-sm ${c}`} />
                    <span className="text-xs text-gray-400">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── chart card with tabs ── */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm mb-4 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-900 flex-1">Performance Charts</h2>
                <div className="flex bg-gray-50 border border-gray-200 rounded-lg p-0.5 text-xs">
                  {chartTabs.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setChartTab(t.key)}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all whitespace-nowrap ${chartTab === t.key ? 'bg-white text-green-700 shadow-sm border border-green-100' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-5 py-4">
                {/* Cost/ha vs industry avg */}
                {chartTab === 'cph' && (
                  cphChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={cphChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={55} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <ReferenceLine
                          y={benchmark?.cost_per_hectare ?? 320}
                          stroke="#ef4444" strokeDasharray="5 3"
                          label={{ value: 'Industry Avg', fontSize: 10, fill: '#ef4444', position: 'insideTopRight' }}
                        />
                        <Bar dataKey="Cost/ha" fill={G.farm} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="text-center py-10 text-sm text-gray-400">No hectare data available</div>
                )}

                {/* Radar: Farm vs Industry mix */}
                {chartTab === 'mix' && (
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={radarData} margin={{ top: 16, right: 40, left: 40, bottom: 16 }}>
                      <PolarGrid stroke="#f3f4f6" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6b7280' }} />
                      <Radar name="Your Farm"    dataKey="farm"     stroke={G.farm}     fill={G.farm}     fillOpacity={0.25} />
                      <Radar name="Industry Avg" dataKey="industry" stroke={G.industry} fill={G.industry} fillOpacity={0.1}  strokeDasharray="5 3" />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}

                {/* Category % stacked bar */}
                {chartTab === 'category' && (
                  categoryChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={categoryChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} domain={[0, 100]} axisLine={false} tickLine={false} width={40} />
                        <Tooltip content={<PctTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Bar dataKey="Labour"   stackId="a" fill={G.farm}     />
                        <Bar dataKey="Fuel"     stackId="a" fill={G.fuel}     />
                        <Bar dataKey="Supplier" stackId="a" fill={G.supplier} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="text-center py-10 text-sm text-gray-400">No category data available</div>
                )}
              </div>
            </div>

            {/* ── benchmark note ── */}
            <div className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <Info className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-green-800">About industry benchmarks</p>
                <p className="text-xs text-green-700 mt-0.5 leading-relaxed">
                  Industry average of <strong>{formatCurrency(benchmark?.cost_per_hectare ?? 320)}/ha</strong> is based on Australian broadacre farming benchmarks ({benchmark?.labour_pct}% labour, {benchmark?.fuel_pct}% fuel, {benchmark?.supplier_pct}% inputs). Benchmarks vary by commodity and region.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
