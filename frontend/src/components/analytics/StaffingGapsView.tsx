import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Loader2, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const StaffingGapsView = () => {
    const { data, isLoading } = useQuery({
        queryKey: ['analytics', 'turnover', 365],
        queryFn: async () => {
            const res = await api.get('/analytics/turnover?days=365');
            return res.data;
        }
    });

    if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-slate-400" /></div>;

    if (!data) return <div>Нет данных</div>;

    const { staffing_gaps, turnover_rate, dismissed_count, reasons_distribution } = data;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* 1. Staffing Gaps */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    Кадровые разрывы (План vs Факт)
                </h3>

                {staffing_gaps.length === 0 ? (
                    <div className="text-slate-500 text-sm">Все плановые позиции заполнены!</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold">
                                <tr>
                                    <th className="px-4 py-2 rounded-l-lg">Подразделение</th>
                                    <th className="px-4 py-2">План</th>
                                    <th className="px-4 py-2">Факт</th>
                                    <th className="px-4 py-2 text-red-600 rounded-r-lg">Вакансия (Разрыв)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {staffing_gaps.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-700">{item.unit_name}</td>
                                        <td className="px-4 py-3">{item.plan}</td>
                                        <td className="px-4 py-3">{item.fact}</td>
                                        <td className="px-4 py-3 font-bold text-red-600">-{item.gap}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 2. Turnover Metrics */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Текучесть кадров (год)</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                        <div className="text-red-600 text-sm font-medium mb-1">Коэффициент текучести</div>
                        <div className="text-3xl font-bold text-red-700">{turnover_rate}%</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="text-slate-600 text-sm font-medium mb-1">Уволено сотрудников</div>
                        <div className="text-3xl font-bold text-slate-800">{dismissed_count}</div>
                    </div>
                </div>
            </div>

            {/* 3. Reasons Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Причины увольнений</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={reasons_distribution}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={120}
                                tick={{ fontSize: 11 }}
                            />
                            <Tooltip />
                            <Bar dataKey="value" fill="#64748b" radius={[0, 4, 4, 0]}>
                                {reasons_distribution.map((_: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={['#ef4444', '#f59e0b', '#3b82f6', '#10b981'][index % 4] || '#64748b'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
