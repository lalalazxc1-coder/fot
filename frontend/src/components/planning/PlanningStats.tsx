import React, { useMemo } from 'react';
import { Card } from '../ui-mocks';
import { formatMoney } from '../../utils';
import { PlanRow } from '../../hooks/usePlanning';

type PlanningStatsProps = {
    data: PlanRow[];
};

export const PlanningStats: React.FC<PlanningStatsProps> = ({ data }) => {
    const totalNet = useMemo(() => data.reduce((acc, r) => acc + ((r.base_net + r.kpi_net + r.bonus_net) * r.count), 0), [data]);
    const totalGross = useMemo(() => data.reduce((acc, r) => acc + ((r.base_gross + r.kpi_gross + r.bonus_gross) * r.count), 0), [data]);

    return (
        <div className="flex gap-4">
            <Card className="px-6 py-4 shadow-xl shadow-slate-200/60 border border-white bg-white min-w-[180px] rounded-2xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">План (Net)</div>
                <div className="text-3xl font-bold text-slate-900 leading-none tracking-tight">{formatMoney(totalNet)}</div>
            </Card>
            <Card className="px-6 py-4 shadow-xl shadow-slate-200/60 border border-white bg-white min-w-[180px] rounded-2xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">План (Gross)</div>
                <div className="text-3xl font-bold text-slate-900 leading-none tracking-tight">{formatMoney(totalGross)}</div>
            </Card>
        </div>
    );
};
