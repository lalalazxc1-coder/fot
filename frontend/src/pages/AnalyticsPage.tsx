import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, Wallet, Target, AlertCircle, PieChart as PieIcon, Briefcase, RefreshCw, FileDown } from 'lucide-react';
import { PageHeader } from '../components/shared';
import { formatMoney } from '../utils';
import { useAnalytics, useRefreshAnalytics, BranchComparison } from '../hooks/useAnalytics';
import { RetentionDashboard } from '../components/analytics/RetentionDashboard';
import { ESGReport } from '../components/analytics/ESGReport';
import { StaffingGapsView } from '../components/analytics/StaffingGapsView';
import { TimeTravelPicker } from '../components/TimeTravelPicker';
import { AnalyticsEmployeeListModal } from '../components/analytics/AnalyticsEmployeeListModal';
import Papa from 'papaparse';

type BranchHierarchyNode = BranchComparison & {
    children: BranchHierarchyNode[];
};

type FlattenedBranchNode = BranchHierarchyNode & {
    depth: number;
};

const ANALYTICS_TABS = [
    { id: 'budget', label: 'Бюджет и ФОТ', icon: Wallet },
    { id: 'staffing', label: 'Штат и Текучесть', icon: Users },
    { id: 'retention', label: 'Удержание', icon: AlertCircle },
    { id: 'esg', label: 'ESG и Равенство', icon: TrendingUp },
] as const;

type AnalyticsTabId = (typeof ANALYTICS_TABS)[number]['id'];

// --- Colors ---
const COLORS = [
    '#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', // Slate
    '#0891b2', '#06b6d4', '#22d3ee', // Cyan
    '#059669', '#10b981', '#34d399', // Emerald
    '#7c3aed', '#8b5cf6', '#a78bfa', // Violet
];

