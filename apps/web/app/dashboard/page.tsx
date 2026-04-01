'use client';

import { useQuery } from '@tanstack/react-query';
import { Map, Users, DollarSign, AlertCircle, ShoppingCart, Leaf, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import type { DashboardStats, PaddockSummary } from '@/types';
import AppLayout from '@/components/layout/AppLayout';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
  });

  const { data: paddockSummaries, isLoading: paddocksLoading } = useQuery<PaddockSummary[]>({
    queryKey: ['paddock-summaries'],
    queryFn: () => api.get('/dashboard/paddock-summaries').then(r => r.data),
  });

  return (
    <AppLayout>
      <div className="p-6">
        <PageHeader
          title="Dashboard"
          subtitle="Overview of your farm operations"
        />

        {/* Stats grid */}
        {statsLoading ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Total Paddocks"
              value={stats?.total_paddocks ?? 0}
              subtitle={`${stats?.total_hectares?.toFixed(1) ?? 0} ha total`}
              icon={Map}
              iconColor="text-farm-600"
            />
            <StatCard
              title="Cost This Month"
              value={formatCurrency(stats?.total_cost_this_month ?? 0)}
              subtitle="Labour + Fuel + Supplies"
              icon={DollarSign}
              iconColor="text-orange-500"
            />
            <StatCard
              title="Open Recommendations"
              value={stats?.pending_recommendations ?? 0}
              subtitle="Awaiting approval"
              icon={Leaf}
              iconColor="text-emerald-600"
            />
            <StatCard
              title="Pending Orders"
              value={stats?.pending_orders ?? 0}
              subtitle="Supplier orders"
              icon={ShoppingCart}
              iconColor="text-blue-500"
            />
          </div>
        )}

        {/* Paddock cost breakdown */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-farm-600" />
              Paddock Cost Summary
            </h2>
            {paddocksLoading ? (
              <Spinner />
            ) : paddockSummaries && paddockSummaries.length > 0 ? (
              <div className="space-y-3">
                {paddockSummaries.slice(0, 6).map((p) => (
                  <div key={p.paddock.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.paddock.name}</p>
                      <p className="text-xs text-gray-400">
                        {p.paddock.crop_type || 'No crop'} · {p.paddock.area_hectares ?? '?'} ha
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(p.total_cost)}</p>
                      <p className="text-xs text-gray-400">
                        {p.open_recommendations} recs · {p.pending_orders} orders
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-6 text-center">No paddock data yet</p>
            )}
          </div>

          {/* Recent transactions */}
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-farm-600" />
              Recent Transactions
            </h2>
            {statsLoading ? (
              <Spinner />
            ) : stats?.recent_transactions && stats.recent_transactions.length > 0 ? (
              <div className="space-y-3">
                {stats.recent_transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{tx.source}</p>
                      <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(tx.amount)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-6 text-center">No transactions yet</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
