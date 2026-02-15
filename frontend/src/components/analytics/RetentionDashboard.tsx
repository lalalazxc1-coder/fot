import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatMoney } from '../../utils';
import { AlertTriangle, UserX } from 'lucide-react';

interface RiskItem {
    id: number;
    full_name: string;
    position: string;
    branch: string;
    months_stagnant: number;
    gap_percent: number;
    risk_score: number;
    current_salary: number;
    market_median: number;
}

export const RetentionDashboard = () => {
    const [items, setItems] = useState<RiskItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/analytics/retention-risk').then(res => {
            setItems(res.data.items);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, []);

    if (loading) return <div className="p-10 text-center text-slate-500">Загрузка аналитики удержания...</div>;

    const highRisk = items.filter(i => i.risk_score >= 100);
    const medRisk = items.filter(i => i.risk_score >= 50 && i.risk_score < 100);
    const riskDistribution = {
        'High': highRisk.length,
        'Medium': medRisk.length,
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Анализ рисков удержания
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">Сотрудники с высоким риском увольнения (стагнация ЗП + отставание от рынка)</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <div className="text-sm font-bold text-red-600 uppercase tracking-wider mb-1">В зоне риска</div>
                    <div className="text-3xl font-bold text-slate-900">{items.length}</div>
                    <div className="text-xs text-red-500 mt-1">Сотрудников требуют внимания</div>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-1">Ср. стагнация</div>
                    <div className="text-3xl font-bold text-slate-900">
                        {items.length > 0 ? Math.round(items.reduce((acc, i) => acc + i.months_stagnant, 0) / items.length) : 0} <span className="text-sm font-medium text-slate-500">мес.</span>
                    </div>
                    <div className="text-xs text-amber-500 mt-1">Без пересмотра зарплаты</div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-1">Распределение риска</div>
                    <div className="flex gap-2 mt-2">
                        <div className="flex-1">
                            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500" style={{ width: `${(riskDistribution['High'] || 0) / (items.length || 1) * 100}%` }}></div>
                            </div>
                            <div className="flex justify-between text-[10px] mt-1 font-medium">
                                <span>Высокий</span>
                                <span>{riskDistribution['High'] || 0}</span>
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500" style={{ width: `${(riskDistribution['Medium'] || 0) / (items.length || 1) * 100}%` }}></div>
                            </div>
                            <div className="flex justify-between text-[10px] mt-1 font-medium">
                                <span>Средний</span>
                                <span>{riskDistribution['Medium'] || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                <UserX className="w-4 h-4" />
                Кандидаты на рассмотрение
            </h4>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-separate border-spacing-0">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="pb-3 pt-3 pl-4 font-semibold text-slate-500 border-b">Сотрудник</th>
                            <th className="pb-3 pt-3 font-semibold text-slate-500 border-b">Должность</th>
                            <th className="pb-3 pt-3 text-right font-semibold text-slate-500 border-b">Текущая ЗП</th>
                            <th className="pb-3 pt-3 text-right font-semibold text-slate-500 border-b">Рынок (Медиана)</th>
                            <th className="pb-3 pt-3 text-right font-semibold text-slate-500 border-b">Отставание</th>
                            <th className="pb-3 pt-3 text-right pr-4 font-semibold text-slate-500 border-b">Без повышений</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.slice(0, 5).map((item) => (
                            <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                                <td className="py-3 pl-4 border-b border-slate-100 font-medium text-slate-900">{item.full_name}</td>
                                <td className="py-3 border-b border-slate-100 text-slate-500">{item.position}</td>
                                <td className="py-3 border-b border-slate-100 text-right font-mono text-slate-600">{formatMoney(item.current_salary)}</td>
                                <td className="py-3 border-b border-slate-100 text-right font-mono text-slate-400">{formatMoney(item.market_median)}</td>
                                <td className="py-3 border-b border-slate-100 text-right text-red-600 font-bold">
                                    {item.gap_percent.toFixed(1)}%
                                </td>
                                <td className="py-3 border-b border-slate-100 text-right pr-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.months_stagnant > 24 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {item.months_stagnant} мес.
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-slate-400 italic">Рисков не выявлено. Все сотрудники в пределах нормы.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
