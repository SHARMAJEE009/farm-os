'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { useFarm } from '@/lib/farm-context';
import { api } from '@/lib/api';
import { Building2 } from 'lucide-react';
import type { Farm } from '@/types';

function FarmNameBar() {
  const { activeFarmId, setActiveFarmId } = useFarm();

  const { data: farms } = useQuery<Farm[]>({
    queryKey: ['farms'],
    queryFn: () => api.get('/farms').then(r => r.data),
  });

  // Auto-select first farm; also reset if cookie has a stale/invalid ID
  useEffect(() => {
    if (farms && farms.length > 0) {
      const valid = activeFarmId && farms.some(f => f.id === activeFarmId);
      if (!valid) setActiveFarmId(farms[0].id);
    }
  }, [farms, activeFarmId, setActiveFarmId]);

  const farm = farms?.find(f => f.id === activeFarmId) ?? farms?.[0];
  if (!farm) return null;

  return (
    <div className="hidden lg:flex items-center border-b border-gray-200 bg-white px-6 py-2.5 gap-2.5 sticky top-0 z-20">
      <Building2 className="w-4 h-4 text-farm-600 flex-shrink-0" />
      <span className="text-sm font-semibold text-farm-800">{farm.name}</span>
      {(farm.location || farm.state) && (
        <span className="text-xs text-gray-400">
          · {[farm.location, farm.state, farm.postcode].filter(Boolean).join(', ')}
        </span>
      )}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden lg:overflow-auto">
        <div className="pt-14 lg:pt-0 min-h-screen flex flex-col">
          <FarmNameBar />
          {children}
        </div>
      </main>
    </div>
  );
}
