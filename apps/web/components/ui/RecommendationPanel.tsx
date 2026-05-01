'use client';

import { X, Beaker, Sprout, DollarSign, TrendingUp, Brain, Printer } from 'lucide-react';
import { SoilAlertCard } from './SoilAlertCard';
import { FertiliserTable } from './FertiliserTable';
import { CashflowBars } from './CashflowBars';

interface RecommendationPanelProps {
  recommendation: any;
  paddockName: string;
  season: string;
  isOpen: boolean;
  onClose: () => void;
}

export function RecommendationPanel({ recommendation, paddockName, season, isOpen, onClose }: RecommendationPanelProps) {
  if (!isOpen || !recommendation) return null;

  const rec = recommendation;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[640px] bg-white shadow-2xl overflow-y-auto animate-slide-in">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {rec.paddockName || paddockName} — AI Recommendation
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">{rec.season || season}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-8">

          {/* Section 1: Soil Alerts */}
          {rec.soilAlerts && rec.soilAlerts.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Beaker className="w-5 h-5 text-farm-600" />
                <h3 className="text-lg font-bold text-gray-900">Soil Analysis Alerts</h3>
              </div>
              <div className="space-y-3">
                {rec.soilAlerts.map((alert: any, i: number) => (
                  <SoilAlertCard key={i} alert={alert} />
                ))}
              </div>
            </section>
          )}

          {/* Section 2: Fertiliser Recommendations */}
          {rec.fertiliserRecommendations && rec.fertiliserRecommendations.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sprout className="w-5 h-5 text-farm-600" />
                <h3 className="text-lg font-bold text-gray-900">Fertiliser Prescription</h3>
              </div>
              <FertiliserTable recommendations={rec.fertiliserRecommendations} />
            </section>
          )}

          {/* Section 3: Nutrient Summary */}
          {rec.nutrientSummary && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Beaker className="w-5 h-5 text-farm-600" />
                <h3 className="text-lg font-bold text-gray-900">Nutrient Delivery</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(rec.nutrientSummary).map(([key, value]) => (
                  <div key={key} className="bg-gradient-to-br from-farm-50 to-green-50 rounded-xl border border-farm-100 p-4 text-center">
                    <p className="text-2xl font-bold text-farm-800">{String(value)}</p>
                    <p className="text-xs font-medium text-farm-600 mt-1 capitalize">
                      {key} <span className="text-gray-400">kg/ha</span>
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 4: Cashflow Impact */}
          {rec.cashflowImpact && rec.cashflowImpact.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-farm-600" />
                <h3 className="text-lg font-bold text-gray-900">Monthly Cashflow Impact</h3>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                <CashflowBars cashflow={rec.cashflowImpact} />
              </div>
            </section>
          )}

          {/* Section 5: Expected Yield & ROI */}
          {rec.expectedYield && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-farm-600" />
                <h3 className="text-lg font-bold text-gray-900">Season Outlook</h3>
              </div>

              {/* Yield cards */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 text-center">
                  <p className="text-xs font-medium text-amber-600 mb-1">Low</p>
                  <p className="text-xl font-bold text-amber-800">{rec.expectedYield.low}</p>
                  <p className="text-xs text-amber-500">{rec.expectedYield.unit || 't/ha'}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 text-center ring-2 ring-emerald-200">
                  <p className="text-xs font-medium text-emerald-600 mb-1">Expected</p>
                  <p className="text-2xl font-bold text-emerald-800">{rec.expectedYield.expected}</p>
                  <p className="text-xs text-emerald-500">{rec.expectedYield.unit || 't/ha'}</p>
                </div>
                <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-center">
                  <p className="text-xs font-medium text-blue-600 mb-1">High</p>
                  <p className="text-xl font-bold text-blue-800">{rec.expectedYield.high}</p>
                  <p className="text-xs text-blue-500">{rec.expectedYield.unit || 't/ha'}</p>
                </div>
              </div>

              {/* ROI */}
              {rec.roi && (
                <div className="bg-gradient-to-r from-farm-600 to-emerald-600 rounded-xl p-5 text-white">
                  <p className="text-sm font-medium text-farm-100 mb-3">Return on Investment</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-farm-200">Fertiliser Cost</p>
                      <p className="text-lg font-bold">${rec.roi.totalFertiliserCostAUD?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-farm-200">Expected Revenue</p>
                      <p className="text-lg font-bold">${rec.roi.expectedRevenueAUD?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-farm-200">ROI Multiple</p>
                      <p className="text-lg font-bold">{rec.roi.roiMultiple}x</p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Section 6: AI Summary */}
          {rec.summary && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-farm-600" />
                <h3 className="text-lg font-bold text-gray-900">Agronomist AI Summary</h3>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{rec.summary}</p>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-farm-600 text-white rounded-xl hover:bg-farm-700 transition-colors font-medium text-sm"
          >
            <Printer className="w-4 h-4" /> Download PDF Report
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
