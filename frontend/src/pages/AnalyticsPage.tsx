import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { Users, TrendingUp, DollarSign, Wallet, Target, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { Card } from '../components/ui-mocks';

// --- Types ---
type FinancialValue = { net: number; gross: number };
type EmployeeRecord = {
    id: number;
    full_name: string;
    branch: string; // Name
    total: FinancialValue;
};

type PlanRow = {
    id: number;
    branch_id?: string | number;
    department_id?: string | number; // Added
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

                setEmployees(emps);
                setStructure(structResponse);

                // Filter plans: 
                // 1. Backend filters by Branch Scope.
                // 2. Frontend refines by Department Scope logic (handling "General" vs "Dept-specific" visibility).
                const rawPlans: PlanRow[] = plansResponse;

                const structMap = new Map(structResponse.map((b: any) => [b.id.toString(), b]));

                const filteredPlans = rawPlans.filter(p => {
                    if (!p.branch_id) return false;
                    const branch = structMap.get(p.branch_id.toString());
                    if (!branch) return false; // Branch not in user's scope (should be handled by backend, but safe double-check)

                    // If plan is assigned to a specific department, verify user can see that department
                    const visibleDepts = branch.departments || [];

                    if (p.department_id) {
                        return visibleDepts.some((d: any) => d.id.toString() === p.department_id?.toString());
                    }

                    // If plan has NO department (Branch General):
                    // If the user sees specific departments (visibleDepts > 0), they are restricted.
                    // In this case, "Branch General" plans MUST be HIDDEN.
                    if (visibleDepts.length > 0) {
                        return false;
                    }

                    // If visibleDepts is empty, it means "No Depts in Branch" or "User sees Branch but it has no depts defined".
                    // In this case, show the General plan.
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
    const planTotalGross = plans.reduce((acc, p) => acc + ((p.base_gross + p.kpi_gross + p.bonus_gross) * p.count), 0);
    const planEmployeesCount = plans.reduce((acc, p) => acc + p.count, 0);

    // 2. FACT Totals
    const factTotalNet = employees.reduce((acc, e) => acc + e.total.net, 0);
    const factTotalGross = employees.reduce((acc, e) => acc + e.total.gross, 0);
    const factEmployeesCount = employees.length;

    // 3. Diff Logic
    const diffNet = factTotalNet - planTotalNet;
    const isOverBudget = diffNet > 0;
    const executionPercent = planTotalNet > 0 ? (factTotalNet / planTotalNet) * 100 : 0;

    // 4. Branch Comparison
    // We match by ID if possible, but employees have only Name.
    // Assuming structure defines the canonical names.
    const comparisonData = structure.map(b => {
        // Plan for this branch (Filtered by visible departments)
        const visibleDeptIds = new Set(b.departments?.map((d: any) => d.id.toString()) || []);

        const bPlans = plans.filter(p => {
            const isBranchMatch = p.branch_id?.toString() === b.id.toString();
            // If plan has dept_id, check if it's visible. If no dept_id, assume branch-wide (or handle as overhead)
            const isDeptMatch = !p.department_id || visibleDeptIds.has(p.department_id.toString());
            return isBranchMatch && isDeptMatch;
        });

        const planVal = bPlans.reduce((acc, p) => acc + ((p.base_net + p.kpi_net + p.bonus_net) * p.count), 0);

        // Fact: employees are already filtered by API
        const bFacts = employees.filter(e => e.branch === b.name);
        const factVal = bFacts.reduce((acc, e) => acc + e.total.net, 0);

        return {
            name: b.name,
            plan: planVal,
            fact: factVal,
            diff: factVal - planVal
        };
    }).filter(d => d.plan > 0 || d.fact > 0).sort((a, b) => b.fact - a.fact);


    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Аналитика ФОТ</h1>
                <p className="text-slate-500 mt-2 text-lg">Сравнение плановых показателей и фактических расходов</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* PLAN Card */}
                <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-lg border border-slate-100 group hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-slate-50 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-slate-100"></div>
                    <div className="relative">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
                                <Target className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">План (Net)</p>
                                <p className="text-xs text-slate-400">{planEmployeesCount} позиций</p>
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 mb-1">{formatMoney(planTotalNet)}</div>
                    </div>
                </div>

                {/* FACT Card */}
                <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-lg border border-slate-100 group hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-emerald-100"></div>
                    <div className="relative">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                                <Wallet className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Факт (Net)</p>
                                <p className="text-xs text-slate-400">{factEmployeesCount} сотрудников</p>
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 mb-1">{formatMoney(factTotalNet)}</div>
                    </div>
                </div>

                {/* Deviation Card */}
                <div className={`relative overflow-hidden bg-white p-6 rounded-2xl shadow-lg border border-slate-100 group hover:-translate-y-1 transition-all duration-300`}>
                    <div className={`absolute right-0 top-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16 transition-all ${isOverBudget ? 'bg-red-50 group-hover:bg-red-100' : 'bg-green-50 group-hover:bg-green-100'}`}></div>
                    <div className="relative">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-3 rounded-xl ${isOverBudget ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Отклонение</p>
                                <p className={`text-xs font-bold ${isOverBudget ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {isOverBudget ? 'Перерасход' : 'Экономия'}
                                </p>
                            </div>
                        </div>
                        <div className={`text-3xl font-bold mb-1 ${isOverBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                            {isOverBudget ? '+' : ''}{formatMoney(diffNet)}
                        </div>
                    </div>
                </div>

                {/* Execution Percent */}
                <div className="relative overflow-hidden bg-slate-900 p-6 rounded-2xl shadow-lg shadow-slate-900/20 group hover:-translate-y-1 transition-all duration-300 text-white">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div className="relative">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-white/10 rounded-xl text-slate-300">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Исполнение</p>
                                <p className="text-xs text-slate-400">бюджета</p>
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">
                            {executionPercent.toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Comparison Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-slate-900">План vs Факт по филиалам</h3>
                        <p className="text-slate-500 text-sm">Сравнение чистого оклада (Net) в разрезе филиалов</p>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `₸${val / 1000}k`} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => formatMoney(value)}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="plan" name="План" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="fact" name="Факт" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Detailed Table / Breakdown */}
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-slate-900">Детализация</h3>
                        <p className="text-slate-500 text-sm">Отклонения по филиалам</p>
                    </div>
                    <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
                        <div className="space-y-4">
                            {comparisonData.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-700 truncate" title={item.name}>{item.name}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">Исп: {item.plan > 0 ? ((item.fact / item.plan) * 100).toFixed(0) : 0}%</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-bold text-sm ${item.diff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {item.diff > 0 ? '+' : ''}{formatMoney(item.diff)}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {formatMoney(item.fact)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {comparisonData.length === 0 && <div className="text-center text-slate-400 py-10">Нет данных для сравнения</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
