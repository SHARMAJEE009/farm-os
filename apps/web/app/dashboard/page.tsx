'use client';

import { useQuery } from '@tanstack/react-query';
import { Map, DollarSign, AlertCircle, ShoppingCart, Leaf, TrendingUp, Users, Fuel, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { DashboardStats, PaddockSummary, FinancialTransaction } from '@/types';
import AppLayout from '@/components/layout/AppLayout';

const sourceConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  labour:   { icon: Users,        color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'Labour'   },
  fuel:     { icon: Fuel,         color: 'text-orange-600', bg: 'bg-orange-50', label: 'Fuel'     },
  supplier: { icon: Package,      color: 'text-purple-600', bg: 'bg-purple-50', label: 'Supplier' },
};

function TransactionRow({ tx }: { tx: FinancialTransaction }) {
  const cfg = sourceConfig[tx.source] ?? sourceConfig.labour;
  const Icon = cfg.icon;

  const detail = tx.source === 'supplier'
    ? tx.product_name ?? 'Product order'
    : tx.source === 'labour'
    ? tx.staff_name ?? 'Staff hours'
    : `${tx.fuel_litres ? tx.fuel_litres + 'L · ' : ''}Fuel usage`;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{detail}</p>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate">
          {tx.paddock?.name ?? 'Unknown paddock'}
          {tx.source === 'supplier' && tx.supplier_name ? ` · ${tx.supplier_name}` : ''}
          {' · '}{formatDate(tx.created_at)}
        </p>
      </div>
      <p className="text-sm font-bold text-gray-900 flex-shrink-0">{formatCurrency(tx.amount)}</p>
    </div>
  );
}

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
              <div className="space-y-1">
                {paddockSummaries.slice(0, 6).map((p) => {
                  const total = p.total_cost;
                  const labourPct = total > 0 ? Math.round(p.total_labour_cost / total * 100) : 0;
                  return (
                    <div key={p.paddock.id} className="py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.paddock.name}</p>
                          <p className="text-xs text-gray-400">
                            {p.paddock.crop_type || 'No crop'} · {p.paddock.land_area ?? '?'} ha
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(total)}</p>
                          <p className="text-xs text-gray-400">
                            {p.open_recommendations} recs · {p.pending_orders} orders
                          </p>
                        </div>
                      </div>
                      {/* Mini cost bar */}
                      {total > 0 && (
                        <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
                          <div className="bg-blue-400" style={{ width: `${labourPct}%` }} />
                          <div className="bg-orange-400" style={{ width: `${total > 0 ? Math.round(p.total_fuel_cost/total*100) : 0}%` }} />
                          <div className="bg-purple-400" style={{ width: `${total > 0 ? Math.round(p.total_supplier_cost/total*100) : 0}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="flex gap-4 pt-2">
                  {[['bg-blue-400','Labour'],['bg-orange-400','Fuel'],['bg-purple-400','Supplier']].map(([c,l]) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-sm ${c}`} />
                      <span className="text-xs text-gray-400">{l}</span>
                    </div>
                  ))}
                </div>
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
              <div>
                {stats.recent_transactions.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
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
