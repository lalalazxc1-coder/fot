import React from 'react';
import { formatMoney } from '../../utils';

interface EmployeeStatsProps {
    totalNet: number;
    totalGross: number;
}

export const EmployeeStats: React.FC<EmployeeStatsProps> = ({ totalNet, totalGross }) => {
    return (
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 shrink-0 hidden sm:flex">
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">NETTO</span>
                <span className="text-sm font-bold text-slate-900 leading-none mt-0.5">{formatMoney(totalNet)}</span>
            </div>
            <div className="w-px h-6 bg-slate-200"></div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">GROSS</span>
                <span className="text-sm font-bold text-slate-900 leading-none mt-0.5">{formatMoney(totalGross)}</span>
            </div>
        </div>
    );
};
