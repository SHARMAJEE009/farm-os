'use client';

interface FertiliserRow {
  timing: string;
  product: string;
  method: string;
  ratePerHa: number;
  totalQuantityTonnes: number;
  estimatedCostAUD: number;
}

interface FertiliserTableProps {
  recommendations: FertiliserRow[];
}

export function FertiliserTable({ recommendations }: FertiliserTableProps) {
  const totalCost = recommendations.reduce((sum, r) => sum + (r.estimatedCostAUD || 0), 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-semibold text-gray-700">Timing</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-700">Product</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-700">Method</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-700">Rate (kg/ha)</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-700">Qty (t)</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-700">Cost (AUD)</th>
          </tr>
        </thead>
        <tbody>
          {recommendations.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-900">{r.timing}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{r.product}</td>
              <td className="px-4 py-3 text-gray-600">{r.method}</td>
              <td className="px-4 py-3 text-right text-gray-900">{r.ratePerHa?.toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-gray-900">{r.totalQuantityTonnes?.toFixed(2)}</td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">
                ${r.estimatedCostAUD?.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-farm-50 border-t-2 border-farm-200">
            <td colSpan={5} className="px-4 py-3 text-right font-bold text-farm-900">
              Total Fertiliser Cost
            </td>
            <td className="px-4 py-3 text-right font-bold text-farm-900 text-base">
              ${totalCost.toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
