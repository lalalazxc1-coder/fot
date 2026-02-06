import React from 'react';
import { Card } from '../ui-mocks';
import { formatMoney } from '../../utils';

interface EmployeeStatsProps {
    totalNet: number;
    totalGross: number;
}

export const EmployeeStats: React.FC<EmployeeStatsProps> = ({ totalNet, totalGross }) => {
    return (
        <div className="flex gap-4">
            <Card className="px-6 py-4 shadow-xl shadow-slate-200/60 border border-white bg-white min-w-[180px] rounded-2xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                    Оклад (Net)
                </div>
                <div className="text-3xl font-bold text-slate-900 leading-none tracking-tight">
                    {formatMoney(totalNet)}
                </div>
            </Card>
            <Card className="px-6 py-4 shadow-xl shadow-slate-200/60 border border-white bg-white min-w-[180px] rounded-2xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                    Оклад (Gross)
                </div>
                <div className="text-3xl font-bold text-slate-900 leading-none tracking-tight">
                    {formatMoney(totalGross)}
                </div>
            </Card>
        </div>
    );
};
