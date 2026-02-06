import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, DollarSign, Wallet, Target, AlertCircle, PieChart as PieIcon, Briefcase } from 'lucide-react';
import { api } from '../lib/api';

// --- Types ---
type FinancialValue = { net: number; gross: number };
type EmployeeRecord = {
    id: number;
    full_name: string;
    position: string; // Added position
    branch: string; // Name
    status: string;
    total: FinancialValue;
};

type PlanRow = {
    id: number;
    branch_id?: string | number;
    department_id?: string | number;
    count: number;
    base_net: number;
    kpi_net: number;
    bonus_net: number;
    base_gross: number;
    kpi_gross: number;
    bonus_gross: number;
};

type Structure = {
    id: number;
    name: string;
    departments?: { id: number; name: string }[]
};

// --- Formatters ---
const formatMoney = (val: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(val);

const COLORS = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'];

export default function AnalyticsPage() {
    const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
    const [plans, setPlans] = useState<PlanRow[]>([]);
    const [structure, setStructure] = useState<Structure[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                // Parallel fetch for speed
                const [emps, structResponse, plansResponse] = await Promise.all([
                    api.get('/employees'),
                    api.get('/structure'),
                    api.get('/planning')
                ]);

                // Filter out Dismissed employees
                const activeEmps = (emps as EmployeeRecord[]).filter(e => e.status !== 'Dismissed');
                setEmployees(activeEmps);
                setStructure(structResponse);

                // Filter plans (reuse logic)
                const rawPlans: PlanRow[] = plansResponse;
                const structMap = new Map(structResponse.map((b: any) => [b.id.toString(), b]));

                const filteredPlans = rawPlans.filter(p => {
                    if (!p.branch_id) return false;
                    const branch = structMap.get(p.branch_id.toString());
                    if (!branch) return false;
                    const visibleDepts = branch.departments || [];
                    if (p.department_id) {
                        return visibleDepts.some((d: any) => d.id.toString() === p.department_id?.toString());
                    }
                    // Hide general plans if restricted to specific depts
                    if (visibleDepts.length > 0) return false;
                    return true;
                });

                setPlans(filteredPlans);

            } catch (e) {
                console.error("Analytics fetch error:", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-4"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />Загрузка данных...</div>;

    // --- Calculations ---

    // 1. PLAN Totals
    const planTotalNet = plans.reduce((acc, p) => acc + ((p.base_net + p.kpi_net + p.bonus_net) * p.count), 0);
    const planEmployeesCount = plans.reduce((acc, p) => acc + p.count, 0);

    // 2. FACT Totals
    const factTotalNet = employees.reduce((acc, e) => acc + e.total.net, 0);
    const factEmployeesCount = employees.length;

    // 3. Diff Logic
    const diffNet = factTotalNet - planTotalNet;
    const isOverBudget = diffNet > 0;
    const executionPercent = planTotalNet > 0 ? (factTotalNet / planTotalNet) * 100 : 0;

    // Headcount logic
    const headcountDiff = factEmployeesCount - planEmployeesCount;
    // const headcountPercent = planEmployeesCount > 0 ? (factEmployeesCount / planEmployeesCount) * 100 : 0;

    // 4. Branch Comparison (Bar Chart)
    const comparisonData = structure.map(b => {
        const visibleDeptIds = new Set(b.departments?.map((d: any) => d.id.toString()) || []);
        const bPlans = plans.filter(p => {
            const isBranchMatch = p.branch_id?.toString() === b.id.toString();
            const isDeptMatch = !p.department_id || visibleDeptIds.has(p.department_id.toString());
            return isBranchMatch && isDeptMatch;
        });

        const planVal = bPlans.reduce((acc, p) => acc + ((p.base_net + p.kpi_net + p.bonus_net) * p.count), 0);
        const bFacts = employees.filter(e => e.branch === b.name);
        const factVal = bFacts.reduce((acc, e) => acc + e.total.net, 0);

        return {
            name: b.name,
            plan: planVal,
            fact: factVal,
            diff: factVal - planVal
        };
    }).filter(d => d.plan > 0 || d.fact > 0).sort((a, b) => b.fact - a.fact);

    // 5. Cost Distribution (Pie Chart)
    const distributionData = comparisonData.map(d => ({
        name: d.name,
        value: d.fact
    })).filter(d => d.value > 0);

    // 6. Top Spenders / Analysis
    const topPositions = [...employees]
        .sort((a, b) => b.total.net - a.total.net)
        .slice(0, 5);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Аналитика ФОТ</h1>
                <p className="text-slate-500 mt-2 text-lg">Комплексный обзор расходов и показателей эффективности</p>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* 1. Budget Execution */}
                <div className="relative overflow-hidden bg-slate-900 p-6 rounded-2xl shadow-xl shadow-slate-900/20 group hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-white/10 rounded-xl text-slate-300">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Исполнение бюджета</p>
                        </div>
                        <div className="text-4xl font-bold text-white mb-2">{executionPercent.toFixed(1)}%</div>
                        <div className="text-xs text-slate-400 flex items-center justify-between">
                            <span>План: {formatMoney(planTotalNet)}</span>
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
                        <div className="text-3xl font-bold text-slate-900 mb-1">{formatMoney(factTotalNet)}</div>
                        <p className={`text-xs font-semibold mt-2 ${isOverBudget ? 'text-red-500' : 'text-emerald-500'}`}>
                            {isOverBudget ? `Перерасход ${formatMoney(Math.abs(diffNet))}` : `Экономия ${formatMoney(Math.abs(diffNet))}`}
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
                            <div className="text-3xl font-bold text-slate-900">{factEmployeesCount}</div>
                            <div className="text-sm text-slate-400 mb-1.5 font-medium">/ {planEmployeesCount} план</div>
                        </div>
                        <p className={`text-xs font-semibold mt-2 ${headcountDiff > 0 ? 'text-red-500' : 'text-slate-500'}`}>
                            {headcountDiff > 0 ? `+${headcountDiff} сверх плана` : `${headcountDiff} вакансий`}
                        </p>
                    </div>
                </div>

                {/* 4. Deviation Status */}
                <div className={`relative overflow-hidden p-6 rounded-2xl shadow-lg border group hover:-translate-y-1 transition-all duration-300 ${isOverBudget ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-3 rounded-xl ${isOverBudget ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'}`}>
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <p className={`text-sm font-bold uppercase tracking-wider ${isOverBudget ? 'text-red-400' : 'text-green-600/70'}`}>Статус</p>
                        </div>
                        <div className={`text-2xl font-bold ${isOverBudget ? 'text-red-700' : 'text-green-700'}`}>
                            {isOverBudget ? 'Требует внимания' : 'В рамках бюджета'}
                        </div>
                        <p className={`text-xs mt-2 ${isOverBudget ? 'text-red-500' : 'text-green-600'}`}>
                            {isOverBudget ? 'Расходы превышают плановые показатели' : 'Оптимальное расходование средств'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Main Bar Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
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
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `${val / 1000}k`} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => formatMoney(value)}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="plan" name="План" fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={32} />
                                <Bar dataKey="fact" name="Факт" fill="#0f172a" radius={[6, 6, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribution Pie Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col">
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <PieIcon className="w-5 h-5 text-slate-400" />
                            Структура расходов
                        </h3>
                        <p className="text-slate-500 text-sm mt-1">Доля филиалов в общем ФОТ</p>
                    </div>
                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={distributionData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {distributionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ borderRadius: '12px' }} />
                                <Legend layout="horizontal" verticalAlign="bottom" align="center" />
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
                        {topPositions.map((emp, i) => (
                            <div key={emp.id} className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors p-2 rounded-lg">
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs">#{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-800 truncate">{emp.full_name}</div>
                                    <div className="text-xs text-slate-500 truncate">{emp.position}</div>
                                </div>
                                <div className="text-right font-bold text-slate-900">
                                    {formatMoney(emp.total.net)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Detailed Breakdown Table */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Детализация отклонений</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="pb-3 text-slate-400 font-medium pl-4">Филиал</th>
                                    <th className="pb-3 text-right text-slate-400 font-medium">План</th>
                                    <th className="pb-3 text-right text-slate-400 font-medium">Факт</th>
                                    <th className="pb-3 text-right text-slate-400 font-medium">Отклонение</th>
                                    <th className="pb-3 text-right text-slate-400 font-medium pr-4">%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparisonData.map((item, idx) => {
                                    const percent = item.plan > 0 ? ((item.fact / item.plan) * 100).toFixed(0) : 0;
                                    return (
                                        <tr key={idx} className="group hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                                            <td className="py-4 pl-4 font-semibold text-slate-700">{item.name}</td>
                                            <td className="py-4 text-right text-slate-500">{formatMoney(item.plan)}</td>
                                            <td className="py-4 text-right text-slate-900 font-bold">{formatMoney(item.fact)}</td>
                                            <td className={`py-4 text-right font-bold ${item.diff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {item.diff > 0 ? '+' : ''}{formatMoney(item.diff)}
                                            </td>
                                            <td className="py-4 text-right pr-4">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${Number(percent) > 100 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {percent}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
