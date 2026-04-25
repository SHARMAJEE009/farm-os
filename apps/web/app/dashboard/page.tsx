'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import {
  DollarSign, AlertCircle, ShoppingCart, Leaf,
  Users, Fuel, Package, CheckCircle2, ArrowRight, Clock,
  Sprout, Tractor, TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { DashboardStats, FinancialTransaction, PaddockSummary } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { getRole, UserRole } from '@/lib/role';
import { useFarm } from '@/lib/farm-context';

// ── helpers ──────────────────────────────────────────────────────────────────
const sourceConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  labour:   { icon: Users,   color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'Labour'   },
  fuel:     { icon: Fuel,    color: 'text-orange-600', bg: 'bg-orange-50', label: 'Fuel'     },
  supplier: { icon: Package, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Supplier' },
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

// ── Workflow Tracker ──────────────────────────────────────────────────────────
function WorkflowTracker({ stats }: { stats: DashboardStats }) {
  const steps = [
    {
      icon: Sprout,
      label: 'Recommendations',
      desc: 'Agronomist advice created',
      value: stats.pending_recommendations,
      unit: 'pending',
      done: true,
      color: 'bg-blue-500',
      light: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      icon: CheckCircle2,
      label: 'Approval',
      desc: 'Manager review',
      value: stats.pending_recommendations,
      unit: 'awaiting',
      done: stats.pending_recommendations === 0,
      color: 'bg-indigo-500',
      light: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
      icon: ShoppingCart,
      label: 'Supplier Orders',
      desc: 'Materials ordered',
      value: stats.pending_orders,
      unit: 'pending',
      done: stats.pending_orders === 0,
      color: 'bg-purple-500',
      light: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    {
      icon: Users,
      label: 'Staff Work',
      desc: 'Hours & fuel logged',
      value: null,
      unit: '',
      done: true,
      color: 'bg-orange-500',
      light: 'bg-orange-50 text-orange-700 border-orange-200',
    },
    {
      icon: DollarSign,
      label: 'Costs Rolled Up',
      desc: 'Into paddock dashboard',
      value: null,
      unit: '',
      done: stats.total_cost_this_month > 0,
      color: 'bg-emerald-500',
      light: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  ];

  return (
    <div className="card mb-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Tractor className="w-4 h-4 text-farm-600" />
        Farm Operations Workflow
      </h2>

      <div className="flex items-start gap-0 overflow-x-auto pb-2">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex items-start flex-shrink-0">
              {/* Step card */}
              <div className="flex flex-col items-center w-28 sm:w-32">
                {/* Icon circle */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${step.done ? step.color : 'bg-gray-200'}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs font-semibold text-gray-800 text-center leading-tight">{step.label}</p>
                <p className="text-[10px] text-gray-400 text-center mt-0.5 leading-tight">{step.desc}</p>
                {step.value !== null && (
                  <span className={`mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${step.light}`}>
                    {step.value} {step.unit}
                  </span>
                )}
                {step.done && step.value === null && (
                  <span className="mt-1.5 inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                )}
              </div>

              {/* Arrow connector */}
              {i < steps.length - 1 && (
                <div className="flex items-center mt-4 mx-1 flex-shrink-0">
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Role-based dashboard panels ───────────────────────────────────────────────
function AdminDashboard({ stats, statsLoading }: any) {
  return (
    <>
      {statsLoading ? <Spinner /> : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard title="Cost This Month"       value={formatCurrency(stats?.total_cost_this_month ?? 0)} subtitle="Labour + Fuel + Supplies" icon={DollarSign}   iconColor="text-orange-500" />
          <StatCard title="Open Recommendations" value={stats?.pending_recommendations ?? 0}             subtitle="Awaiting approval"          icon={Leaf}         iconColor="text-emerald-600" />
          <StatCard title="Pending Orders"        value={stats?.pending_orders ?? 0}                      subtitle="Supplier orders"            icon={ShoppingCart} iconColor="text-blue-500" />
        </div>
      )}
      {stats && <WorkflowTracker stats={stats} />}
      <RecentTransactionsCard stats={stats} isLoading={statsLoading} />
    </>
  );
}

function ManagerDashboard({ stats, statsLoading }: any) {
  return (
    <>
      {statsLoading ? <Spinner /> : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard title="Cost This Month"    value={formatCurrency(stats?.total_cost_this_month ?? 0)} subtitle="Labour + Fuel + Supplies"    icon={DollarSign}   iconColor="text-orange-500" />
          <StatCard title="Pending Approvals" value={stats?.pending_recommendations ?? 0}             subtitle="Recommendations to review"    icon={AlertCircle}  iconColor="text-yellow-500" />
          <StatCard title="Pending Orders"     value={stats?.pending_orders ?? 0}                      subtitle="Supplier orders"              icon={ShoppingCart} iconColor="text-blue-500" />
        </div>
      )}
      {stats && <WorkflowTracker stats={stats} />}
      <RecentTransactionsCard stats={stats} isLoading={statsLoading} />
    </>
  );
}

function AgronomistDashboard({ stats, statsLoading }: any) {
  return (
    <>
      {statsLoading ? <Spinner /> : (
        <div className="grid grid-cols-1 gap-4 mb-6">
          <StatCard title="My Recommendations" value={stats?.pending_recommendations ?? 0} subtitle="Drafts awaiting approval" icon={Sprout} iconColor="text-emerald-600" />
        </div>
      )}
      <RecentTransactionsCard stats={stats} isLoading={statsLoading} />
    </>
  );
}

function StaffDashboard({ stats, statsLoading }: any) {
  return (
    <>
      {statsLoading ? <Spinner /> : (
        <div className="grid grid-cols-1 gap-4 mb-6">
          <StatCard title="Pending Tasks" value={stats?.pending_orders ?? 0} subtitle="Supplier orders" icon={Clock} iconColor="text-orange-500" />
        </div>
      )}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-farm-600" />
          Your Role
        </h2>
        <div className="space-y-2">
          {[
            { icon: '⏱️', text: 'Log your daily work hours in the Staff module' },
            { icon: '⛽', text: 'Record fuel usage per paddock' },
            { icon: '🌾', text: 'View paddock details and assigned tasks' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-xl">{item.icon}</span>
              <p className="text-sm text-gray-700">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SupplierDashboard({ stats, statsLoading }: any) {
  return (
    <>
      {statsLoading ? <Spinner /> : (
        <div className="grid grid-cols-1 gap-4 mb-6">
          <StatCard title="Pending Orders" value={stats?.pending_orders ?? 0} subtitle="Awaiting action" icon={ShoppingCart} iconColor="text-blue-500" />
        </div>
      )}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-farm-600" />
          Your Access
        </h2>
        <div className="space-y-2">
          {[
            { icon: '📦', text: 'View and manage your assigned supply orders' },
            { icon: '✅', text: 'Mark orders as delivered once fulfilled' },
            { icon: '📰', text: 'Stay updated with latest agriculture news' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-xl">{item.icon}</span>
              <p className="text-sm text-gray-700">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────
function PaddockCostCard({ summaries, isLoading }: { summaries: PaddockSummary[] | undefined; isLoading: boolean }) {
  return (
    <div className="card">
      <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-farm-600" />
        Paddock Cost Summary
      </h2>
      {isLoading ? <Spinner /> : summaries && summaries.length > 0 ? (
        <div className="space-y-1">
          {summaries.slice(0, 6).map((p) => {
            const total = p.total_cost;
            const labourPct = total > 0 ? Math.round(p.total_labour_cost / total * 100) : 0;
            return (
              <div key={p.paddock.id} className="py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.paddock.name}</p>
                    <p className="text-xs text-gray-400">{p.paddock.crop_type || 'No crop'} · {p.paddock.land_area ?? '?'} ha</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(total)}</p>
                    <p className="text-xs text-gray-400">{p.open_recommendations} recs · {p.pending_orders} orders</p>
                  </div>
                </div>
                {total > 0 && (
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
                    <div className="bg-blue-400" style={{ width: `${labourPct}%` }} />
                    <div className="bg-orange-400" style={{ width: `${total > 0 ? Math.round(p.total_fuel_cost / total * 100) : 0}%` }} />
                    <div className="bg-purple-400" style={{ width: `${total > 0 ? Math.round(p.total_supplier_cost / total * 100) : 0}%` }} />
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex gap-4 pt-2">
            {[['bg-blue-400', 'Labour'], ['bg-orange-400', 'Fuel'], ['bg-purple-400', 'Supplier']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-sm ${c}`} />
                <span className="text-xs text-gray-400">{l}</span>
              </div>
            ))}
          </div>
        </div>
      ) : <p className="text-sm text-gray-400 py-6 text-center">No paddock data yet</p>}
    </div>
  );
}

function RecentTransactionsCard({ stats, isLoading }: { stats: DashboardStats | undefined; isLoading: boolean }) {
  return (
    <div className="card">
      <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-farm-600" />
        Recent Transactions
      </h2>
      {isLoading ? <Spinner /> : stats?.recent_transactions?.length ? (
        <div>{stats.recent_transactions.map(tx => <TransactionRow key={tx.id} tx={tx} />)}</div>
      ) : <p className="text-sm text-gray-400 py-6 text-center">No transactions yet</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const ROLE_GREETINGS: Record<UserRole, string> = {
  owner:      'Farm overview — all operations at a glance',
  manager:    'Operations dashboard — manage your team & resources',
  agronomist: 'Agronomy dashboard — your paddocks & recommendations',
  staff:      'Welcome — log your hours and field work below',
  supplier:   'Supplier portal — manage your orders',
};

export default function DashboardPage() {
  const [role, setRole] = useState<UserRole>('staff');
  useEffect(() => { setRole(getRole()); }, []);

  const { activeFarmId } = useFarm();
  const farmParams = activeFarmId ? { farm_id: activeFarmId } : {};

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', activeFarmId],
    queryFn: () => api.get('/dashboard/stats', { params: farmParams }).then(r => r.data),
  });

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader title="Dashboard" subtitle={ROLE_GREETINGS[role]} />

        {role === 'owner'      && <AdminDashboard      stats={stats} statsLoading={statsLoading} />}
        {role === 'manager'    && <ManagerDashboard    stats={stats} statsLoading={statsLoading} />}
        {role === 'agronomist' && <AgronomistDashboard stats={stats} statsLoading={statsLoading} />}
        {role === 'staff'      && <StaffDashboard      stats={stats} statsLoading={statsLoading} />}
        {role === 'supplier'   && <SupplierDashboard   stats={stats} statsLoading={statsLoading} />}
      </div>
    </AppLayout>
  );
}
