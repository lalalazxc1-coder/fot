import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, Wallet, Target, AlertCircle, PieChart as PieIcon, Briefcase, RefreshCw } from 'lucide-react';
import { formatMoney } from '../utils';
import { useAnalytics, useRefreshAnalytics, BranchComparison } from '../hooks/useAnalytics';

// --- Colors ---
const COLORS = [
    '#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', // Slate
    '#0891b2', '#06b6d4', '#22d3ee', // Cyan
    '#059669', '#10b981', '#34d399', // Emerald
    '#7c3aed', '#8b5cf6', '#a78bfa', // Violet
];

// --- Simple Table Component ---
const BranchComparisonTable: React.FC<{ data: BranchComparison[] }> = ({ data }) => {
    const maxFact = Math.max(...data.map(d => d.fact), 1); // Avoid div by zero

    return (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead className="sticky top-0 bg-white z-10">
                    <tr>
                        <th className="pb-3 pt-2 text-slate-400 font-medium pl-4 border-b border-slate-100 bg-white">Филиал</th>
                        <th className="pb-3 pt-2 text-right text-slate-400 font-medium border-b border-slate-100 bg-white">План</th>
                        <th className="pb-3 pt-2 text-left pl-8 text-slate-400 font-medium border-b border-slate-100 bg-white min-w-[150px]">Факт</th>
                        <th className="pb-3 pt-2 text-right text-slate-400 font-medium border-b border-slate-100 bg-white">Отклонение</th>
                        <th className="pb-3 pt-2 text-right text-slate-400 font-medium pr-4 border-b border-slate-100 bg-white">%</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item) => (
                        <tr
                            key={item.id}
                            className="group hover:bg-slate-50 transition-colors"
                        >
                            <td className="py-3 pl-4 font-semibold text-slate-700 border-b border-slate-50">{item.name}</td>
                            <td className="py-3 text-right text-slate-500 border-b border-slate-50">{formatMoney(item.plan)}</td>

                            {/* Visual Data Bar Cell */}
                            <td className="py-3 pl-8 text-slate-900 font-bold border-b border-slate-50 relative">
                                <div className="flex items-center gap-2 relative z-10">
                                    <span>{formatMoney(item.fact)}</span>
                                </div>
                                {/* The Data Bar */}
                                <div
                                    className="absolute left-6 top-2 bottom-2 bg-slate-100 rounded-r-md -z-0 transition-all duration-500"
                                    style={{ width: `${(item.fact / maxFact) * 80}%` }}
                                />
                            </td>

                            <td className={`py-3 text-right font-bold border-b border-slate-50 ${item.diff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {item.diff > 0 ? '+' : ''}{formatMoney(item.diff)}
                            </td>
                            <td className="py-3 text-right pr-4 border-b border-slate-50">
                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${item.percent > 100 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {item.percent}%
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// --- Skeleton Loader Component ---
const DashboardSkeleton = () => (
    <div className="space-y-8 pb-10 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center">
            <div className="space-y-3">
                <div className="h-8 w-64 bg-slate-200 rounded-lg"></div>
                <div className="h-4 w-96 bg-slate-100 rounded-lg"></div>
            </div>
            <div className="h-10 w-32 bg-slate-200 rounded-xl"></div>
        </div>

        {/* KPI Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-40 bg-slate-100 rounded-2xl border border-slate-200"></div>
            ))}
        </div>

        {/* Charts Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 h-[500px] bg-slate-100 rounded-2xl border border-slate-200"></div>
            <div className="h-[500px] bg-slate-100 rounded-2xl border border-slate-200"></div>
        </div>

        {/* Bottom Section Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="h-96 bg-slate-100 rounded-2xl border border-slate-200"></div>
            <div className="lg:col-span-2 h-96 bg-slate-100 rounded-2xl border border-slate-200"></div>
        </div>
    </div>
);

// --- Main Component ---
export default function AnalyticsPageOptimized() {
    // Hooks
    const {
        summary: { data: summary, isLoading: isSummaryLoading },
        branchComparison: { data: branchComparison = [] },
        topEmployees: { data: topEmployees = [] },
        costDistribution: { data: costDistribution = [] },
        isLoading
    } = useAnalytics();

    const refreshMutation = useRefreshAnalytics();

    // Chart animation state
    const [chartsReady, setChartsReady] = useState(false);

    // Fake ease-in for charts
    useState(() => {
        setTimeout(() => setChartsReady(true), 100);
    });

    const handleRefresh = async () => {
        await refreshMutation.mutateAsync();
    };

    if (isLoading || isSummaryLoading || !summary) {
        return <DashboardSkeleton />;
    }

    const { fact, plan, metrics } = summary;

    return (
        <div className="space-y-8 pb-10">
            {/* Page Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Аналитика ФОТ</h1>
                    <p className="text-slate-500 mt-2 text-lg">Комплексный обзор расходов и показателей эффективности</p>
                    {summary.cached_at && (
                        <p className="text-xs text-slate-400 mt-1">
                            Обновлено: {new Date(summary.cached_at).toLocaleString('ru-RU')}
                        </p>
                    )}
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                    Обновить
                </button>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 1. Budget Execution */}
                <div className="relative overflow-hidden bg-slate-900 p-6 rounded-2xl shadow-xl shadow-slate-900/20 group hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-white/10 rounded-xl text-slate-300">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Исполнение бюджета</p>
                            </div>
                            <div className="text-4xl font-bold text-white mb-2">{metrics.execution_percent.toFixed(1)}%</div>
                        </div>

                        <div>
                            <div className="w-full bg-slate-700/50 rounded-full h-1.5 mb-2 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${metrics.execution_percent > 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(metrics.execution_percent, 100)}%` }}
                                />
                            </div>
                            <div className="text-xs text-slate-400 flex items-center justify-between">
                                <span>План: {formatMoney(plan.total_net)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Fact Total */}
                <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-lg border border-slate-100 group hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-emerald-100"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                                <Wallet className="w-6 h-6" />
                            </div>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Фактический ФОТ</p>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 mb-1">{formatMoney(fact.total_net)}</div>
                        <p className={`text-xs font-semibold mt-2 ${metrics.is_over_budget ? 'text-red-500' : 'text-emerald-500'}`}>
                            {metrics.is_over_budget ? `Перерасход ${formatMoney(Math.abs(metrics.diff_net))}` : `Экономия ${formatMoney(Math.abs(metrics.diff_net))}`}
                        </p>
                    </div>
                </div>

                {/* 3. Headcount */}
                <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-lg border border-slate-100 group hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-blue-100"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                                <Users className="w-6 h-6" />
                            </div>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Штат</p>
                        </div>
                        <div className="flex items-end gap-2 mb-1">
                            <div className="text-3xl font-bold text-slate-900">{fact.count}</div>
                            <div className="text-sm text-slate-400 mb-1.5 font-medium">/ {plan.count} план</div>
                        </div>
                        <p className={`text-xs font-semibold mt-2 ${metrics.headcount_diff > 0 ? 'text-red-500' : 'text-slate-500'}`}>
                            {metrics.headcount_diff > 0 ? `+${metrics.headcount_diff} сверх плана` : `${metrics.headcount_diff} вакансий`}
                        </p>
                    </div>
                </div>

                {/* 4. Deviation Status */}
                <div className={`relative overflow-hidden p-6 rounded-2xl shadow-lg border group hover:-translate-y-1 transition-all duration-300 ${metrics.is_over_budget ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-3 rounded-xl ${metrics.is_over_budget ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'}`}>
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <p className={`text-sm font-bold uppercase tracking-wider ${metrics.is_over_budget ? 'text-red-400' : 'text-green-600/70'}`}>Статус</p>
                        </div>
                        <div className={`text-2xl font-bold ${metrics.is_over_budget ? 'text-red-700' : 'text-green-700'}`}>
                            {metrics.is_over_budget ? 'Требует внимания' : 'В рамках бюджета'}
                        </div>
                        <p className={`text-xs mt-2 ${metrics.is_over_budget ? 'text-red-500' : 'text-green-600'}`}>
                            {metrics.is_over_budget ? 'Расходы превышают плановые показатели' : 'Оптимальное расходование средств'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Bar Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border border-slate-100 transition-opacity duration-500" style={{ opacity: chartsReady ? 1 : 0 }}>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Target className="w-5 h-5 text-slate-400" />
                                План-Факт анализ
                            </h3>
                            <p className="text-slate-500 text-sm mt-1">Сравнение ФОТ по филиалам</p>
                        </div>
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="99%" height="100%">
                            <BarChart data={branchComparison} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `${val / 1000}k`} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => formatMoney(value)}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="plan" name="План" fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={32} animationDuration={1500} animationBegin={200} />
                                <Bar dataKey="fact" name="Факт" fill="#0f172a" radius={[6, 6, 0, 0]} barSize={32} animationDuration={1500} animationBegin={200} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribution Pie Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col transition-opacity duration-500 delay-100" style={{ opacity: chartsReady ? 1 : 0 }}>
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <PieIcon className="w-5 h-5 text-slate-400" />
                            Структура расходов
                        </h3>
                        <p className="text-slate-500 text-sm mt-1">Доля филиалов в общем ФОТ</p>
                    </div>
                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="99%" height="100%">
                            <PieChart>
                                <Pie
                                    data={costDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    animationDuration={1500}
                                    animationBegin={200}
                                >
                                    {costDistribution.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ borderRadius: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Top Spenders & Detailed Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top Spenders */}
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-slate-400" />
                        Топ 5 Выплат
                    </h3>
                    <div className="space-y-4">
                        {topEmployees.map((emp, i) => (
                            <div key={emp.id} className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors p-2 rounded-lg">
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs">#{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-800 truncate">{emp.full_name}</div>
                                    <div className="text-xs text-slate-500 truncate">{emp.position}</div>
                                </div>
                                <div className="text-right font-bold text-slate-900">
                                    {formatMoney(emp.total_net)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Virtualized Detailed Breakdown Table */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">
                        Детализация отклонений ({branchComparison.length} филиалов)
                    </h3>
                    <BranchComparisonTable data={branchComparison} />
                </div>
            </div>
        </div>
    );
}