// --- Simple Table Component ---
const BranchComparisonTable: React.FC<{ data: BranchComparison[], onUnitClick: (id: number, name: string) => void }> = ({ data, onUnitClick }) => {
    const maxFact = Math.max(...data.map(d => d.fact), 1); // Avoid div by zero

    // Build hierarchy
    const itemMap = new Map<number, BranchHierarchyNode>();
    data.forEach(item => itemMap.set(item.id, { ...item, children: [] }));

    const rootNodes: BranchHierarchyNode[] = [];
    itemMap.forEach(item => {
        if (item.parent_id && itemMap.has(item.parent_id)) {
            itemMap.get(item.parent_id)?.children.push(item);
        } else {
            rootNodes.push(item);
        }
    });

    const sortNodes = (nodes: BranchHierarchyNode[]) => {
        nodes.sort((a, b) => b.fact - a.fact);
        nodes.forEach(n => sortNodes(n.children));
    };
    sortNodes(rootNodes);

    const flattenNodes = (nodes: BranchHierarchyNode[], depth = 0): FlattenedBranchNode[] => {
        let result: FlattenedBranchNode[] = [];
        nodes.forEach(node => {
            result.push({ ...node, depth });
            result = result.concat(flattenNodes(node.children, depth + 1));
        });
        return result;
    };

    const flatHierarchy = flattenNodes(rootNodes);

    return (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto relative rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 backdrop-blur-md bg-white/85 text-slate-500 font-bold uppercase text-[10px] tracking-wider after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-slate-200/80 shadow-sm">
                    <tr>
                        <th className="px-4 py-3 font-bold">Подразделение</th>
                        <th className="px-4 py-3 font-bold text-right">План</th>
                        <th className="px-4 py-3 font-bold text-left pl-8 min-w-[150px]">Факт</th>
                        <th className="px-4 py-3 font-bold text-right">Отклонение</th>
                        <th className="px-4 py-3 font-bold text-right pr-4">%</th>
                    </tr>
                </thead>
                <tbody>
                    {flatHierarchy.map((item) => {
                        // Visual indicators for type
                        const getTypeIcon = (type?: string) => {
                            if (type === 'head_office') return '🏛️';
                            if (type === 'branch') return '🏢';
                            if (type === 'department') return '📁';
                            return '📊';
                        };

                        const getTypeColor = (type?: string) => {
                            if (type === 'head_office') return 'text-purple-700';
                            if (type === 'branch') return 'text-blue-700';
                            if (type === 'department') return 'text-slate-600';
                            return 'text-slate-700';
                        };

                        return (
                            <tr
                                key={item.id}
                                className="group hover:bg-slate-50 transition-colors cursor-pointer"
                                onClick={() => onUnitClick(item.id, item.name)}
                            >
                                <td
                                    className={`py-3 font-semibold border-b border-slate-50 relative ${getTypeColor(item.type)}`}
                                    style={{ paddingLeft: `${1 + item.depth * 1.5}rem` }}
                                >
                                    {/* Tree Line Connector */}
                                    {item.depth > 0 && (
                                        <div
                                            className="absolute left-[0.25rem] top-0 bottom-0 border-l border-slate-200"
                                            style={{ left: `${1 + (item.depth - 1) * 1.5 + 0.5}rem` }}
                                        />
                                    )}
                                    {item.depth > 0 && (
                                        <div
                                            className="absolute top-1/2 w-3 border-t border-slate-200"
                                            style={{ left: `${1 + (item.depth - 1) * 1.5 + 0.5}rem` }}
                                        />
                                    )}

                                    <div className="flex items-center gap-2 relative z-10 bg-white group-hover:bg-slate-50 w-fit pl-1">
                                        <span className="text-base">{getTypeIcon(item.type)}</span>
                                        <span className={item.depth === 0 ? "font-bold text-slate-900" : ""}>{item.name}</span>
                                    </div>
                                </td>
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
                        );
                    })}
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
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
export default function AnalyticsPage() {
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

    // Drill-down state
    const [drillDown, setDrillDown] = useState<{ isOpen: boolean, title: string, filters: { unit_id?: number, position?: string } }>({
        isOpen: false,
        title: '',
        filters: {}
    });

    const handleUnitClick = (id: number, name: string) => {
        setDrillDown({
            isOpen: true,
            title: `Сотрудники подразделения: ${name}`,
            filters: { unit_id: id }
        });
    };

    const handleExportCSV = () => {
        const csv = Papa.unparse(branchComparison.map(b => ({
            "Подразделение": b.name,
            "Тип": b.type,
            "План": b.plan,
            "Факт": b.fact,
            "Отклонение": b.diff,
            "Процент": b.percent
        })));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `analytics_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Optimization: Group small slices for Pie Chart ---
    const processedPieData = useMemo(() => {
        if (!costDistribution || costDistribution.length === 0) return [];

        // Sort by value descending
        const sorted = [...costDistribution].sort((a, b) => b.value - a.value);

        // If 7 or fewer items, show all
        if (sorted.length <= 7) return sorted;

        // Otherwise keep top 6 and group rest
        const top = sorted.slice(0, 6);
        const othersValue = sorted.slice(6).reduce((acc, curr) => acc + curr.value, 0);

        return [
            ...top,
            { name: 'Прочее', value: othersValue }
        ];
    }, [costDistribution]);

    // Fake ease-in for charts
    useState(() => {
        setTimeout(() => setChartsReady(true), 100);
    });

    const handleRefresh = async () => {
        await refreshMutation.mutateAsync();
    };

    // Tab state
    const [activeTab, setActiveTab] = useState<AnalyticsTabId>('budget');

    // ... (rest of loading checks)
    if (isLoading || isSummaryLoading || !summary) {
        return <DashboardSkeleton />;
    }

    const { fact, plan, metrics } = summary;

    return (
        <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PageHeader
                title="Аналитика ФОТ"
                subtitle="Комплексный обзор расходов и показателей эффективности"
                extra={summary.cached_at && (
                    <p className="text-xs text-slate-400 mt-2 italic shadow-sm bg-slate-50 inline-block px-2 py-1 rounded">
                        Обновлено: {new Date(summary.cached_at).toLocaleString('ru-RU')}
                    </p>
                )}
            >
                <div className="flex gap-2">
                    <TimeTravelPicker />
                    <button
                        onClick={handleRefresh}
                        disabled={refreshMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap shadow-lg shadow-slate-900/10"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                        Обновить
                    </button>
                </div>
            </PageHeader>

            {/* Tab Navigation */}
            <div className="flex p-1 bg-slate-100 rounded-xl w-full md:w-fit overflow-x-auto">
                {ANALYTICS_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Content - Budget Tab */}
            {activeTab === 'budget' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
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

                        {/* 3. Headcount (Main Dashboard) */}
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
                                            data={processedPieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            animationDuration={1500}
                                            animationBegin={200}
                                        >
                                            {processedPieData.map((_, index) => (
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

                        {/* Table */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-900">
                                    Детализация отклонений ({branchComparison.length} филиалов)
                                </h3>
                                <button
                                    onClick={handleExportCSV}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors text-xs font-bold border border-slate-200"
                                >
                                    <FileDown className="w-3.5 h-3.5" />
                                    Экспорт CSV
                                </button>
                            </div>
                            <BranchComparisonTable data={branchComparison} onUnitClick={handleUnitClick} />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'staffing' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <StaffingGapsView />
                </div>
            )}

            {activeTab === 'retention' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <RetentionDashboard />
                </div>
            )}

            {activeTab === 'esg' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <ESGReport />
                </div>
            )}

            <AnalyticsEmployeeListModal
                isOpen={drillDown.isOpen}
                onClose={() => setDrillDown({ ...drillDown, isOpen: false })}
                title={drillDown.title}
                filters={drillDown.filters}
            />
        </div>
    );
}
