import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatNumber(value: number, decimals = 1): string {
  return value.toFixed(decimals);
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending:   'badge-pending',
    draft:     'badge-pending',
    ordered:   'badge-active',
    approved:  'badge-active',
    delivered: 'badge-delivered',
    completed: 'badge-delivered',
    rejected:  'badge-rejected',
    failed:    'badge-rejected',
    refunded:  'badge-rejected',
  };
  return map[status] ?? 'badge-pending';
}
