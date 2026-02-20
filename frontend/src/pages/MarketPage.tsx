import React, { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../components/shared';
import { useOutletContext } from 'react-router-dom';
import { Plus, Loader2, Building2, X, Search, Users, HelpCircle, Globe, BarChart2, UploadCloud, Trash2, TrendingUp, Calculator, ExternalLink } from 'lucide-react';
import {
    useMarket,
    useCreateMarketEntry,
    useDeleteMarketEntry,
    useBulkCreateMarketEntry,
    useMarketEntries,
    useCreateMarketEntryPoint,
    useDeleteMarketEntryPoint,
    useSyncMarketData
} from '../hooks/useMarket';
import { useEmployees } from '../hooks/useEmployees';
import { usePositions } from '../hooks/usePositions';
import { useFlatStructure } from '../hooks/useStructure';
import { formatMoney } from '../utils';
import Modal from '../components/Modal';
import { CandidateSearch } from '../components/market/CandidateSearch';
import { toast } from 'sonner';

// --- Sub-components for Charts ---
const SalaryRangeChart = ({ min, max, median, employeeSalaries }: { min: number, max: number, median: number, employeeSalaries: number[] }) => {
    // Determine the visualization range
    const allVals = [min, max, median, ...employeeSalaries].filter(v => v > 0);
    const globalMin = Math.min(...allVals) * 0.8;
    const globalMax = Math.max(...allVals) * 1.1;
    const range = globalMax - globalMin;

    const getPos = (val: number) => ((val - globalMin) / range) * 100;

    return (
        <div className="relative w-full h-8 flex items-center group">
            {/* Background Track */}
            <div className="absolute inset-0 bg-slate-100 rounded-full h-1.5 top-1/2 -translate-y-1/2" />

            {/* Market Range Bar */}
            <div
                className="absolute h-3 bg-blue-100/50 border-x border-blue-200 shadow-sm top-1/2 -translate-y-1/2 rounded-sm"
                style={{
                    left: `${getPos(min)}%`,
                    width: `${getPos(max) - getPos(min)}%`
                }}
            />

            {/* Median Marker */}
            <div
                className="absolute h-5 w-1 bg-blue-600 z-10 top-1/2 -translate-y-1/2 shadow-sm"
                style={{ left: `${getPos(median)}%` }}
            />

            {/* Top Employee Markers (Individual Dots) */}
            {employeeSalaries.map((sal, idx) => (
                <div
                    key={idx}
                    className="absolute w-2 h-2 rounded-full border border-white shadow-sm z-20 top-1/2 -translate-y-1/2 bg-slate-800"
                    style={{ left: `${getPos(sal)}%` }}
                />
            ))}

            {/* Tooltip on Hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                Мин: {formatMoney(min)} | Медиана: {formatMoney(median)} | Макс: {formatMoney(max)}
            </div>
        </div>
    );
};

const MarketPositionDetails = ({ position, entries, marketId, canEdit }: { position: string, entries: any[], marketId: number, canEdit: boolean }) => {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newSalary, setNewSalary] = useState('');
    const [newCompany, setNewCompany] = useState('');

    // If no entries provided, fetch from backend
    const { data: fetchedEntries = [] } = useMarketEntries(marketId);

    // Use entries prop if valid and non-empty, otherwise use fetched entries
    const displayEntries = (entries && entries.length > 0) ? entries : fetchedEntries;

    const addMutation = useCreateMarketEntryPoint();
    const deleteMutation = useDeleteMarketEntryPoint();
    const useSyncMarketDataHook = useSyncMarketData();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!marketId) return;

        await addMutation.mutateAsync({
            market_id: marketId,
            company_name: newCompany,
            salary: Number(newSalary)
        });

        setIsAddOpen(false);
        setNewSalary('');
        setNewCompany('');
    };

    const handleDelete = async (pointId: number) => {
        if (confirm('Удалить эту запись?')) {
            deleteMutation.mutate({ id: pointId, marketId });
        }
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    Детализация по компаниям
                </h4>
                {canEdit && (
                    <div className="flex gap-2">
                        <button
                            onClick={async () => {
                                const toastId = toast.loading('Идет синхронизация с HH.kz...');
                                try {
                                    await useSyncMarketDataHook.mutateAsync(marketId);
                                } finally {
                                    toast.dismiss(toastId);
                                }
                            }}
                            disabled={useSyncMarketDataHook.isPending}
                            className={`text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 shadow-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${useSyncMarketDataHook.isPending ? 'opacity-50' : ''}`}
                        >
                            {useSyncMarketDataHook.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                            Синхронизировать
                        </button>
                        <button
                            onClick={() => setIsAddOpen(!isAddOpen)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            {isAddOpen ? 'Отмена' : '+ Добавить замер'}
                        </button>
                    </div>
                )}
            </div>

            {isAddOpen && (
                <form onSubmit={handleSubmit} className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                            required
                            placeholder="Компания"
                            className="text-xs p-2 rounded border border-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                            value={newCompany}
                            onChange={e => setNewCompany(e.target.value)}
                        />
                        <input
                            required
                            type="number"
                            placeholder="Зарплата (Net)"
                            className="text-xs p-2 rounded border border-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                            value={newSalary}
                            onChange={e => setNewSalary(e.target.value)}
                        />
                    </div>
                    <button className="w-full bg-slate-900 text-white text-xs font-bold py-2 rounded">Сохранить замер</button>
                </form>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {displayEntries.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs italic">Замеры еще не добавлены</div>
                ) : (
                    displayEntries.map((entry: any) => (
                        <div key={entry.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100 text-sm group">
                            <div className="flex items-center gap-2 max-w-[60%]">
                                <span className="font-medium text-slate-700 truncate" title={entry.company_name}>{entry.company_name}</span>
                                {entry.url && (
                                    <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-500 transition-colors shrink-0" title="Открыть вакансию на HH.kz">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-slate-600">{formatMoney(entry.salary)}</span>
                                {canEdit && (
                                    <button
                                        onClick={() => handleDelete(entry.id)}
                                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {displayEntries.length > 0 && (
                <div className="mt-3 text-xs text-slate-400 text-right">
                    Медиана рассчитывается автоматически на основе {displayEntries.length} записей.
                </div>
            )}
        </div>
    );
}

export default function MarketPage() {
    const { user } = useOutletContext<{ user: any }>();

    const { data: marketData = [], isLoading: isMarketLoading } = useMarket();
    const { data: employees = [], isLoading: isEmployeesLoading } = useEmployees();
    const { data: positions = [] } = usePositions();
    const { data: flatStructure = [] } = useFlatStructure();

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'position' | 'median' | 'updated'>('position');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const [filterBranch, setFilterBranch] = useState<string>('all');
    const [isImporting, setIsImporting] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const [selectedPosition, setSelectedPosition] = useState<any | null>(null);

    // Lock scroll when any modal is open
    useEffect(() => {
        const anyModalOpen = isAddOpen || !!selectedPosition || isHelpOpen;
        if (anyModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isAddOpen, selectedPosition, isHelpOpen]);

    const branches = useMemo(() => {
        const unique = new Set(employees.map((e: any) => e.branch).filter((b: any) => b && b !== 'Неизвестно'));
        return Array.from(unique).sort();
    }, [employees]);

    // Comparison Logic
    const comparisonData = useMemo(() => {
        // Group market data by position
        const grouped = marketData.reduce((acc: any, curr: any) => {
            if (!acc[curr.position_title]) acc[curr.position_title] = [];
            acc[curr.position_title].push(curr);
            return acc;
        }, {});

        const processed = Object.keys(grouped).map(pos => {
            const items = grouped[pos];
            const allPoints = items.flatMap((i: any) => i.points || []);

            // 1. Calculate Market Stats
            const salaries = allPoints.map((p: any) => p.salary).sort((a: any, b: any) => a - b);

            let median = 0, min = 0, max = 0;

            if (salaries.length > 0) {
                median = salaries.length % 2 === 0
                    ? (salaries[salaries.length / 2 - 1] + salaries[salaries.length / 2]) / 2
                    : salaries[Math.floor(salaries.length / 2)];
                min = salaries[0];
                max = salaries[salaries.length - 1];
            } else {
                // Fallback to pre-calculated values if points are missing
                // We aggregate values if there are multiple items for the same position title
                const validItems = items.filter((i: any) => i.median_salary > 0);
                if (validItems.length > 0) {
                    const mins = validItems.map((i: any) => i.min_salary).filter((v: number) => v > 0);
                    const maxs = validItems.map((i: any) => i.max_salary).filter((v: number) => v > 0);
                    const medians = validItems.map((i: any) => i.median_salary).filter((v: number) => v > 0);

                    min = mins.length ? Math.min(...mins) : 0;
                    max = maxs.length ? Math.max(...maxs) : 0;
                    median = medians.length ? medians.reduce((a: number, b: number) => a + b, 0) / medians.length : 0;
                }
            }

            // Calculate 25th percentile
            let p25 = 0;
            if (salaries.length > 0) {
                p25 = salaries[Math.floor(salaries.length * 0.25)];
            } else {
                p25 = min > 0 ? min + (median - min) / 2 : 0; // naive fallback if no raw points
            }

            // 2. Find internal employees
            const internal = employees.filter((e: any) => e.position === pos && (filterBranch === 'all' || e.branch === filterBranch));
            const internalSals = internal.map((e: any) => e.total.net);
            const internalMedian = internalSals.length > 0 ? (internalSals.reduce((a, b) => a + b, 0) / internalSals.length) : 0;

            // 3. Last update
            const validDates = items
                .map((i: any) => i.updated_at)
                .filter((d: any) => d && !isNaN(new Date(d).getTime()))
                .sort()
                .reverse();

            const lastUpdated = validDates.length > 0 ? validDates[0] : null;

            return {
                id: items[0].id,
                position: pos,
                points: allPoints,
                median_salary: median,
                min_salary: min,
                max_salary: max,
                p25: p25,
                employeesCount: internal.length,
                employeeSalaries: internalSals,
                avg_internal: internalMedian,
                deviation: median > 0 ? ((internalMedian - median) / median) * 100 : 0,
                belowP25: internalSals.filter(s => p25 > 0 && s < p25).length,
                updated_at: lastUpdated ? new Date(lastUpdated).toLocaleDateString() : '—',
                source: items.map((i: any) => i.source).join(', ')
            };
        });

        // Filtering
        let filtered = processed.filter(p => p.position.toLowerCase().includes(search.toLowerCase()));

        // Sorting
        filtered.sort((a, b) => {
            let valA: any, valB: any;
            if (sortBy === 'position') { valA = a.position; valB = b.position; }
            else if (sortBy === 'median') { valA = a.median_salary; valB = b.median_salary; }
            else { valA = a.updated_at; valB = b.updated_at; }

            const dir = sortDir === 'asc' ? 1 : -1;
            return valA > valB ? dir : -1 * dir;
        });
        return processed;
    }, [marketData, employees, search, sortBy, sortDir, filterBranch, flatStructure]);

    const createMutation = useCreateMarketEntry();
    const bulkCreateMutation = useBulkCreateMarketEntry();
    const deleteMutation = useDeleteMarketEntry();

    const [form, setForm] = useState({
        position_title: '',
        branch_id: null as number | null,
        source: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createMutation.mutateAsync(form);
            setIsAddOpen(false);
            setForm({ position_title: '', branch_id: null, source: '' });
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: number) => {
        if (confirm('Вы уверены? Это удалит всю позицию и все замеры по ней.')) {
            await deleteMutation.mutateAsync(id);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const rows = text.split('\n').filter(r => r.trim()).slice(1); // skip header
                const items = rows.map(r => {
                    const [position, company, salary, source] = r.split(',').map(s => s.trim());
                    return {
                        position_title: position,
                        company_name: company,
                        salary: Number(salary),
                        source: source || 'CSV Import'
                    };
                });

                await bulkCreateMutation.mutateAsync(items);
            } catch (err) {
                console.error(err);
                alert('Ошибка при разборе CSV. Формат: Должность,Компания,Зарплата,Источник');
            } finally {
                setIsImporting(false);
            }
        };
        reader.readAsText(file);
    };

    // Tree options for modal
    const hierarchicalOptions = useMemo(() => {
        if (!flatStructure) return [];
        const processed: any[] = [];
        const roots = flatStructure.filter(i => !i.parent_id);

        const renderNode = (node: any, level: number) => {
            const prefix = '\u00A0\u00A0\u00A0\u00A0'.repeat(level);
            processed.push({ id: node.id, label: `${prefix}${node.name}` });
            flatStructure.filter(i => i.parent_id === node.id).forEach(c => renderNode(c, level + 1));
        };
        roots.forEach(r => renderNode(r, 0));
        return processed;
    }, [flatStructure]);

    const canEdit = user?.role === 'Administrator' || user?.permissions?.admin_access || user?.permissions?.edit_market;
    const canView = user?.role === 'Administrator' || user?.permissions?.admin_access || user?.permissions?.view_market || user?.permissions?.edit_market || user?.permissions?.manage_planning;

    const [activeTab, setActiveTab] = useState<'analytics' | 'candidates'>('analytics');

    if (isMarketLoading || isEmployeesLoading) return (
        <div className="h-64 flex justify-center items-center">
            <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
        </div>
    );

    if (!canView) return <div className="p-10 text-center text-slate-500">У вас нет прав для просмотра этой страницы.</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            <PageHeader
                title="Анализ рынка"
                subtitle="Сравнение зарплатных предложений с рыночными показателями"
                extra={
                    <button
                        onClick={() => setIsHelpOpen(true)}
                        className="mt-2 flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors text-sm font-medium"
                    >
                        <HelpCircle className="w-5 h-5" />
                        Как это работает?
                    </button>
                }
            >
                <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'analytics'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Аналитика зарплат
                    </button>
                    <button
                        onClick={() => setActiveTab('candidates')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'candidates'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Users className="w-4 h-4" />
                        Поиск талантов (AI)
                    </button>
                </div>
            </PageHeader>

            {activeTab === 'analytics' ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                <Globe className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-sm text-slate-500 font-medium uppercase">Всего позиций</div>
                                <div className="text-2xl font-bold text-slate-900">{marketData.length}</div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                                <BarChart2 className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-sm text-slate-500 font-medium uppercase">Сотрудников в оценке</div>
                                <div className="text-2xl font-bold text-slate-900">
                                    {comparisonData.reduce((acc: number, curr: any) => acc + curr.employeesCount, 0)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-4 flex-1 w-full">
                                <div className="relative max-w-sm w-full">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        className="w-full h-10 rounded-lg border border-slate-200 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                                        placeholder="Поиск по должности..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                    />
                                </div>
                                <select
                                    className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 bg-white"
                                    value={filterBranch}
                                    onChange={e => setFilterBranch(e.target.value)}
                                >
                                    <option value="all">Все подразделения</option>
                                    {branches.map(b => (
                                        <option key={b as string} value={b as string}>{b as string}</option>
                                    ))}
                                </select>
                            </div>

                            {canEdit && (
                                <div className="flex items-center gap-2">
                                    <label className={`flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors cursor-pointer ${isImporting ? 'opacity-50 cursor-wait' : ''}`}>
                                        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                                        Импорт CSV
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            onChange={handleFileUpload}
                                            disabled={isImporting}
                                        />
                                    </label>
                                    <button
                                        onClick={() => setIsAddOpen(true)}
                                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-lg shadow-slate-900/10 whitespace-nowrap"
                                    >
                                        <Plus className="w-4 h-4" /> Добавить
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4">Должность / Источники</th>
                                        <th className="px-6 py-4">Рыночный диапазон (Net)</th>
                                        <th className="px-6 py-4 text-right">Медиана рынка</th>
                                        <th className="px-6 py-4 text-center">Штат</th>
                                        <th className="px-6 py-4">Отклонение</th>
                                        <th className="px-6 py-4 text-right">Обновлено</th>
                                        {canEdit && <th className="px-6 py-4"></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {comparisonData.length === 0 && (
                                        <tr>
                                            <td colSpan={canEdit ? 7 : 6} className="px-6 py-12 text-center text-slate-400 italic">
                                                Данные не найдены. Добавьте первую запись или импортируйте CSV.
                                            </td>
                                        </tr>
                                    )}
                                    {comparisonData.map(row => (
                                        <tr
                                            key={row.position}
                                            onClick={() => setSelectedPosition(row)}
                                            className={`group hover:bg-slate-50/80 cursor-pointer transition-colors ${selectedPosition?.position === row.position ? 'bg-blue-50/30' : ''}`}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{row.position}</div>
                                                    {row.belowP25 > 0 && (
                                                        <span className="bg-red-100 text-red-600 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap" title={`${row.belowP25} сотрудников получают меньше 25-го процентиля рынка`}>
                                                            Риск ухода
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={row.source}>
                                                    {row.source}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {row.median_salary > 0 ? (
                                                    <SalaryRangeChart
                                                        min={row.min_salary}
                                                        max={row.max_salary}
                                                        median={row.median_salary}
                                                        employeeSalaries={row.employeeSalaries}
                                                    />
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">Нет данных (0 компаний)</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right text-emerald-700 font-mono font-bold bg-emerald-50/10 text-sm whitespace-nowrap">
                                                {formatMoney(row.median_salary)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {row.employeesCount > 0 ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-700 transition-colors">
                                                        <Users className="w-3 h-3" />
                                                        {row.employeesCount}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {row.employeesCount > 0 && row.median_salary > 0 ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${Math.abs(row.deviation) < 5 ? 'bg-emerald-500' : row.deviation < 0 ? 'bg-red-500' : 'bg-blue-500'}`} />
                                                        <span className={`text-xs font-bold ${Math.abs(row.deviation) < 5 ? 'text-emerald-600' : row.deviation < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                            {row.deviation > 0 ? '+' : ''}{row.deviation.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                ) : <span className="text-slate-300 text-xs">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-400 text-xs whitespace-nowrap">{row.updated_at}</td>
                                            {canEdit && (
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(row.id);
                                                        }}
                                                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <CandidateSearch />
            )}

            <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Добавить позицию для анализа">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Должность</label>
                        <input
                            className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10"
                            value={form.position_title}
                            onChange={e => setForm({ ...form, position_title: e.target.value })}
                            required
                            list="positions-list"
                            placeholder="Выберите или введите название"
                        />
                        <datalist id="positions-list">
                            {positions.map((p: any) => (
                                <option key={p.id} value={p.title} />
                            ))}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Подразделение (Опционально)</label>
                        <select
                            className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10 bg-white"
                            value={form.branch_id || ''}
                            onChange={e => setForm({ ...form, branch_id: e.target.value ? Number(e.target.value) : null })}
                        >
                            <option value="">Все подразделения (Глобально)</option>
                            {hierarchicalOptions.map((opt: any) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-400 mt-1">Оставьте пустым для анализа по всей компании.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Примечание (Источник)</label>
                        <input
                            className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10"
                            value={form.source}
                            onChange={e => setForm({ ...form, source: e.target.value })}
                            placeholder="Например: HeadHunter, Статистика 2024"
                        />
                    </div>
                    <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-[0.98]">
                        Добавить должность
                    </button>
                </form>
            </Modal>

            {/* Analysis Detail Sidebar (Modal) */}
            <Modal
                isOpen={!!selectedPosition}
                onClose={() => setSelectedPosition(null)}
                title={`Анализ: ${selectedPosition?.position}`}
                maxWidth="max-w-4xl"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <div className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest">Рыночные показатели</div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-end border-b border-slate-200 pb-2">
                                    <span className="text-sm text-slate-500 font-medium">Медиана рынка</span>
                                    <span className="text-2xl font-bold font-mono text-emerald-700">{formatMoney(selectedPosition?.median_salary || 0)}</span>
                                </div>
                                <div className="flex justify-between items-end border-b border-slate-200 pb-2">
                                    <span className="text-sm text-slate-500 font-medium">Нижний порог (Min)</span>
                                    <span className="text-lg font-bold font-mono text-slate-600">{formatMoney(selectedPosition?.min_salary || 0)}</span>
                                </div>
                                <div className="flex justify-between items-end border-b border-slate-200 pb-2">
                                    <span className="text-sm text-slate-500 font-medium">Верхний порог (Max)</span>
                                    <span className="text-lg font-bold font-mono text-slate-600">{formatMoney(selectedPosition?.max_salary || 0)}</span>
                                </div>
                            </div>
                        </div>

                        <div className={`p-6 rounded-2xl border ${selectedPosition?.deviation < 0 ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-widest">Ваша компания</div>
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <div className="text-xs text-slate-400 font-medium">Ср. оклад (Внутри)</div>
                                    <div className="text-xl font-bold text-slate-900">{formatMoney(selectedPosition?.avg_internal || 0)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-400 font-medium">Отклонение</div>
                                    <div className={`text-xl font-bold ${selectedPosition?.deviation < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                        {selectedPosition?.deviation > 0 ? '+' : ''}{selectedPosition?.deviation.toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed italic">
                                {selectedPosition?.deviation < 0
                                    ? 'Ваши зарплаты ниже рыночной медианы. Возможен риск оттока сотрудников.'
                                    : 'Ваши зарплаты превышают рыночную медиану. Вы обладаете преимуществом в найме.'}
                            </p>
                        </div>
                    </div>

                    <MarketPositionDetails
                        position={selectedPosition?.position || ''}
                        entries={selectedPosition?.points || []}
                        marketId={selectedPosition?.id}
                        canEdit={canEdit}
                    />
                </div>
            </Modal>

            {/* Help Modal */}
            <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Как работает анализ рынка?">
                <div className="space-y-6 text-sm text-slate-600">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="leading-relaxed">
                            <span className="font-bold text-slate-900 text-base block mb-1">Salary Benchmarking</span>
                            Инструмент для сравнения ваших внутренних окладов с реальными предложениями конкурентов. Мы используем метод "Apple-to-Apple", сопоставляя должности вашей компании с замерами рынка.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Основные возможности</h4>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg h-fit"><Search size={16} /></div>
                                <div>
                                    <span className="font-bold text-slate-900 block">AI Поиск талантов</span>
                                    Интегрированные нейросети помогают искать кандидатов по заданным критериям оклада и навыкам прямо во внешней базе.
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg h-fit"><TrendingUp size={16} /></div>
                                <div>
                                    <span className="font-bold text-slate-900 block">Расчет отклонений</span>
                                    Система автоматически вычисляет разницу между вашей средней ЗП и медианой рынка. Синий цвет — выше рынка, Красный — зона риска.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-800 text-xs">
                        <div className="font-bold mb-1">Работа с данными:</div>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Вы можете импортировать CSV-файлы с обзорами зарплат.</li>
                            <li>Добавляйте ручные замеры по конкретным компаниям-конкурентам.</li>
                            <li>Фильтруйте данные по филиалам для более точного локального анализа.</li>
                        </ul>
                    </div>

                    <div className="bg-slate-900 p-4 rounded-xl text-white text-xs shadow-lg">
                        <div className="font-bold mb-1 flex items-center gap-2">
                            <Calculator size={14} className="text-blue-400" />
                            Методология
                        </div>
                        <div>
                            Мы рекомендуем добавлять минимум 3-5 замеров на каждую должность для получения достоверной медианы.
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
