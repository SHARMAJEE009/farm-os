'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Calendar, DollarSign, Info, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatCurrency } from '@/lib/utils';
import type { ForecastingData } from '@/types';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';

// ── palette ──────────────────────────────────────────────────
const G = {
  labour:   '#16a34a',   // green-600
  fuel:     '#f97316',   // orange-500
  supplier: '#0ea5e9',   // sky-500
  total:    '#1e3a2f',   // dark green
  projected:'#6b7280',   // gray
};

// ── custom tooltip ────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const isProjected = payload[0]?.payload?.projected;
  return (
    <div className="bg-white border border-green-100 rounded-xl shadow-lg px-3 py-2.5 text-xs min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
        {label}
        {isProjected && (
          <span className="bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5 text-[10px] font-medium">Projected</span>
        )}
      </p>
      {payload.map((e: any) => (
        <div key={e.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
            {e.name}
          </span>
          <span className="font-semibold text-gray-800">{formatCurrency(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── stat card ─────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, trend, trendVal,
}: {
  label: string; value: string; sub: string;
  icon: React.ElementType; trend?: 'up' | 'down' | 'neutral'; trendVal?: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-green-200 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
          <Icon className="w-4 h-4 text-green-700" />
        </div>
        {trendVal && trend !== 'neutral' && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
            trend === 'down' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trendVal}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5 font-medium">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

// ── skeleton loader ───────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm animate-pulse">
      <div className="w-9 h-9 bg-gray-100 rounded-xl mb-3" />
      <div className="h-7 bg-gray-100 rounded w-24 mb-1" />
      <div className="h-3 bg-gray-100 rounded w-16" />
    </div>
  );
}

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="animate-pulse" style={{ height }}>
      <div className="h-full bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl" />
    </div>
  );
}

// ── chart view toggle ─────────────────────────────────────────
type ChartView = 'category' | 'paddock';

export default function ForecastingPage() {
  const [chartView, setChartView] = useState<ChartView>('category');

  const { data, isLoading, refetch, isFetching } = useQuery<ForecastingData>({
    queryKey: ['forecasting'],
    queryFn: () => api.get('/dashboard/forecasting').then(r => r.data),
  });

  const months = data?.monthly ?? [];
  const historical = months.filter(m => !m.projected);
  const projected  = months.filter(m => m.projected);

  const nextMonth      = projected[0]?.total ?? 0;
  const nextQuarter    = projected.reduce((s, m) => s + m.total, 0);
  const avgHistorical  = historical.length > 0 ? historical.reduce((s, m) => s + m.total, 0) / historical.length : 0;
  const trend          = historical.length >= 2
    ? ((historical[historical.length - 1].total - historical[0].total) / Math.max(historical[0].total, 1)) * 100
    : 0;

  const projectedStartMonth = projected[0]?.month;
  const chartData = months.map(m => ({ ...m, totalLine: m.total }));

  const paddockData     = data?.paddock_monthly ?? [];
  const paddockNames    = [...new Set(paddockData.map(d => d.paddock_name))];
  const allMonths       = [...new Set(paddockData.map(d => d.month))].sort();
  const paddockChartData = allMonths.slice(-6).map(month => {
    const entry: any = { month };
    paddockNames.forEach(name => {
      const row = paddockData.find(d => d.paddock_name === name && d.month === month);
      entry[name] = row?.total ?? 0;
    });
    return entry;
  });

  const PADDOCK_COLORS = ['#16a34a','#f97316','#0ea5e9','#8b5cf6','#f43f5e','#10b981'];

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">

        {/* ── header ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Forecasting</h1>
            <p className="text-sm text-gray-400 mt-0.5">Cost projections based on your trailing 3-month average</p>
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

        {/* ── stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard label="Next Month" value={formatCurrency(nextMonth)} sub="Projected spend" icon={Calendar} trend="neutral" />
              <StatCard label="Next Quarter" value={formatCurrency(nextQuarter)} sub="3-month projection" icon={TrendingUp} trend="neutral" />
              <StatCard label="Monthly Avg" value={formatCurrency(avgHistorical)} sub="Historical average" icon={DollarSign} trend="neutral" />
              <StatCard
                label="Cost Trend"
                value={`${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`}
                sub="vs. start of period"
                icon={TrendingUp}
                trend={trend >= 0 ? 'up' : 'down'}
                trendVal={`${Math.abs(trend).toFixed(1)}%`}
              />
            </>
          )}
        </div>

        {/* ── main chart card ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm mb-4 overflow-hidden">
          {/* card header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Cost Forecast</h2>
              <p className="text-xs text-gray-400 mt-0.5">Historical + 3-month projection</p>
            </div>
            <div className="flex items-center gap-2">
              {/* projected badge */}
              <div className="hidden sm:flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg text-xs text-gray-500">
                <svg width="14" height="4" viewBox="0 0 14 4">
                  <line x1="0" y1="2" x2="14" y2="2" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4 2" />
                </svg>
                Projected
              </div>
              {/* view toggle */}
              <div className="flex bg-gray-50 border border-gray-200 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setChartView('category')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${chartView === 'category' ? 'bg-white text-green-700 shadow-sm border border-green-100' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  By Category
                </button>
                <button
                  onClick={() => setChartView('paddock')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${chartView === 'paddock' ? 'bg-white text-green-700 shadow-sm border border-green-100' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  By Paddock
                </button>
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            {isLoading ? (
              <ChartSkeleton height={280} />
            ) : chartView === 'category' ? (
              chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <TrendingUp className="w-8 h-8 mb-2 text-gray-200" />
                  <p className="text-sm">No data yet. Log some costs to see forecasts.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="labourGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={G.labour} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={G.labour} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={55} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    {projectedStartMonth && (
                      <ReferenceLine x={projectedStartMonth} stroke="#d1fae5" strokeWidth={2} strokeDasharray="6 3"
                        label={{ value: 'Forecast →', fontSize: 10, fill: '#6b7280', position: 'insideTopRight' }} />
                    )}
                    <Line type="monotone" dataKey="labour"   name="Labour"   stroke={G.labour}   strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="fuel"     name="Fuel"     stroke={G.fuel}     strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="supplier" name="Supplier" stroke={G.supplier} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="totalLine" name="Total"   stroke={G.total}    strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} strokeDasharray="0" />
                  </ComposedChart>
                </ResponsiveContainer>
              )
            ) : (
              paddockChartData.length === 0 || paddockNames.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <TrendingUp className="w-8 h-8 mb-2 text-gray-200" />
                  <p className="text-sm">No paddock data available.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={paddockChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={55} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    {paddockNames.map((name, i) => (
                      <Bar key={name} dataKey={name} stackId="a"
                        fill={PADDOCK_COLORS[i % PADDOCK_COLORS.length]}
                        radius={i === paddockNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              )
            )}
          </div>
        </div>

        {/* ── monthly breakdown table (compact) ── */}
        {!isLoading && months.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm mb-4 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Monthly Breakdown</h2>
              <p className="text-xs text-gray-400">Labour · Fuel · Supplier · Total</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50/60">
                    {['Month','Labour','Fuel','Supplier','Total','Type'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide last:text-center">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {months.map((m, i) => (
                    <tr key={i} className={`border-t border-gray-50 hover:bg-green-50/30 transition-colors ${m.projected ? 'opacity-70' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-gray-700">{m.month}</td>
                      <td className="px-4 py-2.5 text-gray-600">{formatCurrency(m.labour)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{formatCurrency(m.fuel)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{formatCurrency(m.supplier)}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900">{formatCurrency(m.total)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {m.projected ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                            Projected
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                            Actual
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── methodology note ── */}
        <div className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-green-800">About these projections</p>
            <p className="text-xs text-green-700 mt-0.5 leading-relaxed">
              Projections are based on your trailing 3-month average costs. Actual costs may vary due to seasonal operations, weather events, or planned capital expenditure. Use projections for budgeting guidance only.
            </p>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
