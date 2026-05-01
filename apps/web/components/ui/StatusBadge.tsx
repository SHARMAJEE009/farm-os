'use client';

interface StatusBadgeProps {
  status: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  uploaded:      { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Uploaded' },
  processing:    { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Processing' },
  ai_processed:  { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'AI Processed' },
  failed:        { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Failed' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.uploaded;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.text.replace('text-', 'bg-')}`} />
      {style.label}
    </span>
  );
}
