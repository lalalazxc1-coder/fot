import React, { useMemo } from 'react';
import { formatMoney } from '../../utils';
import { PlanRow } from '../../hooks/usePlanning';

type PlanningStatsProps = {
    data: PlanRow[];
};

export const PlanningStats: React.FC<PlanningStatsProps> = ({ data }) => {
    const totalNet = useMemo(() => data.reduce((acc, r) => {
        const bonusCount = r.bonus_count !== null && r.bonus_count !== undefined ? r.bonus_count : r.count;
        return acc + ((r.base_net + r.kpi_net) * r.count) + (r.bonus_net * bonusCount);
    }, 0), [data]);

    const totalGross = useMemo(() => data.reduce((acc, r) => {
        const bonusCount = r.bonus_count !== null && r.bonus_count !== undefined ? r.bonus_count : r.count;
        return acc + ((r.base_gross + r.kpi_gross) * r.count) + (r.bonus_gross * bonusCount);
    }, 0), [data]);

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
