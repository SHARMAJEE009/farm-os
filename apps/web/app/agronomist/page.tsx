'use client';

import { useState, useMemo } from 'react';
import { useFarm } from '@/lib/farm-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Leaf, CheckCircle, XCircle, Clock, Trash2, AlertCircle,
  Droplets, Sprout, FlaskConical, Tractor, Sun, Wheat, Microscope,
  HelpCircle, Search, ChevronDown, Map, FileText, Upload, Download, File
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import type { Recommendation, Paddock, AgronomyDocument } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';
import { getRole, isAdmin } from '@/lib/role';

type StatusFilter = 'all' | 'draft' | 'approved' | 'rejected';

interface RecForm {
  paddock_id: string;
  type: string;
  description: string;
}

const REC_TYPES = [
  'Spray', 'Fertiliser', 'Irrigation', 'Cultivation',
  'Sowing', 'Harvest', 'Soil Test', 'Other',
];

const TYPE_ICON: Record<string, React.ElementType> = {
  Spray:       Droplets,
  Fertiliser:  FlaskConical,
  Irrigation:  Droplets,
  Cultivation: Tractor,
  Sowing:      Sprout,
  Harvest:     Wheat,
  'Soil Test': Microscope,
  Other:       HelpCircle,
};

const TYPE_COLOR: Record<string, string> = {
  Spray:       'bg-blue-50 text-blue-600',
  Fertiliser:  'bg-emerald-50 text-emerald-600',
  Irrigation:  'bg-cyan-50 text-cyan-600',
  Cultivation: 'bg-orange-50 text-orange-600',
  Sowing:      'bg-lime-50 text-lime-600',
  Harvest:     'bg-yellow-50 text-yellow-600',
  'Soil Test': 'bg-amber-50 text-amber-600',
  Other:       'bg-gray-50 text-gray-500',
};

