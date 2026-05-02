'use client';

import { useState, useRef, useEffect } from 'react';
import { useFarm } from '@/lib/farm-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Leaf, Upload, FileText, Calendar, Map, Sprout,
  CheckCircle, Clock, AlertCircle, XCircle, Loader2, X, Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/utils';
import AppLayout from '@/components/layout/AppLayout';
import { getRole, isAdmin } from '@/lib/role';

interface SoilReport {
  id: string;
  paddock_id: string;
  farm_id: string;
  file_name: string;
  season: string;
  status: string;
  paddock_name: string;
  farm_name: string;
  created_at: string;
  ai_recommendation: any;
}

interface Farm {
  id: string;
  name: string;
}

interface Paddock {
  id: string;
  name: string;
  crop_type: string;
  land_area: number;
}

export default function AgronomistPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedPaddockId, setSelectedPaddockId] = useState('');
  const [season, setSeason] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const role = getRole();

  // Fetch my uploads
  const { data: uploads, isLoading } = useQuery<SoilReport[]>({
    queryKey: ['my-soil-uploads'],
    queryFn: () => api.get('/agronomy/my-uploads').then(r => r.data),
  });

  // Fetch farms for dropdown
  const { data: farms } = useQuery<Farm[]>({
    queryKey: ['farms'],
    queryFn: () => api.get('/farms').then(r => r.data),
  });

  // Fetch paddocks filtered by selected farm
  const { data: paddocks } = useQuery<Paddock[]>({
    queryKey: ['paddocks', selectedFarmId],
    queryFn: () => api.get('/paddocks', { params: { farm_id: selectedFarmId } }).then(r => r.data),
    enabled: !!selectedFarmId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !selectedFarmId || !selectedPaddockId) {
        throw new Error('Please fill all required fields');
      }
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('paddock_id', selectedPaddockId);
      formData.append('farm_id', selectedFarmId);
      formData.append('season', season);
      return api.post('/agronomy/upload-soil-report', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-soil-uploads'] });
      handleCloseModal();
    },
  });

  const handleDelete = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this soil report?')) return;
    try {
      await api.delete(`/agronomy/soil-reports/${reportId}`);
      qc.invalidateQueries({ queryKey: ['my-soil-uploads'] });
      qc.invalidateQueries({ queryKey: ['soil-reports'] });
    } catch (err: any) {
      console.error('Failed to delete report:', err);
      const msg = err.response?.data?.message || err.message;
      alert(`Failed to delete soil report: ${msg}`);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedFarmId('');
    setSelectedPaddockId('');
    setSeason('');
    setSelectedFile(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <AppLayout><div className="min-h-screen"></div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="w-10 h-10 bg-farm-100 rounded-xl flex items-center justify-center">
                <Leaf className="w-5 h-5 text-farm-600" />
              </span>
              My Soil Reports
            </h1>
            <p className="text-sm text-gray-500 mt-1">Upload and track your soil analysis reports</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="btn-primary flex items-center gap-2 px-5 py-2.5"
          >
            <Upload className="w-4 h-4" /> Upload Soil Report
          </button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : uploads && uploads.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3 font-semibold text-gray-700">Paddock</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-700">Farm</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-700">Season</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-700">File Name</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-700">Upload Date</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-700">Status</th>
                    <th className="text-right px-5 py-3 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map(report => (
                    <tr key={report.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Sprout className="w-4 h-4 text-farm-500" />
                          <span className="font-medium text-gray-900">{report.paddock_name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{report.farm_name || '—'}</td>
                      <td className="px-5 py-4 text-gray-600">{report.season || '—'}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700 truncate max-w-[180px]">{report.file_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-500 text-xs">{formatDate(report.created_at)}</td>
                      <td className="px-5 py-4"><StatusBadge status={report.status} /></td>
                      <td className="px-5 py-4 text-right">
                        <button 
                          onClick={() => handleDelete(report.id)} 
                          title="Delete report"
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
            <div className="w-16 h-16 bg-farm-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-farm-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No soil reports uploaded yet</h3>
            <p className="text-sm text-gray-500 mb-4">Upload your first soil analysis PDF to get started</p>
            <button onClick={() => setModalOpen(true)} className="btn-primary px-5 py-2">
              <Upload className="w-4 h-4 mr-2 inline" /> Upload Report
            </button>
          </div>
        )}

        {/* Upload Modal */}
        <Modal open={modalOpen} onClose={handleCloseModal} title="Upload Soil Report" className="max-w-xl">
          <div className="space-y-5">
            {uploadMutation.isError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {(uploadMutation.error as Error)?.message || 'Failed to upload'}
              </div>
            )}

            {/* Farm dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Farm *</label>
              <select
                value={selectedFarmId}
                onChange={e => { setSelectedFarmId(e.target.value); setSelectedPaddockId(''); }}
                className="input w-full"
              >
                <option value="">Choose a farm...</option>
                {farms?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            {/* Paddock dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Paddock *</label>
              <select
                value={selectedPaddockId}
                onChange={e => setSelectedPaddockId(e.target.value)}
                className="input w-full"
                disabled={!selectedFarmId}
              >
                <option value="">Choose a paddock...</option>
                {paddocks?.map(p => <option key={p.id} value={p.id}>{p.name} {p.crop_type ? `(${p.crop_type})` : ''}</option>)}
              </select>
            </div>

            {/* Season */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Season</label>
              <input
                type="text"
                value={season}
                onChange={e => setSeason(e.target.value)}
                placeholder="e.g. Winter 2025"
                className="input w-full"
              />
            </div>

            {/* File Drop Zone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Soil Report PDF *</label>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragActive
                    ? 'border-farm-400 bg-farm-50'
                    : selectedFile
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 hover:border-farm-300 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setSelectedFile(file);
                  }}
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                      className="p-1 rounded-full hover:bg-gray-200"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-farm-600">Click to upload</span> or drag & drop
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PDF only, max 10MB</p>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={handleCloseModal} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending || !selectedFile || !selectedFarmId || !selectedPaddockId}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploadMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Upload Report</>
                )}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
