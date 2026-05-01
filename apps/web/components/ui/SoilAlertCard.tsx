'use client';

import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

interface SoilAlert {
  nutrient: string;
  value: string;
  status: string;
  message: string;
}

interface SoilAlertCardProps {
  alert: SoilAlert;
}

const STATUS_CONFIG: Record<string, { border: string; bg: string; icon: typeof AlertTriangle; iconColor: string; badgeBg: string; badgeText: string }> = {
  low:        { border: 'border-red-200',    bg: 'bg-red-50',    icon: AlertTriangle, iconColor: 'text-red-500',    badgeBg: 'bg-red-100',    badgeText: 'text-red-700' },
  marginal:   { border: 'border-amber-200',  bg: 'bg-amber-50',  icon: AlertCircle,   iconColor: 'text-amber-500',  badgeBg: 'bg-amber-100',  badgeText: 'text-amber-700' },
  sufficient: { border: 'border-green-200',  bg: 'bg-green-50',  icon: CheckCircle,   iconColor: 'text-green-500',  badgeBg: 'bg-green-100',  badgeText: 'text-green-700' },
  high:       { border: 'border-green-200',  bg: 'bg-green-50',  icon: CheckCircle,   iconColor: 'text-green-500',  badgeBg: 'bg-green-100',  badgeText: 'text-green-700' },
};

export function SoilAlertCard({ alert }: SoilAlertCardProps) {
  const config = STATUS_CONFIG[alert.status] || STATUS_CONFIG.marginal;
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4 transition-all hover:shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${config.iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900 text-sm">{alert.nutrient}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeBg} ${config.badgeText}`}>
              {alert.status}
            </span>
          </div>
          <p className="text-xs text-gray-600 mb-1">Value: <span className="font-medium">{alert.value}</span></p>
          <p className="text-sm text-gray-700 leading-relaxed">{alert.message}</p>
        </div>
      </div>
    </div>
  );
}