const STATUS_CONFIG = {
  draft:    { label: 'Draft',    icon: Clock,        bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200', dot: 'bg-yellow-400' },
  approved: { label: 'Approved', icon: CheckCircle,  bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',  dot: 'bg-green-500'  },
  rejected: { label: 'Rejected', icon: XCircle,      bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',    dot: 'bg-red-500'    },
} as const;

// ── Recommendation card ─────────────────────────────────────────────────────
function RecCard({ rec, onApprove, onReject, onDelete, isUpdating, canApprove }: {
  rec: Recommendation;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  isUpdating: boolean;
  canApprove: boolean;
}) {
  const cfg = STATUS_CONFIG[rec.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;
  const TypeIcon = TYPE_ICON[rec.type] ?? HelpCircle;
  const typeColor = TYPE_COLOR[rec.type] ?? TYPE_COLOR.Other;

  return (
    <div className={`bg-white rounded-xl border ${cfg.border} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden`}>
      <div className={`h-1 ${cfg.dot === 'bg-yellow-400' ? 'bg-yellow-400' : cfg.dot === 'bg-green-500' ? 'bg-green-500' : 'bg-red-500'}`} />
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColor}`}>
            <TypeIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 text-sm">{rec.type}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                <StatusIcon className="w-3 h-3" />{cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Leaf className="w-3 h-3 text-farm-500 flex-shrink-0" />
              <span className="text-xs font-medium text-farm-700 truncate">{rec.paddock?.name ?? rec.paddock_id}</span>
            </div>
          </div>
          <button onClick={onDelete} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {rec.description && (
          <p className="mt-3 text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-line">
            {rec.description}
          </p>
        )}

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-xs text-gray-400">{formatDate(rec.created_at)}</span>
          {rec.status === 'draft' && canApprove && (
            <div className="flex gap-2">
              <button onClick={onReject} disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                <XCircle className="w-3.5 h-3.5" />Reject
              </button>
              <button onClick={onApprove} disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                <CheckCircle className="w-3.5 h-3.5" />Accept
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Document Section ────────────────────────────────────────────────────────
function DocumentSection({ paddockId, title, documentType, isAgronomist }: { 
  paddockId: string, 
  title: string, 
  documentType: 'soil_report' | 'planned_financials',
  isAgronomist: boolean 
}) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: documents, isLoading } = useQuery<AgronomyDocument[]>({
    queryKey: ['agronomy-docs', paddockId],
    queryFn: () => api.get(`/agronomy/documents/${paddockId}`).then(r => r.data),
  });

  const docs = documents?.filter(d => d.document_type === documentType) || [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('paddock_id', paddockId);
    formData.append('document_type', documentType);

    try {
      await api.post('/agronomy/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      qc.invalidateQueries({ queryKey: ['agronomy-docs', paddockId] });
    } catch (err) {
      alert('Failed to upload document');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/agronomy/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agronomy-docs', paddockId] }),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-farm-600" />
          {title}
        </h3>
        {isAgronomist && (
          <label className="btn-secondary text-xs px-3 py-1.5 cursor-pointer flex items-center gap-2">
            <Upload className="w-3.5 h-3.5" /> {uploading ? 'Uploading…' : 'Upload'}
            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : docs.length > 0 ? (
        <div className="space-y-3">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 bg-white rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                  <File className="w-5 h-5 text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                  <p className="text-xs text-gray-500">Uploaded {formatDate(doc.created_at)} by {doc.uploaded_by_name || 'User'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${doc.file_url}`} target="_blank" rel="noreferrer" className="p-2 text-farm-600 hover:bg-farm-50 rounded-lg transition-colors">
                  <Download className="w-4 h-4" />
                </a>
                {isAgronomist && (
                  <button onClick={() => deleteMutation.mutate(doc.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
          <p className="text-sm text-gray-500">No documents uploaded.</p>
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function AgronomistPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPaddockId, setSelectedPaddockId] = useState<string | null>(null);

  const role = getRole();
  const canApprove = isAdmin(role);
  const isAgronomist = role === 'agronomist' || isAdmin(role); // Allow admin to test upload as well

  const { activeFarmId } = useFarm();
  const farmParams = activeFarmId ? { farm_id: activeFarmId } : {};

  const { data: recs, isLoading: recsLoading } = useQuery<Recommendation[]>({
    queryKey: ['recommendations', activeFarmId],
    queryFn: () => api.get('/recommendations').then(r => r.data),
  });

  const { data: paddocks, isLoading: paddocksLoading } = useQuery<Paddock[]>({
    queryKey: ['paddocks', activeFarmId],
    queryFn: () => api.get('/paddocks', { params: farmParams }).then(r => r.data),
  });

  // Automatically select first paddock
  if (!selectedPaddockId && paddocks && paddocks.length > 0) {
    setSelectedPaddockId(paddocks[0].id);
  }

  const selectedPaddock = paddocks?.find(p => p.id === selectedPaddockId);
  const paddockRecs = recs?.filter(r => r.paddock_id === selectedPaddockId) || [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RecForm>();

  const createMutation = useMutation({
    mutationFn: (d: RecForm) => api.post('/recommendations', { ...d, paddock_id: selectedPaddockId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recommendations'] });
      setModalOpen(false);
      reset();
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/recommendations/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recommendations'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/recommendations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recommendations'] }),
  });

  const handleCloseModal = () => { setModalOpen(false); reset(); };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row bg-gray-50">
        
        {/* Sidebar: Paddock List */}
        <div className="w-full md:w-80 border-r border-gray-200 bg-white flex flex-col h-full flex-shrink-0">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Map className="w-4 h-4 text-farm-600" /> Paddocks
            </h2>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {paddocksLoading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : paddocks?.length ? (
              paddocks.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPaddockId(p.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${
                    selectedPaddockId === p.id 
                      ? 'bg-farm-50 border-farm-200 shadow-sm' 
                      : 'bg-white border-transparent hover:bg-gray-50'
                  }`}
                >
                  <p className={`font-semibold text-sm ${selectedPaddockId === p.id ? 'text-farm-900' : 'text-gray-700'}`}>
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    {p.crop_type ? <><Sprout className="w-3 h-3" /> {p.crop_type}</> : 'No crop active'}
                  </p>
                </button>
              ))
            ) : (
              <p className="text-xs text-gray-500 text-center py-10">No paddocks found.</p>
            )}
          </div>
        </div>

        {/* Main Content: Paddock Agronomy Details */}
        <div className="flex-1 overflow-y-auto">
          {selectedPaddock ? (
            <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
              
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{selectedPaddock.name} Agronomy</h1>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                    <Sprout className="w-4 h-4" /> {selectedPaddock.crop_type || 'No crop'}
                    {selectedPaddock.land_area && ` · ${selectedPaddock.land_area} ha`}
                  </p>
                </div>
              </div>

              {/* Documents Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DocumentSection 
                  paddockId={selectedPaddock.id} 
                  title="Soil Reports" 
                  documentType="soil_report" 
                  isAgronomist={isAgronomist} 
                />
                <DocumentSection 
                  paddockId={selectedPaddock.id} 
                  title="Planned Financials" 
                  documentType="planned_financials" 
                  isAgronomist={isAgronomist} 
                />
              </div>

              {/* Recommendations Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900">Recommendations</h2>
                  {isAgronomist && (
                    <button onClick={() => setModalOpen(true)} className="btn-primary text-sm px-3 py-1.5 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> New Recommendation
                    </button>
                  )}
                </div>

                {recsLoading ? (
                  <div className="flex justify-center py-10"><Spinner /></div>
                ) : paddockRecs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paddockRecs.map(rec => (
                      <RecCard key={rec.id} rec={rec}
                        onApprove={() => statusMutation.mutate({ id: rec.id, status: 'approved' })}
                        onReject={() => statusMutation.mutate({ id: rec.id, status: 'rejected' })}
                        onDelete={() => deleteMutation.mutate(rec.id)}
                        isUpdating={statusMutation.isPending}
                        canApprove={canApprove}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Leaf} title="No recommendations"
                    description="No agronomy recommendations have been made for this paddock yet."
                    action={isAgronomist ? <button onClick={() => setModalOpen(true)} className="btn-secondary mt-2">Add Recommendation</button> : undefined}
                  />
                )}
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center h-full text-gray-400">
              <Map className="w-16 h-16 text-gray-200 mb-4" />
              <p>Select a paddock to view agronomy details</p>
            </div>
          )}
        </div>

        {/* Create recommendation modal */}
        <Modal open={modalOpen} onClose={handleCloseModal} title="New Recommendation">
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            {createMutation.isError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> Failed to save.
              </div>
            )}

            <div>
              <label className="label">Recommendation Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {REC_TYPES.map(t => {
                  const Icon = TYPE_ICON[t] ?? HelpCircle;
                  return (
                    <label key={t} className="relative cursor-pointer">
                      <input type="radio" value={t} className="peer sr-only" {...register('type', { required: true })} />
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium transition-all
                        peer-checked:border-farm-500 peer-checked:bg-farm-50 peer-checked:text-farm-700 hover:border-gray-300">
                        <Icon className="w-4 h-4 flex-shrink-0" />{t}
                      </div>
                    </label>
                  );
                })}
              </div>
              {errors.type && <p className="text-xs text-red-500 mt-1">Please select a type</p>}
            </div>

            <div>
              <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea className="input resize-none" rows={4} placeholder="Describe the recommendation in detail…" {...register('description')} />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={handleCloseModal} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
                {createMutation.isPending ? 'Creating…' : 'Create Draft'}
              </button>
            </div>
          </form>
        </Modal>

      </div>
    </AppLayout>
  );
}
