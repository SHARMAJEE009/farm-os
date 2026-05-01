'use client';

interface CashflowItem {
  month: string;
  amountAUD: number;
  description: string;
}

interface CashflowBarsProps {
  cashflow: CashflowItem[];
}

export function CashflowBars({ cashflow }: CashflowBarsProps) {
  const maxAmount = Math.max(...cashflow.map(c => Math.abs(c.amountAUD)), 1);

  return (
    <div className="space-y-3">
      {cashflow.map((item, i) => {
        const isExpense = item.amountAUD < 0 || item.description.toLowerCase().includes('cost') || item.description.toLowerCase().includes('expense') || item.description.toLowerCase().includes('fertiliser');
        const percentage = Math.min((Math.abs(item.amountAUD) / maxAmount) * 100, 100);

        return (
          <div key={i} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{item.month}</span>
                <span className="text-xs text-gray-500 hidden sm:inline">{item.description}</span>
              </div>
              <span className={`text-sm font-bold ${isExpense ? 'text-red-600' : 'text-emerald-600'}`}>
                {isExpense ? '-' : '+'}${Math.abs(item.amountAUD).toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isExpense
                    ? 'bg-gradient-to-r from-red-400 to-red-500'
                    : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
