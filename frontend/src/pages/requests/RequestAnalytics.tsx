
import { formatMoney } from '../../utils';
import { useRequestAnalytics } from '../../hooks/useRequests';

export const RequestAnalytics = ({ reqId }: { reqId: number }) => {
    const { data, isLoading } = useRequestAnalytics(reqId, true);

    if (isLoading) return <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded animate-pulse">Загрузка аналитики...</div>;
    if (!data) return <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded">Нет данных</div>;

    return (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
            {/* Market */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-slate-400 uppercase font-bold text-[10px] mb-2 tracking-wider">Рынок (Топ-3)</div>
                {data.market ? (
                    <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-baseline">
                            <span className="text-slate-500">Мин:</span>
                            <span className="font-mono text-slate-700">{formatMoney(data.market.min)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                            <span className="text-slate-500">Макс:</span>
                            <span className="font-mono text-slate-700">{formatMoney(data.market.max)}</span>
                        </div>
                        <div className="flex justify-between items-baseline font-bold text-slate-900 border-t border-slate-200 pt-1 mt-1">
                            <span>Медиана:</span>
                            <span className="font-mono">{formatMoney(data.market.median)}</span>
                        </div>
                    </div>
                ) : <div className="text-slate-400 italic text-xs">Нет данных</div>}
            </div>

            {/* Internal */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-slate-400 uppercase font-bold text-[10px] mb-2 tracking-wider">Филиал (Ср. ЗП)</div>
                {data.internal ? (
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="font-bold text-slate-800 text-sm">{formatMoney(data.internal.avg_total_net)}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">похожие позиции</div>
                        </div>
                        <div className="text-xs font-mono bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">
                            {data.internal.count} сотр.
                        </div>
                    </div>
                ) : <div className="text-slate-400 italic text-xs">Нет данных</div>}
            </div>

            {/* Budget */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-slate-400 uppercase font-bold text-[10px] mb-2 tracking-wider">Бюджет Отдела</div>
                {data.budget ? (
                    <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-baseline">
                            <span className="text-slate-500">План:</span>
                            <span className="font-mono text-slate-700">{formatMoney(data.budget.plan)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                            <span className="text-slate-500">Факт:</span>
                            <span className="font-mono text-slate-700">{formatMoney(data.budget.fact)}</span>
                        </div>
                        <div className={`flex justify-between items-baseline font-bold border-t border-slate-200 pt-1 mt-1 ${data.budget.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            <span>Остаток:</span>
                            <span className="font-mono">{data.budget.balance > 0 ? '+' : ''}{formatMoney(data.budget.balance)}</span>
                        </div>
                    </div>
                ) : <div className="text-slate-400 italic text-xs">Нет данных</div>}
            </div>
        </div>
    );
};
