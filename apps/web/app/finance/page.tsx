'use client';

import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingDown, Users, Fuel, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { StatCard } from '@/components/ui/StatCard';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { FinancialTransaction, PaddockSummary } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function FinancePage() {
  const { data: transactions, isLoading: txLoading } = useQuery<FinancialTransaction[]>({
    queryKey: ['financial-transactions'],
    queryFn: () => api.get('/financial-transactions').then(r => r.data),
  });

  const { data: paddockSummaries, isLoading: psLoading } = useQuery<PaddockSummary[]>({
    queryKey: ['paddock-summaries'],
    queryFn: () => api.get('/dashboard/paddock-summaries').then(r => r.data),
  });

  const totalLabour = transactions?.filter(t => t.source === 'labour').reduce((s, t) => s + t.amount, 0) ?? 0;
  const totalFuel = transactions?.filter(t => t.source === 'fuel').reduce((s, t) => s + t.amount, 0) ?? 0;
  const totalSupplier = transactions?.filter(t => t.source === 'supplier').reduce((s, t) => s + t.amount, 0) ?? 0;
  const grandTotal = totalLabour + totalFuel + totalSupplier;

  const chartData = paddockSummaries?.slice(0, 8).map(p => ({
    name: p.paddock.name.length > 10 ? p.paddock.name.slice(0, 10) + '…' : p.paddock.name,
    Labour: p.total_labour_cost,
    Fuel: p.total_fuel_cost,
    Supplier: p.total_supplier_cost,
  })) ?? [];

  return (
    <AppLayout>
      <div className="p-6">
        <PageHeader
          title="Finance"
          subtitle="Paddock cost breakdown and financial summary"
        />

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Costs" value={formatCurrency(grandTotal)} icon={DollarSign} iconColor="text-red-500" />
          <StatCard title="Labour Costs" value={formatCurrency(totalLabour)} icon={Users} iconColor="text-blue-500" />
          <StatCard title="Fuel Costs" value={formatCurrency(totalFuel)} icon={Fuel} iconColor="text-orange-500" />
          <StatCard title="Supplier Costs" value={formatCurrency(totalSupplier)} icon={ShoppingCart} iconColor="text-purple-500" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Cost by paddock chart */}
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Cost by Paddock</h2>
            {psLoading ? (
              <Spinner />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Labour" stackId="a" fill="#3b82f6" radius={[0,0,0,0]} />
                  <Bar dataKey="Fuel" stackId="a" fill="#f97316" radius={[0,0,0,0]} />
                  <Bar dataKey="Supplier" stackId="a" fill="#a855f7" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-400 text-sm">No cost data yet</div>
            )}
          </div>

          {/* Paddock P&L table */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Paddock Cost Summary</h2>
            </div>
            {psLoading ? (
              <div className="p-4"><Spinner /></div>
            ) : paddockSummaries && paddockSummaries.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Paddock', 'Labour', 'Fuel', 'Supplies', 'Total'].map(h => (
                      <th key={h} className="text-right first:text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paddockSummaries.map(p => (
                    <tr key={p.paddock.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{p.paddock.name}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(p.total_labour_cost)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(p.total_fuel_cost)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(p.total_supplier_cost)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-900">{formatCurrency(p.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-gray-400 text-sm">No financial data yet</div>
            )}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="card mt-6 p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">All Transactions</h2>
          </div>
          {txLoading ? (
            <div className="p-4"><Spinner /></div>
          ) : transactions && transactions.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Paddock', 'Source', 'Amount', 'Date'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-gray-700">{tx.paddock?.name ?? tx.paddock_id}</td>
                    <td className="px-4 py-2.5 capitalize text-gray-500">{tx.source}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900">{formatCurrency(tx.amount)}</td>
                    <td className="px-4 py-2.5 text-gray-400">{formatDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">No transactions yet</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
