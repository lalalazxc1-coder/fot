import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatMoney } from '../utils';
import { PageHeader } from '../components/shared';
import { Plus, Trash2, ArrowRight, Save, LayoutDashboard, Copy, Filter, Calculator, Building2, Briefcase, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import Modal from '../components/Modal';
import { useFlatStructure } from '../hooks/useStructure';

// --- Types ---
interface Scenario {
    id: number;
    name: string;
    description?: string;
    status: string;
    created_at: string;
}

interface comparisonData {
    total_net: number;
    total_gross: number;
    total_taxes: number;
    total_budget: number;
}

interface ComparisonResult {
    live: comparisonData;
    scenario: comparisonData;
    delta: {
        net: number;
        budget: number;
        percent: number;
    };
}

// --- Components ---

const ComparisonCard = ({ title, live, scenario, type = 'money', icon: Icon }: { title: string, live: number, scenario: number, type?: 'money' | 'percent', icon?: any }) => {
    const diff = scenario - live;
    const percent = live ? (diff / live) * 100 : 0;
    const isPositive = diff > 0;
    // For budget, increase is usually "bad" cost-wise, but for salary increase is "good" for employee.
    // Let's stick to: Increase = Green (Growth), Decrease = Red.
    const color = isPositive ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-500';
    const bg = isPositive ? 'bg-emerald-50' : diff < 0 ? 'bg-rose-50' : 'bg-slate-50';
    const borderColor = isPositive ? 'border-emerald-100' : diff < 0 ? 'border-rose-100' : 'border-slate-100';

    return (
        <div className={`bg-white p-4 rounded-xl border ${borderColor} shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    {Icon && <div className={`p-1.5 rounded-lg ${bg} ${color}`}><Icon size={16} /></div>}
                    <h4 className="text-slate-500 text-xs font-semibold uppercase tracking-wide">{title}</h4>
                </div>
                {diff !== 0 && (
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${bg} ${color}`}>
                        {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {Math.abs(percent).toFixed(1)}%
                    </div>
                )}
            </div>

            <div className="space-y-0.5">
                <div className="text-xl font-bold text-slate-900 tracking-tight">
                    {type === 'money' ? formatMoney(scenario) : `${scenario.toFixed(1)}%`}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>Текущий: {type === 'money' ? formatMoney(live) : `${live.toFixed(1)}%`}</span>
                    {diff !== 0 && (
                        <span className={color}>
                            {diff > 0 ? '+' : ''}{type === 'money' ? formatMoney(diff) : diff.toFixed(1)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function ScenariosPage() {
    const queryClient = useQueryClient();
    const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Structure Data
    const { data: flatStructure = [] } = useFlatStructure();

    // Mass Update State
    const [massUpdateField, setMassUpdateField] = useState('base_net');
    const [massUpdateType, setMassUpdateType] = useState('percent');
    const [massUpdateValue, setMassUpdateValue] = useState(0);
    const [targetUnit, setTargetUnit] = useState<{ type: string, id: number | null }>({ type: 'all', id: null });

    // Queries
    const { data: scenarios = [] } = useQuery({
        queryKey: ['scenarios'],
        queryFn: async () => (await api.get<Scenario[]>('/scenarios/')).data
    });

    const { data: comparison } = useQuery({
        queryKey: ['scenario-comparison', selectedScenarioId],
        queryFn: async () => (await api.get<ComparisonResult>(`/scenarios/${selectedScenarioId}/comparison`)).data,
        enabled: !!selectedScenarioId
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: { name: string, description: string }) => api.post('/scenarios/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scenarios'] });
            setIsCreateModalOpen(false);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/scenarios/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scenarios'] });
            if (selectedScenarioId) setSelectedScenarioId(null);
        }
    });

    const massUpdateMutation = useMutation({
        mutationFn: (data: any) => api.post(`/scenarios/${selectedScenarioId}/apply-change`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scenario-comparison', selectedScenarioId] });
            // Optional: Show toast
        }
    });

    const commitMutation = useMutation({
        mutationFn: () => api.post(`/scenarios/${selectedScenarioId}/commit`),
        onSuccess: () => {
            alert("Сценарий успешно применен! Живой бюджет обновлен.");
            setSelectedScenarioId(null);
            queryClient.invalidateQueries({ queryKey: ['scenarios'] });
            // Reload planning/employees
            queryClient.invalidateQueries({ queryKey: ['planning'] });
        }
    });

    // Handlers
    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const name = (form.elements.namedItem('name') as HTMLInputElement).value;
        const desc = (form.elements.namedItem('desc') as HTMLTextAreaElement).value;
        createMutation.mutate({ name, description: desc });
    };

    const handleMassUpdate = () => {
        if (!selectedScenarioId) return;

        let payload: any = {
            field: massUpdateField,
            change_type: massUpdateType,
            value: Number(massUpdateValue),
        };

        if (targetUnit.type === 'branch') payload.target_branch_id = targetUnit.id;
        if (targetUnit.type === 'department') payload.target_department_id = targetUnit.id;
        // if type is 'all', send nothing (globally)

        massUpdateMutation.mutate(payload);
    };

    // Helper to render options with indentation
    const renderStructureOptions = useMemo(() => {
        // Build a hierarchy for display
        // Since flatStructure is flat, we can sort by type or build a tree.
        // Simple approach: Indent based on logical hierarchy if possible, or just list by type.

        // Let's create a map relative to parents
        const roots = flatStructure.filter(i => !i.parent_id);
        const getChildren = (pid: number) => flatStructure.filter(i => i.parent_id === pid);

        const options: JSX.Element[] = [];

        const renderNode = (node: any, level: number) => {
            const prefix = '\u00A0\u00A0\u00A0\u00A0'.repeat(level); // 4 spaces
            const icon = node.type === 'head_office' ? '🏢 ' : node.type === 'branch' ? '🏢 ' : '📁 ';
            const value = JSON.stringify({ type: node.type === 'head_office' ? 'branch' : node.type, id: node.id });
            // HEAD OFFICE treated as branch for filtering usually, or special logic. Backend might treat head_office as branch_id logic.
            // Actually backend 'branch_id' usually matches 'OrganizationUnit' id where parent is null/head.

            // Let's assume standard IDs work.
            // Backend `target_branch_id` filters by `PlanningPosition.branch_id`.
            // `target_department_id` filters by `PlanningPosition.department_id`.
            // If unit is 'head_office', it likely maps to a branch_id in planning.

            options.push(
                <option key={node.id} value={value}>
                    {prefix}{icon}{node.name}
                </option>
            );

            getChildren(node.id).forEach(c => renderNode(c, level + 1));
        };

        roots.forEach(r => renderNode(r, 0));
        return options;
    }, [flatStructure]);

    return (
        <div className="space-y-8 pb-12">
            <PageHeader
                title="Сценарное планирование"
                subtitle="Песочница для моделирования изменений бюджета"
                extra={
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-[0.98] text-sm font-medium"
                    >
                        <Plus size={16} />
                        Новый сценарий
                    </button>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left: Scenario List */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="font-bold text-slate-800 text-base">Версии бюджета</h3>
                        <span className="text-xs font-semibold bg-slate-100 px-2 py-1 rounded-full text-slate-500">{scenarios.length}</span>
                    </div>

                    <div className="space-y-4">
                        {scenarios.map((s) => (
                            <div
                                key={s.id}
                                onClick={() => setSelectedScenarioId(s.id)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 group relative overflow-hidden ${selectedScenarioId === s.id
                                    ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500/20 shadow-md'
                                    : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-3 relative z-10">
                                    <div className={`font-bold text-base ${selectedScenarioId === s.id ? 'text-blue-900' : 'text-slate-800'}`}>{s.name}</div>
                                    {selectedScenarioId === s.id && (
                                        <div className="text-blue-600">
                                            <LayoutDashboard size={18} />
                                        </div>
                                    )}
                                </div>
                                <div className="text-sm text-slate-500 line-clamp-2 mb-4 h-10 leading-relaxed">{s.description || 'Нет описания'}</div>
                                <div className="flex items-center justify-between text-xs relative z-10">
                                    <span className={`px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${s.status === 'committed'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-600'
                                        }`}>
                                        {s.status === 'draft' ? 'Черновик' : s.status}
                                    </span>
                                    <span className="text-slate-400 font-medium">{new Date(s.created_at).toLocaleDateString()}</span>
                                </div>

                                {/* Delete Hover Action */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); if (confirm('Удалить сценарий?')) deleteMutation.mutate(s.id); }}
                                    className="absolute top-2 right-2 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}

                        {scenarios.length === 0 && (
                            <div className="text-center py-12 px-6 text-slate-400 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                <Copy className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Нет сохраненных версий.</p>
                                <button onClick={() => setIsCreateModalOpen(true)} className="text-blue-600 font-bold hover:underline mt-2 text-sm">Создать первую</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Workspace */}
                <div className="lg:col-span-3">
                    {selectedScenarioId && comparison ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* Comparison Section */}
                            <div>
                                <h3 className="text-base font-bold text-slate-800 mb-3 px-1">Сравнение показателей</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <ComparisonCard
                                        title="Фонд оплаты труда"
                                        live={comparison.live.total_budget}
                                        scenario={comparison.scenario.total_budget}
                                        icon={Building2}
                                    />
                                    <ComparisonCard
                                        title="На руки (Net)"
                                        live={comparison.live.total_net}
                                        scenario={comparison.scenario.total_net}
                                        icon={DollarSign}
                                    />
                                    <ComparisonCard
                                        title="Налоги компании"
                                        live={comparison.live.total_taxes}
                                        scenario={comparison.scenario.total_taxes}
                                        icon={Briefcase}
                                    />
                                </div>
                            </div>

                            {/* Simulator Section */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3">
                                    <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-md shadow-indigo-200">
                                        <Calculator size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-base text-slate-900">Симулятор изменений</h3>
                                        <p className="text-xs text-slate-500">Авторассчет налогов при изменении условий</p>
                                    </div>
                                </div>

                                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Column 1: Filter */}
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Filter size={14} className="text-slate-400" />
                                                <label className="text-sm font-bold text-slate-700">Где применить:</label>
                                            </div>
                                            <select
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all cursor-pointer hover:bg-slate-100"
                                                value={JSON.stringify(targetUnit)}
                                                onChange={(e) => setTargetUnit(JSON.parse(e.target.value))}
                                            >
                                                <option value={JSON.stringify({ type: 'all', id: null })}>🌍 Во всей компании</option>
                                                {renderStructureOptions}
                                            </select>
                                            <p className="text-[10px] text-slate-400 mt-1 pl-1 leading-relaxed">
                                                Выберите подразделение для массового применения изменений.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Column 2: Action */}
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Изменяемое поле:</label>
                                                <select
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                                    value={massUpdateField}
                                                    onChange={(e) => setMassUpdateField(e.target.value)}
                                                >
                                                    <option value="base_net">Оклад (Net)</option>
                                                    <option value="base_gross">Оклад (Gross)</option>
                                                    <option value="bonus_net">Бонусы (Net)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Тип изменения:</label>
                                                <select
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                                    value={massUpdateType}
                                                    onChange={(e) => setMassUpdateType(e.target.value)}
                                                >
                                                    <option value="percent">Процент (%)</option>
                                                    <option value="fixed_add">Добавить сумму (+)</option>
                                                    <option value="fixed_set">Установить значение (=)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">Значение:</label>
                                            <div className="flex gap-3">
                                                <input
                                                    type="number"
                                                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-base font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                                    value={massUpdateValue}
                                                    onChange={(e) => setMassUpdateValue(Number(e.target.value))}
                                                    placeholder="0"
                                                />
                                                <button
                                                    onClick={handleMassUpdate}
                                                    disabled={massUpdateMutation.isPending}
                                                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-bold text-sm shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {massUpdateMutation.isPending ? '...' : 'Применить'}
                                                    {!massUpdateMutation.isPending && <ArrowRight size={14} />}
                                                </button>
                                            </div>
                                            <div className="text-right mt-2 text-xs text-slate-400 font-medium">
                                                {massUpdateType === 'percent' ? `Изменение на ${massUpdateValue}%` : `Изменение на ${formatMoney(massUpdateValue)}`}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>


                            {/* Action Bar */}
                            <div className="flex items-center justify-between pt-4">
                                <p className="text-xs text-slate-400">
                                    Утверждение заменит текущий живой бюджет данными этого сценария.
                                </p>
                                <button
                                    onClick={() => { if (confirm(' Вы уверены? Текущий бюджет будет заменён данными этого сценария.')) commitMutation.mutate() }}
                                    disabled={commitMutation.isPending}
                                    className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-semibold text-sm shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save size={16} />
                                    {commitMutation.isPending ? 'Применение...' : 'Утвердить сценарий'}
                                </button>
                            </div>

                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[500px] border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                            <div className="bg-white p-6 rounded-full shadow-lg mb-6">
                                <LayoutDashboard size={48} className="text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 mb-2">Сценарий не выбран</h3>
                            <p className="text-slate-500 max-w-sm text-center mb-8">Выберите версию бюджета из списка слева для начала работы или создайте новую копию.</p>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-6 py-3 rounded-xl font-bold transition-colors"
                            >
                                + Создать копию текущего бюджета
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Новый сценарий"
            >
                <form onSubmit={handleCreate} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Название сценария</label>
                        <input
                            name="name"
                            required
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-900 outline-none transition-shadow"
                            placeholder="Например: Бюджет 2026 (Оптимистичный)"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Описание (опционально)</label>
                        <textarea
                            name="desc"
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm h-32 focus:ring-2 focus:ring-slate-900 outline-none resize-none transition-shadow"
                            placeholder="Краткое описание целей этого сценария..."
                        />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(false)}
                            className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="bg-slate-900 text-white px-6 py-2.5 rounded-xl hover:bg-slate-800 font-bold shadow-lg shadow-slate-900/20 disabled:opacity-50 transition-all hover:-translate-y-0.5"
                        >
                            {createMutation.isPending ? 'Клонирование...' : 'Создать копию'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
