'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFarm } from '@/lib/farm-context';
import { DollarSign, Users, Fuel, ShoppingCart, TrendingDown, Hash, Download, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { StatCard } from '@/components/ui/StatCard';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { FinancialTransaction, PaddockSummary } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { format, parseISO, startOfMonth } from 'date-fns';

type SourceFilter = 'all' | 'labour' | 'fuel' | 'supplier';

const SOURCE_COLORS: Record<string, string> = {
  labour: '#3b82f6',
  fuel: '#f97316',
  supplier: '#a855f7',
};

const SOURCE_LABELS: Record<string, string> = {
  labour: 'Labour',
  fuel: 'Fuel',
  supplier: 'Supplier',
};

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    labour: 'bg-blue-100 text-blue-700',
    fuel: 'bg-orange-100 text-orange-700',
    supplier: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[source] ?? 'bg-gray-100 text-gray-600'}`}>
      {SOURCE_LABELS[source] ?? source}
    </span>
  );
}

function exportCSV(transactions: FinancialTransaction[]) {
  const header = ['Date', 'Source', 'Paddock', 'Detail', 'Amount'];
  const rows = transactions.map(tx => [
    formatDate(tx.created_at),
    tx.source,
    tx.paddock?.name ?? tx.paddock_id,
    tx.source === 'supplier' ? (tx.product_name ?? '') : tx.source === 'labour' ? (tx.staff_name ?? '') : '',
    tx.amount.toFixed(2),
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'farm-os-transactions.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function FinancePage() {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [paddockFilter, setPaddockFilter] = useState<string>('all');

  const { activeFarmId } = useFarm();
  const farmParams = activeFarmId ? { farm_id: activeFarmId } : {};

  const { data: transactions, isLoading: txLoading } = useQuery<FinancialTransaction[]>({
    queryKey: ['financial-transactions', activeFarmId],
    queryFn: () => api.get('/financial-transactions', { params: farmParams }).then(r => r.data),
  });

  const { data: paddockSummaries, isLoading: psLoading } = useQuery<PaddockSummary[]>({
    queryKey: ['paddock-summaries', activeFarmId],
    queryFn: () => api.get('/dashboard/paddock-summaries', { params: farmParams }).then(r => r.data),
  });

  // --- Computed stats ---
  const totalLabour   = transactions?.filter(t => t.source === 'labour').reduce((s, t) => s + t.amount, 0) ?? 0;
  const totalFuel     = transactions?.filter(t => t.source === 'fuel').reduce((s, t) => s + t.amount, 0) ?? 0;
  const totalSupplier = transactions?.filter(t => t.source === 'supplier').reduce((s, t) => s + t.amount, 0) ?? 0;
  const grandTotal    = totalLabour + totalFuel + totalSupplier;
  const txCount       = transactions?.length ?? 0;
  const avgTx         = txCount > 0 ? grandTotal / txCount : 0;
  const totalHa       = paddockSummaries?.reduce((s, p) => s + (p.paddock.land_area ?? 0), 0) ?? 0;
  const costPerHa     = totalHa > 0 ? grandTotal / totalHa : 0;

  // --- Monthly trend data (computed from transactions) ---
  const monthlyData = useMemo(() => {
    if (!transactions) return [];
    const map: Record<string, { month: string; Labour: number; Fuel: number; Supplier: number }> = {};
    transactions.forEach(tx => {
      const key = format(startOfMonth(parseISO(tx.created_at)), 'yyyy-MM');
      if (!map[key]) map[key] = { month: format(startOfMonth(parseISO(tx.created_at)), 'MMM yy'), Labour: 0, Fuel: 0, Supplier: 0 };
      if (tx.source === 'labour')   map[key].Labour   += tx.amount;
      if (tx.source === 'fuel')     map[key].Fuel     += tx.amount;
      if (tx.source === 'supplier') map[key].Supplier += tx.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, v]) => v);
  }, [transactions]);

  // --- Pie chart data ---
  const pieData = [
    { name: 'Labour', value: totalLabour, color: '#3b82f6' },
    { name: 'Fuel', value: totalFuel, color: '#f97316' },
    { name: 'Supplier', value: totalSupplier, color: '#a855f7' },
  ].filter(d => d.value > 0);

  // --- Paddock chart data ---
  const chartData = paddockSummaries?.slice(0, 8).map(p => ({
    name: p.paddock.name.length > 10 ? p.paddock.name.slice(0, 10) + '…' : p.paddock.name,
    Labour: p.total_labour_cost,
    Fuel: p.total_fuel_cost,
    Supplier: p.total_supplier_cost,
  })) ?? [];

  // --- Unique paddocks for filter ---
  const uniquePaddocks = useMemo(() => {
    const set = new Map<string, string>();
    transactions?.forEach(tx => {
      if (tx.paddock_id && tx.paddock?.name) set.set(tx.paddock_id, tx.paddock.name);
    });
    return Array.from(set.entries());
  }, [transactions]);

  // --- Filtered transactions ---
  const filtered = useMemo(() => {
    let list = transactions ?? [];
    if (sourceFilter !== 'all') list = list.filter(t => t.source === sourceFilter);
    if (paddockFilter !== 'all') list = list.filter(t => t.paddock_id === paddockFilter);
    return list;
  }, [transactions, sourceFilter, paddockFilter]);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Finance"
          subtitle="Paddock cost breakdown and financial analysis"
          action={
            <button
              onClick={() => transactions && exportCSV(filtered)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          }
        />

        {/* Summary stats row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard title="Total Costs" value={formatCurrency(grandTotal)} icon={DollarSign} iconColor="text-red-500" />
          <StatCard title="This Month" value={formatCurrency(
            transactions?.filter(t => {
              const d = new Date(t.created_at);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).reduce((s, t) => s + t.amount, 0) ?? 0
          )} icon={TrendingDown} iconColor="text-gray-500" />
          <StatCard title="Transactions" value={txCount} subtitle={`Avg ${formatCurrency(avgTx)} each`} icon={Hash} iconColor="text-gray-500" />
          <StatCard title="Cost / Hectare" value={costPerHa > 0 ? formatCurrency(costPerHa) : '—'} subtitle={`${totalHa.toFixed(1)} ha total`} icon={DollarSign} iconColor="text-farm-600" />
        </div>

        {/* Summary stats row 2 — source breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Labour</p>
              <p className="text-base font-bold text-gray-900">{formatCurrency(totalLabour)}</p>
              <p className="text-xs text-blue-600">{grandTotal > 0 ? Math.round(totalLabour / grandTotal * 100) : 0}% of total</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <Fuel className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Fuel</p>
              <p className="text-base font-bold text-gray-900">{formatCurrency(totalFuel)}</p>
              <p className="text-xs text-orange-600">{grandTotal > 0 ? Math.round(totalFuel / grandTotal * 100) : 0}% of total</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Supplier</p>
              <p className="text-base font-bold text-gray-900">{formatCurrency(totalSupplier)}</p>
              <p className="text-xs text-purple-600">{grandTotal > 0 ? Math.round(totalSupplier / grandTotal * 100) : 0}% of total</p>
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Cost by paddock bar chart */}
          <div className="lg:col-span-2 card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Cost by Paddock</h2>
            {psLoading ? <Spinner /> : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Labour" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="Fuel" stackId="a" fill="#f97316" />
                  <Bar dataKey="Supplier" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="text-center py-12 text-gray-400 text-sm">No cost data yet</div>}
          </div>

          {/* Pie chart */}
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Cost Distribution</h2>
            {pieData.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                        <span className="text-gray-600">{d.name}</span>
                      </div>
                      <span className="font-medium text-gray-900">{grandTotal > 0 ? Math.round(d.value / grandTotal * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="text-center py-12 text-gray-400 text-sm">No data</div>}
          </div>
        </div>

        {/* Monthly trend */}
        {monthlyData.length > 1 && (
          <div className="card mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Monthly Cost Trend</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Labour" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Fuel" stroke="#f97316" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Supplier" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Paddock P&L table */}
        <div className="card p-0 overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Paddock Cost Summary</h2>
          </div>
          {psLoading ? <div className="p-4"><Spinner /></div> : paddockSummaries && paddockSummaries.length > 0 ? (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Paddock', 'Crop', 'Labour', 'Fuel', 'Supplies', 'Total', '$/ha'].map(h => (
                    <th key={h} className="text-right first:text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paddockSummaries.map(p => {
                  const cph = p.paddock.land_area && p.paddock.land_area > 0
                    ? p.total_cost / p.paddock.land_area
                    : null;
                  return (
                    <tr key={p.paddock.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{p.paddock.name}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{p.paddock.crop_type ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(p.total_labour_cost)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(p.total_fuel_cost)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(p.total_supplier_cost)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-900">{formatCurrency(p.total_cost)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{cph ? formatCurrency(cph) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          ) : <div className="text-center py-12 text-gray-400 text-sm">No financial data yet</div>}
        </div>

        {/* All Transactions with filters */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <h2 className="text-base font-semibold text-gray-900">All Transactions</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-gray-400" />
              {/* Source filter */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                {(['all', 'labour', 'fuel', 'supplier'] as SourceFilter[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setSourceFilter(s)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      sourceFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {s === 'all' ? 'All' : SOURCE_LABELS[s]}
                  </button>
                ))}
              </div>
              {/* Paddock filter */}
              <select
                value={paddockFilter}
                onChange={e => setPaddockFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-farm-500"
              >
                <option value="all">All Paddocks</option>
                {uniquePaddocks.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <span className="text-xs text-gray-400">{filtered.length} records</span>
            </div>
          </div>
          {txLoading ? <div className="p-4"><Spinner /></div> : filtered.length > 0 ? (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Date', 'Source', 'Paddock', 'Detail', 'Amount'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(tx => {
                  const detail = tx.source === 'supplier'
                    ? (tx.product_name ?? '—')
                    : tx.source === 'labour'
                    ? (tx.staff_name ?? '—')
                    : tx.fuel_litres ? `${tx.fuel_litres}L` : '—';
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(tx.created_at)}</td>
                      <td className="px-4 py-2.5"><SourceBadge source={tx.source} /></td>
                      <td className="px-4 py-2.5 text-gray-700">{tx.paddock?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{detail}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900 text-right">{formatCurrency(tx.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          ) : <div className="text-center py-12 text-gray-400 text-sm">No transactions match your filters</div>}
        </div>
      </div>
    </AppLayout>
  );
}
