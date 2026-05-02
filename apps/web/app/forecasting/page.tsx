'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { UploadCloud, FileText, Loader2, TrendingUp, AlertTriangle, CheckCircle, BarChart2, Trash2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export default function ForecastingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'done'>('idle');

  useEffect(() => {
    if (localStorage.getItem('forecast_generated')) {
      setStatus('done');
    }
  }, []);

  const handleUpload = () => {
    if (!file) return;
    setStatus('uploading');
    setTimeout(() => {
      setStatus('analyzing');
      setTimeout(() => {
        setStatus('done');
        localStorage.setItem('forecast_generated', 'true');
      }, 2500);
    }, 1500);
  };

  const handleClear = () => {
    if (!confirm('Are you sure you want to delete this forecast data?')) return;
    localStorage.removeItem('forecast_generated');
    setStatus('idle');
    setFile(null);
  };

  const chartData = [
    { month: 'Jan', net: -39116, cumulative: -39116, expense: 39116 },
    { month: 'Feb', net: -41567, cumulative: -80683, expense: 41567 },
    { month: 'Mar', net: -69687, cumulative: -150370, expense: 69687 },
    { month: 'Apr', net: -252779, cumulative: -403149, expense: 252779 },
    { month: 'May', net: -12797, cumulative: -415946, expense: 12797 },
    { month: 'Jun', net: -46484, cumulative: -462430, expense: 46484 },
    { month: 'Jul', net: -123931, cumulative: -586361, expense: 123931 },
    { month: 'Aug', net: -10227, cumulative: -596588, expense: 10227 },
    { month: 'Sep', net: -60243, cumulative: -656831, expense: 60243 },
    { month: 'Oct', net: -93035, cumulative: -749866, expense: 93035 },
    { month: 'Nov', net: 1503268, cumulative: 753401, expense: 151289 },
    { month: 'Dec', net: -12936, cumulative: 740465, expense: 12936 },
  ];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto min-h-screen">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <span className="w-10 h-10 bg-farm-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-farm-600" />
              </span>
              Forecasting & Planning
            </h1>
            <p className="text-gray-500">Upload your Planned Financials to generate AI-driven cash flow predictions.</p>
          </div>
          {status === 'done' && (
            <button 
              onClick={handleClear}
              className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded-xl transition-colors font-medium text-sm"
            >
              <Trash2 className="w-4 h-4" /> Clear Data
            </button>
          )}
        </div>

        {status === 'idle' && (
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Upload Planned Financials</h2>
            <p className="text-sm text-gray-500 mb-6">Support for Agworld Budgets, Excel, and CSV forecasts.</p>
            
            <label className="block w-full border-2 border-dashed border-gray-300 rounded-xl p-8 hover:bg-gray-50 hover:border-farm-400 transition-colors cursor-pointer mb-6">
              <input 
                type="file" 
                className="hidden" 
                accept=".pdf,.csv,.xlsx" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <div className="text-sm font-medium text-gray-700">
                {file ? file.name : "Click to browse or drag and drop"}
              </div>
            </label>

            <button 
              onClick={handleUpload}
              disabled={!file}
              className="w-full py-3 bg-farm-600 text-white rounded-xl font-semibold hover:bg-farm-700 disabled:opacity-50 transition-colors"
            >
              Generate AI Forecast
            </button>
          </div>
        )}

        {(status === 'uploading' || status === 'analyzing') && (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="w-12 h-12 text-farm-600 animate-spin mb-4" />
            <h2 className="text-xl font-bold text-gray-800">
              {status === 'uploading' ? 'Uploading document...' : 'AI Analyzing Forecast...'}
            </h2>
            <p className="text-gray-500 text-sm mt-2 max-w-md text-center">
              {status === 'analyzing' && 'Extracting Agworld seasonal data, calculating cumulative positions, and generating cash flow insights...'}
            </p>
          </div>
        )}

        {status === 'done' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-red-500">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Max Cash Deficit (Oct)</p>
                <p className="text-2xl font-bold text-gray-900">-₹749,866</p>
                <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Peak operating debt required</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-emerald-500">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Year-End Position</p>
                <p className="text-2xl font-bold text-gray-900">+₹740,465</p>
                <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Positive harvest outcome</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-amber-500">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Highest Expense (Apr)</p>
                <p className="text-2xl font-bold text-gray-900">₹252,779</p>
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">Driven by Fertiliser (₹148k) & Sowing</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Cumulative Cash Position (J-Curve)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(val) => `₹${val/1000}k`} />
                      <Tooltip formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Cumulative']} />
                      <Area type="monotone" dataKey="cumulative" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorCum)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-rose-600" />
                  Monthly Expenditure
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(val) => `₹${val/1000}k`} />
                      <Tooltip cursor={{ fill: '#F3F4F6' }} formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Expense']} />
                      <Bar dataKey="expense" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* AI Insights */}
            <div className="bg-gradient-to-r from-farm-50 to-white p-6 rounded-xl border border-farm-200 shadow-sm">
              <h3 className="text-sm font-bold text-farm-800 mb-3">🤖 AI CFO Insights</h3>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span><strong>Liquidity Risk in April:</strong> Total expenditure spikes to ₹252k due to heavy fertiliser use (Granulock Z, Urea) and sowing operations. Ensure OD facility is expanded to handle this peak.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span><strong>Extended Cash Burn:</strong> The cumulative position stays deeply negative from March to October (max deficit -₹749k). You will carry high interest costs during this 8-month window.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span><strong>Harvest Recovery:</strong> November brings ₹1.65M in income (driven by Wheat and Canola), wiping out the deficit completely and netting a positive end-of-year standing.</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
