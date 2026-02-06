import React from 'react';
import { formatMoney } from '../../utils';

interface FinancialValue {
    net: number;
    gross: number;
}

interface FinancialCellProps {
    value: FinancialValue;
    isTotal?: boolean;
}

export const FinancialCell: React.FC<FinancialCellProps> = ({ value, isTotal = false }) => {
    return (
        <div className="flex flex-col text-[10px] min-w-[90px]">
            <div className={`flex justify-between items-center gap-1.5 ${isTotal ? 'text-emerald-200' : 'text-slate-400'}`}>
                <span className="opacity-70">Net</span>
                <span className={`font-bold text-right truncate ${isTotal ? 'text-white text-xs' : 'text-emerald-700 text-[11px]'}`}>
                    {formatMoney(value.net)}
                </span>
            </div>
            <div className={`flex justify-between items-center gap-1.5 border-t mt-0.5 pt-0.5 ${isTotal ? 'border-emerald-600/30' : 'border-slate-100'}`}>
                <span className={`opacity-70 ${isTotal ? 'text-emerald-300' : 'text-slate-400'}`}>Grs</span>
                <span className={`text-right truncate ${isTotal ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {formatMoney(value.gross)}
                </span>
            </div>
        </div>
    );
};
