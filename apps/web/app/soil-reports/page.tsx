'use client';

import { useState } from 'react';
import { useFarm } from '@/lib/farm-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Sparkles, Eye, Loader2, MapPin, Sprout, Calendar,
  FileText, User, Leaf, Building2
} from 'lucide-react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RecommendationPanel } from '@/components/ui/RecommendationPanel';
import { formatDate } from '@/lib/utils';
import AppLayout from '@/components/layout/AppLayout';
import { getRole } from '@/lib/role';
import Link from 'next/link';

interface SoilReport {
  id: string;
  paddock_id: string;
  farm_id: string;
  file_name: string;
  file_path: string;
  season: string;
  status: string;
  paddock_name: string;
  farm_name: string;
  land_area: number;
  crop_type: string;
  uploaded_by_name: string;
  created_at: string;
  ai_recommendation: any;
}

interface Farm {
  id: string;
  name: string;
}

export default function SoilReportsPage() {
  const qc = useQueryClient();
  const { activeFarmId } = useFarm();
  const role = getRole();
  const isOwner = role === 'owner';

  const [selectedFarmFilter, setSelectedFarmFilter] = useState(activeFarmId || '');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelReport, setPanelReport] = useState<SoilReport | null>(null);
  const [panelRecommendation, setPanelRecommendation] = useState<any>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Fetch farms for filter
  const { data: farms } = useQuery<Farm[]>({
    queryKey: ['farms'],
    queryFn: () => api.get('/farms').then(r => r.data),
  });

  // Fetch soil reports
  const farmIdToFetch = selectedFarmFilter || activeFarmId;
  const { data: reports, isLoading } = useQuery<SoilReport[]>({
    queryKey: ['soil-reports', isOwner ? 'all' : farmIdToFetch],
    queryFn: () => {
      if (isOwner && !selectedFarmFilter) {
        return api.get('/agronomy/soil-reports/all').then(r => r.data);
      }
      return api.get(`/agronomy/soil-reports/farm/${farmIdToFetch}`).then(r => r.data);
    },
    enabled: isOwner || !!farmIdToFetch,
  });

  // Generate AI recommendation
  const handleGenerate = async (reportId: string) => {
    setGeneratingId(reportId);
    try {
      await api.post(`/recommendations/generate/${reportId}`);
      qc.invalidateQueries({ queryKey: ['soil-reports'] });
    } catch (err) {
      console.error('Generation failed:', err);
      alert('Failed to generate AI recommendation. Please try again.');
    } finally {
      setGeneratingId(null);
    }
  };

  // View recommendation
  const handleView = async (report: SoilReport) => {
    try {
      const res = await api.get(`/recommendations/view/${report.id}`);
      setPanelReport(report);
      setPanelRecommendation(res.data.ai_recommendation);
      setPanelOpen(true);
    } catch (err) {
      console.error('Failed to load recommendation:', err);
    }
  };

  const farmName = farms?.find(f => f.id === farmIdToFetch)?.name || 'All Farms';

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <Link href="/farms" className="text-sm text-farm-600 hover:text-farm-700 flex items-center gap-1 mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Farms
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-farm-100 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-farm-600" />
              </div>
              Soil Reports {!isOwner && `— ${farmName}`}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Review soil analyses and generate AI recommendations</p>
          </div>

          {/* Farm filter (admin view) */}
          {isOwner && (
            <select
              value={selectedFarmFilter}
              onChange={e => setSelectedFarmFilter(e.target.value)}
              className="input w-64"
            >
              <option value="">All Farms</option>
              {farms?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
        </div>

        {/* Reports Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : reports && reports.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {reports.map(report => (
              <div
                key={report.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Status bar */}
                <div className={`h-1 ${
                  report.status === 'ai_processed' ? 'bg-emerald-500' :
                  report.status === 'processing' ? 'bg-amber-400' :
                  report.status === 'failed' ? 'bg-red-500' :
                  'bg-blue-400'
                }`} />

                <div className="p-5">
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                        <Sprout className="w-5 h-5 text-farm-500" />
                        {report.paddock_name || 'Unknown Paddock'}
                      </h3>
                      {isOwner && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {report.farm_name}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={report.status} />
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    {report.land_area && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {report.land_area} ha
                      </div>
                    )}
                    {report.crop_type && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Leaf className="w-3.5 h-3.5 text-gray-400" />
                        {report.crop_type}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {report.season || '—'}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <FileText className="w-3.5 h-3.5 text-gray-400" />
                      {formatDate(report.created_at)}
                    </div>
                    {report.uploaded_by_name && (
                      <div className="flex items-center gap-2 text-gray-600 col-span-2">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        Uploaded by {report.uploaded_by_name}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-3 border-t border-gray-100">
                    {report.status === 'uploaded' && (
                      <button
                        onClick={() => handleGenerate(report.id)}
                        disabled={generatingId === report.id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-60"
                      >
                        {generatingId === report.id ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                        ) : (
                          <><Sparkles className="w-4 h-4" /> Generate AI Recommendation</>
                        )}
                      </button>
                    )}
                    {report.status === 'processing' && (
                      <button disabled className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-100 text-amber-700 rounded-xl font-medium text-sm cursor-not-allowed">
                        <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                      </button>
                    )}
                    {report.status === 'ai_processed' && (
                      <button
                        onClick={() => handleView(report)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium text-sm"
                      >
                        <Eye className="w-4 h-4" /> View Recommendation
                      </button>
                    )}
                    {report.status === 'failed' && (
                      <button
                        onClick={() => handleGenerate(report.id)}
                        disabled={generatingId === report.id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 transition-colors font-medium text-sm"
                      >
                        <Sparkles className="w-4 h-4" /> Retry Generation
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
            <div className="w-16 h-16 bg-farm-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-farm-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No soil reports found</h3>
            <p className="text-sm text-gray-500">
              {isOwner ? 'No agronomists have uploaded soil reports yet.' : 'Ask your agronomist to upload soil report PDFs.'}
            </p>
          </div>
        )}

        {/* Recommendation Panel */}
        <RecommendationPanel
          recommendation={panelRecommendation}
          paddockName={panelReport?.paddock_name || ''}
          season={panelReport?.season || ''}
          isOpen={panelOpen}
          onClose={() => { setPanelOpen(false); setPanelReport(null); setPanelRecommendation(null); }}
        />
      </div>
    </AppLayout>
  );
}
