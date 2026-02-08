import React, { useState, useEffect, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    ColumnDef,
} from '@tanstack/react-table';
import { Plus, Edit2, Trash2, Search, History, Loader2, Settings, HelpCircle } from 'lucide-react';
import { Card, Button, Input } from './ui-mocks';
import Modal from './Modal';
import { api } from '../lib/api';
import { formatMoney } from '../utils';
import { MoneyInput } from './shared';
import { calculateTaxes, solveGrossFromNet, DEFAULT_CONFIG, SalaryConfig } from '../utils/salary';
import SalarySettingsModal from './SalarySettingsModal';

type PlanRow = {
    id: number;
    position: string;
    branch_id?: string | number;
    department_id?: string | number;
    schedule?: string;
    count: number;
    base_net: number;
    base_gross: number;
    kpi_net: number;
    kpi_gross: number;
    bonus_net: number;
    bonus_gross: number;
};

type BranchStructure = {
    id: number;
    name: string;
    departments: { id: number; name: string }[];
};

type AuditLog = {
    date: string;
    user: string;
    field: string;
    oldVal: string;
    newVal: string;
};

export default function PlanningTable({ user }: { user: any }) {
    const [data, setData] = useState<PlanRow[]>([]);
    const [structure, setStructure] = useState<BranchStructure[]>([]);
    const [editingRow, setEditingRow] = useState<PlanRow | null>(null);
    const [historyLogs, setHistoryLogs] = useState<AuditLog[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Calc State
    const [salaryConfig, setSalaryConfig] = useState<SalaryConfig>(DEFAULT_CONFIG);
    const [useAutoCalc, setUseAutoCalc] = useState(true);
    const [applyDeduction, setApplyDeduction] = useState(true);

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');

    // Infinite Scroll State
    const [visibleRows, setVisibleRows] = useState(50);
    const observerTarget = React.useRef<HTMLDivElement>(null);

    // Reset infinite scroll when filters change
    useEffect(() => {
        setVisibleRows(50);
    }, [searchQuery, branchFilter, departmentFilter]);

    // Infinite Scroll Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleRows((prev) => prev + 50);
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [visibleRows]);

    const fetchData = async () => {
        try {
            const res = await api.get('/planning');
            setData(res.data);
        } catch (e) { console.error(e); }
    };

    // Initial Load
    useEffect(() => {
        const load = async () => {
            try {
                const s = await api.get('/structure');
                setStructure(s.data);
            } catch (e) { console.error(e); }
            fetchData();
        };
        load();
    }, []);

    // Load Salary Config
    useEffect(() => {
        api.get('/salary-config').then(res => setSalaryConfig(res.data)).catch(console.error);
    }, []);


    const filteredData = useMemo(() => {
        const allowedBranchIds = new Set(structure.map(b => b.id.toString()));
        const allowedDeptIds = new Set(structure.flatMap(b => b.departments.map(d => d.id.toString())));

        return data.filter(row => {
            const inScopeBranch = row.branch_id && allowedBranchIds.has(row.branch_id.toString());
            if (!inScopeBranch) return false;

            if (row.department_id) {
                if (!allowedDeptIds.has(row.department_id.toString())) return false;
            }

            const matchesSearch = row.position.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesBranch = !branchFilter || row.branch_id?.toString() === branchFilter;
            const matchesDept = !departmentFilter || row.department_id?.toString() === departmentFilter;
            return matchesSearch && matchesBranch && matchesDept;
        });
    }, [data, searchQuery, branchFilter, departmentFilter, structure]);

    const handleMoneyChange = (field: string, val: number, otherField: string) => {
        if (!editingRow) return;

        const updates: any = { [field]: val };

        if (useAutoCalc) {
            // Determine direction
            const isNet = field.includes('_net');

            if (isNet) {
                // Net -> Gross
                const gross = solveGrossFromNet(val, salaryConfig, applyDeduction);
                updates[otherField] = gross;
            } else {
                // Gross -> Net
                const res = calculateTaxes(val, salaryConfig, applyDeduction);
                updates[otherField] = res.net;
            }
        }

        setEditingRow(prev => prev ? ({ ...prev, ...updates }) : null);
    };

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRow) return;

        // Validation
        if (!editingRow.position?.trim()) return alert("Укажите должность");
        if (!editingRow.count || editingRow.count < 1) return alert("Неверное количество");
        if (!editingRow.branch_id) return alert("Выберите филиал");

        // Check if branch has departments and department is selected
        const branch = structure.find(b => b.id.toString() == editingRow.branch_id?.toString());
        if (branch && branch.departments.length > 0 && !editingRow.department_id) {
            return alert("Выберите отдел");
        }

        if (!editingRow.schedule?.trim()) return alert("Укажите график");

        if ((!editingRow.base_net || editingRow.base_net <= 0) && (!editingRow.base_gross || editingRow.base_gross <= 0)) {
            return alert("Укажите оклад (Net или Gross)");
        }

        // Prepare payload: convert empty strings to null/int
        const payload = {
            ...editingRow,
            branch_id: Number(editingRow.branch_id),
            department_id: editingRow.department_id ? Number(editingRow.department_id) : null,
            // Ensure numbers
            count: Number(editingRow.count),
            base_net: Number(editingRow.base_net),
            base_gross: Number(editingRow.base_gross),
            kpi_net: Number(editingRow.kpi_net),
            kpi_gross: Number(editingRow.kpi_gross),
            bonus_net: Number(editingRow.bonus_net),
            bonus_gross: Number(editingRow.bonus_gross)
        };

        // Remove ID for creation
        const { id, ...createPayload } = payload;

        try {
            if (editingRow.id === 0) {
                await api.post('/planning', createPayload);
            } else {
                await api.patch(`/planning/${editingRow.id}`, createPayload);
            }
            fetchData();
            setEditingRow(null);
        } catch (e: any) {
            console.error(e);
            alert("Ошибка при сохранении: " + (e.response?.data?.detail || e.message));
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Удалить позицию?')) return;
        try {
            await api.delete(`/planning/${id}`);
            fetchData();
        } catch (e: any) { alert(e.message); }
    };

    const handleViewHistory = async (id: number) => {
        try {
            const logs = await api.get(`/planning/${id}/history`);
            setHistoryLogs(logs.data);
            setIsHistoryOpen(true);
        } catch (e) { console.error(e); }
    };

    // Calculate Totals based on Filtered Data
    const totalNet = filteredData.reduce((acc, r) => acc + ((r.base_net + r.kpi_net + r.bonus_net) * r.count), 0);
    const totalGross = filteredData.reduce((acc, r) => acc + ((r.base_gross + r.kpi_gross + r.bonus_gross) * r.count), 0);


    // --- Permissions Check ---
    const canManage = user.role === 'Administrator' || user.permissions.manage_planning || user.permissions.admin_access;

    const columns = useMemo<ColumnDef<PlanRow>[]>(() => [
        {
            header: '#',
            accessorFn: (_, index) => index + 1,
            cell: info => <span className="text-slate-400 font-mono text-xs">{info.getValue() as number}</span>,
            size: 50,
        },
        {
            header: 'Филиал / Подразделение',
            accessorKey: 'branch_id',
            cell: info => {
                const val = info.getValue();
                const branch = structure.find(b => b.id.toString() === val?.toString());
                const dept = branch?.departments.find(d => d.id.toString() === info.row.original.department_id?.toString());
                return (
                    <div>
                        <div className="text-xs font-bold text-slate-700">{branch?.name || <span className="text-slate-300">Не выбран</span>}</div>
                        {dept && <div className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-0.5">{dept.name}</div>}
                    </div>
                );
            }
        },
        {
            header: 'Должность',
            accessorKey: 'position',
            cell: info => <div className="font-bold text-slate-800 text-sm">{info.getValue() as string}</div>,
        },
        {
            header: 'График',
            accessorKey: 'schedule',
            cell: info => <div className="bg-slate-100 rounded text-xs px-2 py-1 text-center font-bold text-slate-600 w-fit mx-auto">{info.getValue() as string || '-'}</div>,
        },
        {
            header: 'Кол-во',
            accessorKey: 'count',
            cell: info => <div className="flex justify-center"><span className="bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-lg">{info.getValue() as number}</span></div>,
        },
        {
            header: 'Оклад (Net/Gross)',
            id: 'base',
            cell: ({ row }) => (
                <div className="flex flex-col text-xs min-w-[100px]">
                    <div className="flex justify-between gap-2 text-slate-500">
                        <span>Net:</span> <span className="font-medium text-emerald-700">{formatMoney(row.original.base_net)}</span>
                    </div>
                    <div className="flex justify-between gap-2 border-t mt-0.5 pt-0.5 border-slate-100">
                        <span className="text-slate-400">Grs:</span> <span className="text-slate-600">{formatMoney(row.original.base_gross)}</span>
                    </div>
                </div>
            ),
        },
        {
            header: 'KPI (Net/Gross)',
            id: 'kpi',
            cell: ({ row }) => (
                <div className="flex flex-col text-xs min-w-[100px]">
                    <div className="flex justify-between gap-2 text-slate-500">
                        <span>Net:</span> <span className="font-medium text-blue-700">{formatMoney(row.original.kpi_net)}</span>
                    </div>
                    <div className="flex justify-between gap-2 border-t mt-0.5 pt-0.5 border-slate-100">
                        <span className="text-slate-400">Grs:</span> <span className="text-slate-600">{formatMoney(row.original.kpi_gross)}</span>
                    </div>
                </div>
            ),
        },
        {
            header: 'Итого на ед.',
            id: 'total_per_unit',
            cell: ({ row }) => {
                const r = row.original;
                const net = r.base_net + r.kpi_net + r.bonus_net;
                const gross = r.base_gross + r.kpi_gross + r.bonus_gross;
                return (
                    <div className="flex flex-col text-xs min-w-[100px]">
                        <div className="flex justify-between gap-2 text-slate-500">
                            <span>Net:</span> <span className="font-bold text-emerald-700">{formatMoney(net)}</span>
                        </div>
                        <div className="flex justify-between gap-2 border-t mt-0.5 pt-0.5 border-slate-100">
                            <span className="text-slate-400">Grs:</span> <span className="text-slate-600">{formatMoney(gross)}</span>
                        </div>
                    </div>
                );
            }
        },
        {
            header: 'Общий итог',
            id: 'grand_total',
            size: 140,
            cell: ({ row }) => {
                const r = row.original;
                const net = (r.base_net + r.kpi_net + r.bonus_net) * r.count;
                const gross = (r.base_gross + r.kpi_gross + r.bonus_gross) * r.count;
                return (
                    <div className="bg-slate-900 text-white px-2 py-1.5 rounded-lg shadow-sm w-full min-w-[120px] text-left text-xs">
                        <div className="flex justify-between items-center mb-0.5"><span className="text-slate-400 opacity-70">Net:</span><span className="font-bold">{formatMoney(net)}</span></div>
                        <div className="flex justify-between items-center border-t border-slate-700/50 pt-0.5"><span className="text-slate-500">Grs:</span><span className="text-slate-400">{formatMoney(gross)}</span></div>
                    </div>
                );
            }
        },
        {
            id: 'actions',
            header: '',
            size: 110,
            cell: ({ row }) => {
                if (!canManage) return null;
                return (
                    <div className="flex justify-end items-center gap-1 h-full pr-2 min-w-[90px]">
                        <button onClick={() => handleViewHistory(row.original.id)} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors" title="История">
                            <History className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingRow(row.original)} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-lg transition-colors" title="Редактировать">
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(row.original.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Удалить">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )
            }
        }
    ], [structure, canManage]);



    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    // Helper to get selected branch for Filter
    const selectedFilterBranch = useMemo(() => {
        if (!branchFilter) return null;
        return structure.find(b => b.id.toString() === branchFilter);
    }, [branchFilter, structure]);

    // Helper to get selected branch for Modal
    const selectedModalBranch = useMemo(() => {
        if (!editingRow?.branch_id) return null;
        return structure.find(b => b.id.toString() === editingRow.branch_id?.toString());
    }, [editingRow?.branch_id, structure]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Фонд оплаты труда</h1>
                    <p className="text-slate-500 mt-1">Управление штатными позициями и бюджетом</p>
                </div>
                <div className="flex gap-4">
                    <Card className="px-6 py-4 shadow-xl shadow-slate-200/60 border border-white bg-white min-w-[180px] rounded-2xl">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">План (Net)</div>
                        <div className="text-3xl font-bold text-slate-900 leading-none tracking-tight">{formatMoney(totalNet)}</div>
                    </Card>
                    <Card className="px-6 py-4 shadow-xl shadow-slate-200/60 border border-white bg-white min-w-[180px] rounded-2xl">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">План (Gross)</div>
                        <div className="text-3xl font-bold text-slate-500 leading-none tracking-tight">{formatMoney(totalGross)}</div>
                    </Card>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-5 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Поиск по должности..." className="pl-9 bg-slate-50 border-transparent focus:bg-white transition-all rounded-xl" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <div className="relative w-full sm:w-64">
                    <select className="h-10 w-full rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900/10 focus:bg-white outline-none hover:bg-slate-100 transition-all font-medium text-slate-600" value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setDepartmentFilter(''); }}>
                        <option value="">Все филиалы</option>
                        {structure.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div className="relative w-full sm:w-64">
                    <select className="h-10 w-full rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900/10 focus:bg-white outline-none hover:bg-slate-100 transition-all font-medium text-slate-600 disabled:opacity-50" value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} disabled={!branchFilter}>
                        <option value="">Все подразделения</option>
                        {selectedFilterBranch?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                <div className="ml-auto flex gap-2">
                    {canManage && (
                        <>
                            <Button onClick={() => setIsSettingsOpen(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-transparent active:scale-[0.98] transition-all rounded-xl py-2.5 px-4 font-semibold" title="Настройки расчета зарплаты">
                                <Settings className="w-4 h-4" />
                            </Button>
                            <Button onClick={() => setEditingRow({
                                id: 0, position: '', count: 1, base_net: 0, base_gross: 0, kpi_net: 0, kpi_gross: 0, bonus_net: 0, bonus_gross: 0, department_id: '', branch_id: ''
                            })} className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 active:scale-[0.98] transition-all rounded-xl py-2.5 px-5 font-semibold">
                                <Plus className="w-4 h-4 mr-2" /> Добавить
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <SalarySettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th
                                            key={header.id}
                                            className="px-4 py-3 font-bold text-slate-500 select-none"
                                            onClick={header.column.getToggleSortingHandler()}
                                        >
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {table.getRowModel().rows.slice(0, visibleRows).map(row => (
                                <tr
                                    key={row.id}
                                    className="hover:bg-slate-50/80 transition-colors"
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="px-4 py-3 align-top">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Infinite Scroll Sentinel */}
                    {visibleRows < table.getRowModel().rows.length && (
                        <div
                            ref={observerTarget}
                            className="h-20 w-full flex justify-center items-center text-slate-400 text-sm cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => setVisibleRows(prev => prev + 50)}
                        >
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Загрузка...
                        </div>
                    )}
                </div>

                {filteredData.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                        {data.length === 0 ? "Список позиций пуст. Добавьте первую позицию." : "По вашему запросу ничего не найдено."}
                    </div>
                )}
            </div>

            <Modal isOpen={!!editingRow} onClose={() => setEditingRow(null)} title={editingRow?.id === 0 ? "Новая позиция" : "Редактирование позиции"}>
                {editingRow && (
                    <form onSubmit={handleEditSave} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-bold text-slate-700">Должность</label>
                                <Input required value={editingRow.position} onChange={e => setEditingRow({ ...editingRow, position: e.target.value })} /></div>
                            <div><label className="text-sm font-bold text-slate-700">Кол-во</label>
                                <Input required type="number" min="1" value={editingRow.count} onChange={e => setEditingRow({ ...editingRow, count: parseInt(e.target.value) || 0 })} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-bold text-slate-700">Филиал</label>
                                <select required className="input-base w-full h-10 rounded-lg border-slate-200" value={editingRow.branch_id || ''} onChange={e => setEditingRow({ ...editingRow, branch_id: e.target.value, department_id: '' })}>
                                    <option value="">Не выбран</option>
                                    {structure.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div><label className="text-sm font-bold text-slate-700">Отдел</label>
                                <select
                                    required={(selectedModalBranch?.departments?.length || 0) > 0}
                                    className="input-base w-full h-10 rounded-lg border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                    value={editingRow.department_id || ''}
                                    onChange={e => setEditingRow({ ...editingRow, department_id: e.target.value })}
                                    disabled={!selectedModalBranch}
                                >
                                    <option value="">Не выбран</option>
                                    {selectedModalBranch?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div><label className="text-sm font-bold text-slate-700">График</label>
                            <Input required value={editingRow.schedule || ''} onChange={e => setEditingRow({ ...editingRow, schedule: e.target.value })} placeholder="5/2" /></div>

                        <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
                            <div className="flex justify-between items-center px-1">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={useAutoCalc}
                                        onChange={e => setUseAutoCalc(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 transition-colors">Авто-расчет (Net ↔ Gross)</span>
                                </label>

                                {useAutoCalc && (
                                    <div className="group relative flex items-center gap-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={applyDeduction}
                                                onChange={e => setApplyDeduction(e.target.checked)}
                                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                                            />
                                            <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600 transition-colors flex items-center gap-1">
                                                Вычет (14 МРП)
                                                <HelpCircle className="w-3 h-3 text-slate-300" />
                                            </span>
                                        </label>
                                        <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-800 text-white text-[11px] rounded-lg shadow-xl hidden group-hover:block z-50 font-normal leading-normal animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                                            Это стандартный налоговый вычет (14 × МРП). <br />
                                            Уменьшает облагаемый доход при расчете ИПН. <br />
                                            <span className="opacity-50 mt-1 block">Применяется только по одному месту работы (обычно основному).</span>
                                            <div className="absolute -bottom-1 right-10 w-2 h-2 bg-slate-800 rotate-45 transform"></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase text-slate-400 text-center tracking-wider">
                                <div></div><div>Net</div><div>Gross</div>
                            </div>
                            {[
                                { label: 'Оклад', net: 'base_net', gross: 'base_gross' },
                                { label: 'KPI', net: 'kpi_net', gross: 'kpi_gross' },
                                { label: 'Доплаты', net: 'bonus_net', gross: 'bonus_gross' }
                            ].map((group, i) => (
                                <div key={i} className="grid grid-cols-3 gap-2 items-center">
                                    <div className="text-sm font-bold text-slate-700">{group.label}</div>
                                    <MoneyInput
                                        className="bg-white"
                                        value={(editingRow as any)[group.net]}
                                        onChange={val => handleMoneyChange(group.net, val, group.gross)}
                                    />
                                    <MoneyInput
                                        className="bg-white"
                                        value={(editingRow as any)[group.gross]}
                                        onChange={val => handleMoneyChange(group.gross, val, group.net)}
                                    />
                                </div>
                            ))}
                        </div>
                        <Button className="w-full bg-slate-900 text-white hover:bg-slate-800 py-3 rounded-xl font-bold shadow-lg">Сохранить</Button>
                    </form>
                )}
            </Modal>

            <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title="История изменений">
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar p-1">
                    {historyLogs.length === 0 ? <p className="text-slate-400 text-center py-4">История пуста</p> :
                        (() => {
                            // Group logs by Date + User
                            const grouped = [];
                            let last = null;
                            for (const log of historyLogs) {
                                if (last && last.date === log.date && last.user === log.user) {
                                    last.changes.push(log);
                                } else {
                                    last = { date: log.date, user: log.user, changes: [log] };
                                    grouped.push(last);
                                }
                            }

                            return grouped.map((group, i) => {
                                const fieldLabels: any = {
                                    base_net: "Оклад (Net)", base_gross: "Оклад (Gross)",
                                    kpi_net: "KPI (Net)", kpi_gross: "KPI (Gross)",
                                    bonus_net: "Доплаты (Net)", bonus_gross: "Доплаты (Gross)",
                                    "Бонусы (Net)": "Доплаты (Net)", "Бонусы (Gross)": "Доплаты (Gross)", // Legacy support
                                    position_title: "Должность", count: "Количество",
                                    branch_id: "Филиал (ID)", department_id: "Отдел (ID)",
                                    schedule: "График"
                                };

                                const fieldOrder = [
                                    "Событие",
                                    "Должность", "position_title",
                                    "Филиал (ID)", "branch_id",
                                    "Отдел (ID)", "department_id",
                                    "График", "schedule",
                                    "Количество", "count",
                                    "Оклад (Net)", "base_net",
                                    "Оклад (Gross)", "base_gross",
                                    "KPI (Net)", "kpi_net",
                                    "KPI (Gross)", "kpi_gross",
                                    "Доплаты (Net)", "bonus_net", "Бонусы (Net)",
                                    "Доплаты (Gross)", "bonus_gross", "Бонусы (Gross)"
                                ];

                                const sortedChanges = [...group.changes].sort((a, b) => {
                                    let idxA = fieldOrder.indexOf(a.field);
                                    let idxB = fieldOrder.indexOf(b.field);
                                    if (idxA === -1) idxA = 999;
                                    if (idxB === -1) idxB = 999;
                                    return idxA - idxB;
                                });

                                return (
                                    <div key={i} className="flex gap-4 text-sm relative">
                                        {/* Timeline line */}
                                        {i !== grouped.length - 1 && <div className="absolute left-[88px] top-6 bottom-[-24px] w-px bg-slate-100"></div>}

                                        <div className="w-20 text-slate-400 text-[10px] text-right pt-1.5 font-mono">{group.date.split(' ')[0]}<br />{group.date.split(' ')[1]}</div>

                                        <div className="flex-1 pb-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="font-bold text-slate-800 text-xs uppercase tracking-wider">{group.user}</div>
                                            </div>

                                            <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                                {sortedChanges.map((log: any, j: number) => {
                                                    const label = fieldLabels[log.field] || log.field;
                                                    return (
                                                        <div key={j} className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                                                            <span className="text-slate-600 font-medium text-xs">{label}</span>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                {log.oldVal && <span className="text-red-400 line-through decoration-red-200/50">{log.oldVal}</span>}
                                                                {log.oldVal && log.newVal && <span className="text-slate-300 text-[10px]">➜</span>}
                                                                {log.newVal && <span className="font-bold text-slate-700 bg-white shadow-sm border border-slate-100 px-1.5 py-0.5 rounded">{log.newVal}</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()
                    }
                </div>
            </Modal>
        </div>
    );
}
