'use client';

import { TrendingUp, Sparkles, BarChart2, Calendar, Cpu } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

const FEATURES = [
  { icon: BarChart2, label: 'Cost Projections',      desc: '3-month rolling forecast by paddock and category' },
  { icon: Calendar,  label: 'Seasonal Planning',     desc: 'Plan labour, fuel and supply spend across seasons' },
  { icon: Cpu,       label: 'AI-Powered Insights',   desc: 'Smart recommendations based on historical patterns' },
  { icon: TrendingUp,label: 'Trend Analysis',        desc: 'Visualise cost trends and identify anomalies early' },
];

export default function ForecastingPage() {
  return (
    <AppLayout>
      <div className="p-4 sm:p-6 flex flex-col items-center justify-center min-h-[calc(100vh-56px)] lg:min-h-screen">

        {/* Icon badge */}
        <div className="w-20 h-20 bg-gradient-to-br from-farm-500 to-farm-700 rounded-3xl flex items-center justify-center shadow-xl mb-6">
          <TrendingUp className="w-10 h-10 text-white" />
        </div>

        {/* Heading */}
        <div className="text-center mb-8 max-w-md">
          <div className="inline-flex items-center gap-1.5 bg-farm-50 text-farm-700 text-xs font-semibold px-3 py-1 rounded-full mb-3 border border-farm-200">
            <Sparkles className="w-3 h-3" />
            Coming Soon
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Forecasting</h1>
          <p className="text-gray-500 text-sm sm:text-base leading-relaxed">
            Powerful cost forecasting and planning tools are on the way. Get ahead of your farm expenses with data-driven projections.
          </p>
        </div>

        {/* Feature preview cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl mb-8">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-3 shadow-sm opacity-70"
            >
              <div className="w-9 h-9 rounded-lg bg-farm-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4.5 h-4.5 text-farm-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-400 text-center">
          We're building something great. Check back soon.
        </p>

      </div>
    </AppLayout>
  );
}
