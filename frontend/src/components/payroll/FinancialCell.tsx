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
    if (value.net === 0 && value.gross === 0) {
        return (
            <div className={`flex justify-center items-center h-full w-full ${isTotal ? 'text-white/30' : 'text-slate-300'}`}>
                —
            </div>
        );
    }

    return (
        <div className="flex flex-col text-[10px] w-full">
            <div className={`flex justify-between items-center gap-1.5 ${isTotal ? 'text-emerald-100' : 'text-slate-500'}`}>
                <span className="opacity-70 font-medium tracking-wide">Net</span>
                <span className={`font-mono tabular-nums font-bold text-right ${isTotal ? 'text-white text-[13px] tracking-tight' : 'text-slate-800 text-xs tracking-tight'}`}>
                    {formatMoney(value.net)}
                </span>
            </div>
            <div className={`flex justify-between items-center gap-1.5 mt-0.5 ${isTotal ? 'text-emerald-300/80' : 'text-slate-400'}`}>
                <span className="opacity-70 font-medium tracking-wide">Grs</span>
                <span className={`font-mono tabular-nums font-medium text-right ${isTotal ? 'text-emerald-100 text-[13px] tracking-tight' : 'text-slate-500 text-xs tracking-tight'}`}>
                    {formatMoney(value.gross)}
                </span>
            </div>
        </div>
    );
};
