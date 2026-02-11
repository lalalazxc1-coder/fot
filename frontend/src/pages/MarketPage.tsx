import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, Search, TrendingUp, BarChart2, Globe, Users, Loader2, UploadCloud } from 'lucide-react';
import { useMarket, useCreateMarketEntry, useDeleteMarketEntry, useBulkCreateMarketEntry } from '../hooks/useMarket';
import { useEmployees } from '../hooks/useEmployees';
import { formatMoney } from '../utils';
import Modal from '../components/Modal';
import SalaryRangeChart from '../components/SalaryRangeChart';
import Papa from 'papaparse';
import Fuse from 'fuse.js';
import { toast } from 'sonner';

export default function MarketPage() {
    const { user } = useOutletContext<{ user: any }>();

    // Hooks
    const { data: marketData = [], isLoading: isMarketLoading } = useMarket();
    const { data: employees = [], isLoading: isEmployeesLoading } = useEmployees();

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'position' | 'median' | 'updated'>('position');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [filterSource, setFilterSource] = useState<string>('all');
    const [isImporting, setIsImporting] = useState(false);

    // Comparison Modal
    const [selectedPosition, setSelectedPosition] = useState<any | null>(null);

    // Derived state
    const comparisonData = useMemo(() => {
        if (!marketData.length) return [];

        // Fuzzy matching logic
        const fuse = new Fuse(employees, {
            keys: ['position'],
            threshold: 0.3, // Strictness of match (0.0 = perfect match, 1.0 = match anything)
            ignoreLocation: true
        });

        let processed = marketData.map(marketItem => {
            // Fuzzy search for employees matching the market position title
            // If employees list is empty, matchedEmployees is empty
            let matchedEmployees: any[] = [];

            if (employees.length > 0) {
                const results = fuse.search(marketItem.position_title);
                matchedEmployees = results.map(r => r.item);

                // Fallback to exact match if fuzzy returns nothing but maybe user expects it?
                // Actually Fuse handles exact matches well.
                // But let's also include exact matches if for some reason threshold missed them (unlikely).
                if (matchedEmployees.length === 0) {
                    matchedEmployees = employees.filter(e =>
                        e.position.toLowerCase().trim() === marketItem.position_title.toLowerCase().trim()
                    );
                }
            }

            const avgSalary = matchedEmployees.length
                ? matchedEmployees.reduce((sum, e) => sum + (e.total.net || 0), 0) / matchedEmployees.length
                : 0;

            const deviation = avgSalary ? ((avgSalary - marketItem.median_salary) / marketItem.median_salary) * 100 : 0;

            return {
                ...marketItem,
                employeesCount: matchedEmployees.length,
                matchedEmployees,
                avgSalaryObserved: avgSalary,
                deviation,
                employeeSalaries: matchedEmployees.map(e => e.total.net)
            };
        });

        // Filter
        if (search) {
            const searchFuse = new Fuse(processed, { keys: ['position_title', 'source'], threshold: 0.3 });
            processed = searchFuse.search(search).map(r => r.item);
        }
        if (filterSource !== 'all') {
            processed = processed.filter(i => i.source.toLowerCase().includes(filterSource.toLowerCase()));
        }

        // Sort
        processed.sort((a, b) => {
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
    }, [marketData, employees, search, sortBy, sortDir, filterSource]);

    const createMutation = useCreateMarketEntry();
    const bulkCreateMutation = useBulkCreateMarketEntry();
    const deleteMutation = useDeleteMarketEntry();

    const [form, setForm] = useState({
        position_title: '',
        min_salary: '',
        max_salary: '',
        median_salary: '',
        source: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        const min = Number(form.min_salary);
        const max = Number(form.max_salary);
        const median = Number(form.median_salary);

        if (min > median || median > max) {
            toast.error("Проверьте зарплаты: Мин <= Медиана <= Макс");
            return;
        }

        await createMutation.mutateAsync(form);
        setIsAddOpen(false);
        setForm({ position_title: '', min_salary: '', max_salary: '', median_salary: '', source: '' });
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить запись?')) return;
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
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data;
                const validRows: any[] = [];

                // Map and validate rows
                data.forEach((row: any) => {
                    // Try to locate columns, allow flexible naming if possible or assume strict CSV header
                    // Expected: position_title, min_salary, max_salary, median_salary, source
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
                    // Reset file input
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
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Анализ рынка</h1>
                <p className="text-slate-500 mt-2 text-lg">Сравнение зарплатных предложений с рыночными показателями</p>
            </div>

            {/* Stats / Intro */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 font-medium uppercase">Источники</div>
                        <div className="text-2xl font-bold text-slate-900">hh.kz, LinkedIn</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <BarChart2 className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 font-medium uppercase">Сотрудников в оценке</div>
                        <div className="text-2xl font-bold text-slate-900">
                            {comparisonData.reduce((acc, curr) => acc + curr.employeesCount, 0)}
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
                            value={filterSource}
                            onChange={e => setFilterSource(e.target.value)}
                        >
                            <option value="all">Все источники</option>
                            <option value="hh.kz">hh.kz</option>
                            <option value="LinkedIn">LinkedIn</option>
                            <option value="internal">Внутренний</option>
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
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                                <th
                                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                                    onClick={() => handleSort('position')}
                                >
                                    Должность {sortBy === 'position' && (sortDir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-6 py-4 text-center w-64">Диапазон зарплат</th>
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
                            {comparisonData.map(row => (
                                <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        {row.position_title}
                                        <div className="text-xs text-slate-400 font-normal mt-0.5">{row.source}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <SalaryRangeChart
                                            min={row.min_salary}
                                            max={row.max_salary}
                                            median={row.median_salary}
                                            employeeSalaries={row.employeeSalaries}
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-right text-emerald-700 font-mono font-bold bg-emerald-50/10 text-sm whitespace-nowrap">{formatMoney(row.median_salary)}</td>
                                    <td className="px-6 py-4 text-center">
                                        {row.employeesCount > 0 ? (
                                            <button
                                                onClick={() => setSelectedPosition(row)}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-full text-xs font-bold text-slate-700 transition-colors"
                                            >
                                                <Users className="w-3 h-3" />
                                                {row.employeesCount}
                                            </button>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {row.employeesCount > 0 ? (
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
                                                onClick={() => handleDelete(row.id)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {comparisonData.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-slate-400">Данные не найдены</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal */}
            <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Новая запись рынка">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Должность</label>
                        <input
                            className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10"
                            value={form.position_title}
                            onChange={e => setForm({ ...form, position_title: e.target.value })}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Мин.</label>
                            <input type="number"
                                className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10"
                                value={form.min_salary}
                                onChange={e => setForm({ ...form, min_salary: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-emerald-600 mb-1">Медиана</label>
                            <input type="number"
                                className="w-full h-10 rounded-lg border border-emerald-300 px-3 outline-none focus:ring-2 focus:ring-emerald-500/20 bg-emerald-50/10"
                                value={form.median_salary}
                                onChange={e => setForm({ ...form, median_salary: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Макс.</label>
                            <input type="number"
                                className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10"
                                value={form.max_salary}
                                onChange={e => setForm({ ...form, max_salary: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Источник</label>
                        <input
                            className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10"
                            value={form.source}
                            onChange={e => setForm({ ...form, source: e.target.value })}
                            placeholder="Например: hh.kz"
                        />
                    </div>
                    <button disabled={createMutation.isPending} type="submit" className="w-full bg-slate-900 text-white h-11 rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 mt-2 disabled:opacity-50">
                        {createMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </form>
            </Modal>

            {/* Comparison Details Modal */}
            <Modal isOpen={!!selectedPosition} onClose={() => setSelectedPosition(null)} title={`Сотрудники vs Рынок (${selectedPosition?.position_title})`}>
                <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-slate-400 text-xs uppercase mb-1">Мин (Рынок)</div>
                            <div className="font-mono text-slate-600">{formatMoney(selectedPosition?.min_salary)}</div>
                        </div>
                        <div>
                            <div className="text-emerald-600 text-xs uppercase mb-1 font-bold">Медиана</div>
                            <div className="font-mono text-emerald-700 font-bold">{formatMoney(selectedPosition?.median_salary)}</div>
                        </div>
                        <div>
                            <div className="text-slate-400 text-xs uppercase mb-1">Макс (Рынок)</div>
                            <div className="font-mono text-slate-600">{formatMoney(selectedPosition?.max_salary)}</div>
                        </div>
                    </div>

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
                                {selectedPosition?.matchedEmployees?.sort((a: any, b: any) => b.total.net - a.total.net).map((emp: any) => {
                                    const dev = ((emp.total.net - selectedPosition.median_salary) / selectedPosition.median_salary) * 100;
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
            </Modal>
        </div>
    );
}
