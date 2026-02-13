import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/shared';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, Search, TrendingUp, BarChart2, Globe, Users, Loader2, UploadCloud, Building2, Calculator, X, HelpCircle } from 'lucide-react';
import {
    useMarket,
    useCreateMarketEntry,
    useDeleteMarketEntry,
    useBulkCreateMarketEntry,
    useMarketEntries,
    useCreateMarketEntryPoint,
    useDeleteMarketEntryPoint
} from '../hooks/useMarket';
import { useEmployees } from '../hooks/useEmployees';
import { usePositions } from '../hooks/usePositions';
import { useStructure } from '../hooks/useStructure';
import { formatMoney } from '../utils';
import Modal from '../components/Modal';
import SalaryRangeChart from '../components/SalaryRangeChart';
import Papa from 'papaparse';
import Fuse from 'fuse.js';
import { toast } from 'sonner';

// Helper component for managing market entries
function MarketEntriesManager({ marketId, canEdit }: { marketId: number, canEdit: boolean }) {
    const { data: entries = [], isLoading } = useMarketEntries(marketId);
    const createEntry = useCreateMarketEntryPoint();
    const deleteEntry = useDeleteMarketEntryPoint();

    const [company, setCompany] = useState('');
    const [salary, setSalary] = useState('');

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!company || !salary) return;

        await createEntry.mutateAsync({
            market_id: marketId,
            company_name: company,
            salary: Number(salary)
        });

        setCompany('');
        setSalary('');
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить эту запись?')) return;
        await deleteEntry.mutateAsync({ id, marketId }); // Pass marketId for invalidation
    };

    if (isLoading) return <div className="p-4 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></div>;

    return (
        <div className="mt-6 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Источники данных (Компании)
            </h3>

            {canEdit && (
                <form onSubmit={handleAdd} className="flex gap-2 mb-4">
                    <input
                        className="flex-1 h-9 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
                        placeholder="Название компании"
                        value={company}
                        onChange={e => setCompany(e.target.value)}
                        required
                    />
                    <input
                        type="number"
                        className="w-32 h-9 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
                        placeholder="Зарплата"
                        value={salary}
                        onChange={e => setSalary(e.target.value)}
                        required
                    />
                    <button
                        type="submit"
                        disabled={createEntry.isPending}
                        className="bg-slate-900 text-white px-3 h-9 rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                    >
                        {createEntry.isPending ? '...' : <Plus className="w-4 h-4" />}
                    </button>
                </form>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {entries.length === 0 ? (
                    <div className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        Нет данных. Добавьте компании для расчета медианы.
                    </div>
                ) : (
                    entries.map((entry: any) => (
                        <div key={entry.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100 text-sm group">
                            <span className="font-medium text-slate-700">{entry.company_name}</span>
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

            {entries.length > 0 && (
                <div className="mt-3 text-xs text-slate-400 text-right">
                    Медиана рассчитывается автоматически на основе {entries.length} записей.
                </div>
            )}
        </div>
    );
}

export default function MarketPage() {
    const { user } = useOutletContext<{ user: any }>();

    // Hooks
    const { data: marketData = [], isLoading: isMarketLoading } = useMarket();
    const { data: employees = [], isLoading: isEmployeesLoading } = useEmployees();
    const { data: positions = [] } = usePositions();
    const { data: structure = [] } = useStructure();

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'position' | 'median' | 'updated'>('position');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const [filterBranch, setFilterBranch] = useState<string>('all');
    const [isImporting, setIsImporting] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);

    // Comparison Modal
    const [selectedPosition, setSelectedPosition] = useState<any | null>(null);

    // Derived branches
    const branches = useMemo(() => {
        // e.branch comes from useEmployees service
        const unique = new Set(employees.map((e: any) => e.branch).filter((b: any) => b && b !== 'Неизвестно'));
        return Array.from(unique).sort();
    }, [employees]);

    // Derived state
    const comparisonData = useMemo(() => {
        if (!marketData.length) return [];

        // Fuzzy matching logic
        let processed = marketData.map((marketItem: any) => {
            // Strict match for employees matching the market position title
            let matchedEmployees: any[] = [];

            if (employees.length > 0) {
                // Determine effective branch name if market item is scoped
                let requiredBranchName: string | null = null;
                if (marketItem.branch_id) {
                    const foundBranch = structure.find((s: any) => s.id === marketItem.branch_id);
                    if (foundBranch) requiredBranchName = foundBranch.name;
                }

                matchedEmployees = employees.filter((e: any) => {
                    const titleMatch = e.position.toLowerCase().trim() === marketItem.position_title.toLowerCase().trim();
                    if (!titleMatch) return false;

                    // If market item has branch_id, only match employees from that branch
                    if (requiredBranchName) {
                        return e.branch === requiredBranchName;
                    }
                    return true;
                });
            }

            // Apply GLOBAL Page Filter (filterBranch) inside calculation to affect averages
            // Interaction Rule: 
            // 1. If market item is specific to "Almaty", and Page Filter is "Astana", result is 0 employees (Mismatch).
            // 2. If market item is Global, and Page Filter is "Almaty", result is Almaty employees.
            if (filterBranch !== 'all') {
                matchedEmployees = matchedEmployees.filter((e: any) => e.branch === filterBranch);
            }

            const avgSalary = matchedEmployees.length
                ? matchedEmployees.reduce((sum: number, e: any) => sum + (e.total.net || 0), 0) / matchedEmployees.length
                : 0;

            const deviation = (avgSalary && marketItem.median_salary)
                ? ((avgSalary - marketItem.median_salary) / marketItem.median_salary) * 100
                : 0;

            return {
                ...marketItem,
                employeesCount: matchedEmployees.length,
                matchedEmployees,
                avgSalaryObserved: avgSalary,
                deviation,
                employeeSalaries: matchedEmployees.map((e: any) => e.total.net),
                // Helper for UI
                branchName: marketItem.branch_id ? structure.find((s: any) => s.id === marketItem.branch_id)?.name : null
            };
        });

        // Filter
        if (search) {
            const searchFuse = new Fuse(processed, { keys: ['position_title', 'source'], threshold: 0.3 });
            processed = searchFuse.search(search).map(r => r.item);
        }


        // Sort
        processed.sort((a: any, b: any) => {
            let valA, valB;
            if (sortBy === 'position') {
                valA = a.position_title.toLowerCase();
                valB = b.position_title.toLowerCase();
            } else if (sortBy === 'median') {
                valA = a.median_salary;
                valB = b.median_salary;
            } else {
                valA = new Date(a.updated_at).getTime();
                valB = new Date(b.updated_at).getTime();
            }

            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return processed;
    }, [marketData, employees, search, sortBy, sortDir, filterBranch, structure]);

    const createMutation = useCreateMarketEntry();
    const bulkCreateMutation = useBulkCreateMarketEntry();
    const deleteMutation = useDeleteMarketEntry();

    const [form, setForm] = useState<{
        position_title: string;
        branch_id: number | null;
        source: string;
    }>({
        position_title: '',
        branch_id: null,
        source: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Create container, salary will be 0 initially
        await createMutation.mutateAsync({
            ...form,
            min_salary: 0,
            max_salary: 0,
            median_salary: 0
        } as any);

        setIsAddOpen(false);
        setForm({ position_title: '', branch_id: null, source: '' });
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить позицию и все данные?')) return;
        await deleteMutation.mutateAsync(id);
    };

    const handleSort = (key: 'position' | 'median' | 'updated') => {
        if (sortBy === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(key);
            setSortDir('asc');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Keeping bulk upload logic but implicitly it might strictly set salaries
        // Ideally bulk upload should create entries too, but leaving as is for legacy/compat
        // Or we warn user that bulk upload sets fixed values.
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data;
                const validRows: any[] = [];

                data.forEach((row: any) => {
                    const title = row.position_title || row['Должность'] || row['Position'];
                    const min = Number(row.min_salary || row['min'] || 0);
                    const max = Number(row.max_salary || row['max'] || 0);
                    const median = Number(row.median_salary || row['median'] || 0);
                    const src = row.source || row['Source'] || 'Import';

                    if (title && median > 0) {
                        validRows.push({
                            position_title: title,
                            min_salary: min,
                            max_salary: max,
                            median_salary: median,
                            source: src
                        });
                    }
                });

                if (validRows.length === 0) {
                    toast.error("Не найдено корректных данных в CSV");
                    setIsImporting(false);
                    return;
                }

                try {
                    await bulkCreateMutation.mutateAsync(validRows);
                } catch (err) {
                    console.error(err);
                } finally {
                    setIsImporting(false);
                    e.target.value = '';
                }
            },
            error: (error) => {
                toast.error("Ошибка чтения CSV: " + error.message);
                setIsImporting(false);
            }
        });
    };

    const canEdit = user?.role === 'Administrator' || user?.permissions?.admin_access || user?.permissions?.edit_market;
    const canView = user?.role === 'Administrator' || user?.permissions?.admin_access || user?.permissions?.view_market || user?.permissions?.edit_market || user?.permissions?.manage_planning;

    if (isMarketLoading || isEmployeesLoading) return (
        <div className="h-64 flex justify-center items-center">
            <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
        </div>
    );

    if (!canView) return <div className="p-10 text-center text-slate-500">У вас нет прав для просмотра этой страницы.</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            <PageHeader
                title="Анализ рынка"
                subtitle="Сравнение зарплатных предложений с рыночными показателями"
                extra={
                    <button
                        onClick={() => setIsInfoOpen(true)}
                        className="mt-2 flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors text-sm font-medium"
                    >
                        <HelpCircle className="w-5 h-5" />
                        Как это работает?
                    </button>
                }
            />

            {/* Stats / Intro */}
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
                {/* Sources Card Removed */}
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

            {/* Main Content */}
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
                            <option value="all">Все филиалы</option>
                            {branches.map(b => (
                                <option key={b as string} value={b as string}>{b as string}</option>
                            ))}
                        </select>


                    </div>

                    {canEdit && (
                        <div className="flex items-center gap-2">
                            {/* Legacy Import Button - can hide if we want to force new flow */}
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
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                                <th
                                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                                    onClick={() => handleSort('position')}
                                >
                                    Должность {sortBy === 'position' && (sortDir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-6 py-4 text-center w-64">Диапазон зарплат (Калькулятор)</th>
                                <th
                                    className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                                    onClick={() => handleSort('median')}
                                >
                                    Медиана {sortBy === 'median' && (sortDir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-6 py-4 text-center">Штат</th>
                                <th className="px-6 py-4 text-left">Отклонение</th>
                                <th
                                    className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                                    onClick={() => handleSort('updated')}
                                >
                                    Дата {sortBy === 'updated' && (sortDir === 'asc' ? '↑' : '↓')}
                                </th>
                                {canEdit && <th className="px-6 py-4 w-10"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {comparisonData.map((row: any) => (
                                <tr
                                    key={row.id}
                                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                                    onClick={() => setSelectedPosition(row)}
                                >
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        <div className="flex items-center gap-2">
                                            {row.position_title}
                                            {row.branchName && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                    {row.branchName}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400 font-normal mt-0.5 flex items-center gap-1">
                                            <Calculator className="w-3 h-3" />
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
                                            <span
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-700 transition-colors"
                                            >
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

            {/* Add Modal */}
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">Филиал (Опционально)</label>
                        <select
                            className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10 bg-white"
                            value={form.branch_id || ''}
                            onChange={e => setForm({ ...form, branch_id: e.target.value ? Number(e.target.value) : null })}
                        >
                            <option value="">Все филиалы (Глобально)</option>
                            {structure.map((b: any) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
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
                            placeholder="Например: Внутренний опрос"
                        />
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg text-blue-800 text-xs">
                        Поле создаст новую карточку анализа. Данные по компаниям и зарплатам вы сможете добавить после создания.
                    </div>

                    <button disabled={createMutation.isPending} type="submit" className="w-full bg-slate-900 text-white h-11 rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 mt-2 disabled:opacity-50">
                        {createMutation.isPending ? 'Создание...' : 'Создать'}
                    </button>
                </form>
            </Modal>

            {/* Comparison Details Modal aka Drilldown */}
            <Modal isOpen={!!selectedPosition} onClose={() => setSelectedPosition(null)} title={`Анализ: ${selectedPosition?.position_title}`}>
                <div className="space-y-6">
                    {/* Top Cards */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="text-slate-400 text-xs uppercase mb-1">Мин (Рынок)</div>
                            <div className="font-mono text-slate-600 font-bold">{formatMoney(selectedPosition?.min_salary)}</div>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                            <div className="text-emerald-600 text-xs uppercase mb-1 font-bold">Медиана</div>
                            <div className="font-mono text-emerald-700 font-bold text-lg">{formatMoney(selectedPosition?.median_salary)}</div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="text-slate-400 text-xs uppercase mb-1">Макс (Рынок)</div>
                            <div className="font-mono text-slate-600 font-bold">{formatMoney(selectedPosition?.max_salary)}</div>
                        </div>
                    </div>

                    {/* Tabs / Split View */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Наши сотрудники
                        </h3>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar border rounded-xl border-slate-200">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2">Сотрудник</th>
                                        <th className="px-4 py-2 text-right">ЗП (Net)</th>
                                        <th className="px-4 py-2 text-right">Отклонение</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedPosition?.matchedEmployees?.length === 0 && (
                                        <tr><td colSpan={3} className="p-4 text-center text-slate-400 text-xs">Нет сотрудников на этой должности</td></tr>
                                    )}
                                    {selectedPosition?.matchedEmployees?.sort((a: any, b: any) => b.total.net - a.total.net).map((emp: any) => {
                                        const dev = selectedPosition.median_salary ? ((emp.total.net - selectedPosition.median_salary) / selectedPosition.median_salary) * 100 : 0;
                                        return (
                                            <tr key={emp.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-800">{emp.full_name}</td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-600">{formatMoney(emp.total.net)}</td>
                                                <td className={`px-4 py-3 text-right font-bold text-xs ${dev < -10 ? 'text-red-500' : dev > 10 ? 'text-blue-500' : 'text-emerald-500'}`}>
                                                    {dev > 0 ? '+' : ''}{dev.toFixed(0)}%
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Market Sources Manager */}
                    {selectedPosition && (
                        <MarketEntriesManager
                            marketId={selectedPosition.id}
                            canEdit={canEdit}
                        />
                    )}
                </div>
            </Modal>

            {/* Help / Info Modal */}
            <Modal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} title="Как работает анализ рынка?">
                <div className="space-y-6 text-sm text-slate-600">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="mb-2">
                            <span className="font-bold text-slate-900">Система анализа рынка</span> позволяет сравнивать зарплаты ваших сотрудников с рыночными показателями.
                        </p>
                        <p>
                            Мы собираем данные из открытых источников (hh.kz, LinkedIn) и внутренних опросов, чтобы рассчитать медианную зарплату для каждой позиции.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-900 flex items-center gap-2">
                            <Calculator className="w-4 h-4" />
                            Основные показатели
                        </h4>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>
                                <span className="font-medium text-slate-900">Медиана:</span> Это середина рынка. 50% компаний платят меньше этого уровня, 50% — больше. Это более точный показатель, чем среднее арифметическое.
                            </li>
                            <li>
                                <span className="font-medium text-slate-900">Отклонение:</span> Процентная разница между средней зарплатой наших сотрудников на этой должности и рыночной медианой.
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-900 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Цветовая индикация
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                <span><span className="font-bold text-emerald-600">В норме (±5%):</span> Зарплаты соответствуют рынку.</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <span><span className="font-bold text-red-600">Ниже рынка (-):</span> Мы платим меньше, чем конкуренты. Риск оттока кадров.</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span><span className="font-bold text-blue-600">Выше рынка (+):</span> Мы платим больше рынка. Возможно, стоит пересмотреть эффективность.</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl text-blue-800 text-xs flex gap-3">
                        <Users className="w-5 h-5 flex-shrink-0" />
                        <div>
                            Для более точного анализа вы можете добавлять данные конкретных компаний-конкурентов, нажав на позицию в списке.
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
