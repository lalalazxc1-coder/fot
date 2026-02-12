import { useState, useMemo, useRef, useEffect } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table';
import { Plus, Loader2, Settings } from 'lucide-react';
import { Button } from './ui-mocks';
import SalarySettingsModal from './SalarySettingsModal';

import { usePlanningData, useCreatePlanItem, useUpdatePlanItem, useDeletePlanItem, PlanRow } from '../hooks/usePlanning';
import { useStructure } from '../hooks/useStructure';

import { PlanningStats } from './planning/PlanningStats';
import { PlanningFilters } from './planning/PlanningFilters';
import { PlanningHistory } from './planning/PlanningHistory';
import { PlanningForm } from './planning/PlanningForm';
import { createColumns } from './planning/PlanningTableColumns';

export default function PlanningTable({ user }: { user: any }) {
    // Hooks
    const { data: data = [], isLoading: isDataLoading } = usePlanningData();
    const { data: structure = [] } = useStructure();

    const createMutation = useCreatePlanItem();
    const updateMutation = useUpdatePlanItem();
    const deleteMutation = useDeletePlanItem();

    // Local State
    const [editingRow, setEditingRow] = useState<PlanRow | null>(null);
    const [historyId, setHistoryId] = useState<number | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');

    // Infinite Scroll State (unchanged logic for now)
    const [visibleRows, setVisibleRows] = useState(50);
    const observerTarget = useRef<HTMLDivElement>(null);

    useEffect(() => setVisibleRows(50), [searchQuery, branchFilter, departmentFilter]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) setVisibleRows(prev => prev + 50);
            },
            { threshold: 0.1 }
        );
        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => observer.disconnect();
    }, [visibleRows]);


    // Permissions
    const canManage = user.role === 'Administrator' || user.permissions?.manage_planning || user.permissions?.admin_access;
    const canEditFinancials = user.role === 'Administrator' || user.permissions?.admin_access || user.permissions?.edit_financials;

    // Filter Logic
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


    // Actions
    const handleSave = async (item: any) => {
        const payload = {
            ...item,
            branch_id: Number(item.branch_id),
            department_id: item.department_id ? Number(item.department_id) : null,
            count: Number(item.count),
            base_net: Number(item.base_net), base_gross: Number(item.base_gross),
            kpi_net: Number(item.kpi_net), kpi_gross: Number(item.kpi_gross),
            bonus_net: Number(item.bonus_net), bonus_gross: Number(item.bonus_gross)
        };
        const { id, ...createPayload } = payload;

        if (id === 0) {
            await createMutation.mutateAsync(createPayload);
        } else {
            await updateMutation.mutateAsync({ id, data: createPayload });
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Удалить позицию?')) {
            await deleteMutation.mutateAsync(id);
        }
    };

    // Columns
    const columns = useMemo(() => createColumns(
        structure,
        canManage,
        (id) => setHistoryId(id),
        (row) => setEditingRow(row),
        handleDelete
    ), [structure, canManage]);

    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (isDataLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6">
            {/* Header & Stats */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Фонд оплаты труда</h1>
                    <p className="text-slate-500 mt-1">Управление штатными позициями и бюджетом</p>
                </div>
                <PlanningStats data={filteredData} />
            </div>

            {/* Filters & Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-5 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100">
                <PlanningFilters
                    searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                    branchFilter={branchFilter} setBranchFilter={setBranchFilter}
                    departmentFilter={departmentFilter} setDepartmentFilter={setDepartmentFilter}
                    structure={structure}
                />

                <div className="ml-auto flex gap-2">
                    {canManage && (
                        <>
                            <Button onClick={() => setIsSettingsOpen(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-transparent active:scale-[0.98] transition-all rounded-xl py-2.5 px-4 font-semibold" title="Настройки расчета зарплаты">
                                <Settings className="w-4 h-4" />
                            </Button>
                            <Button onClick={() => setEditingRow({
                                id: 0, position: '', count: 1, base_net: 0, base_gross: 0, kpi_net: 0, kpi_gross: 0, bonus_net: 0, bonus_gross: 0, department_id: '', branch_id: ''
                            } as any)} className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 active:scale-[0.98] transition-all rounded-xl py-2.5 px-5 font-semibold">
                                <Plus className="w-4 h-4 mr-2" /> Добавить
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <SalarySettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            {/* Table */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th key={header.id} className="px-4 py-3 font-bold text-slate-500 select-none" onClick={header.column.getToggleSortingHandler()}>
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {table.getRowModel().rows.slice(0, visibleRows).map(row => (
                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="px-4 py-3 align-top">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {visibleRows < table.getRowModel().rows.length && (
                        <div ref={observerTarget} className="h-20 w-full flex justify-center items-center text-slate-400 text-sm cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setVisibleRows(prev => prev + 50)}>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Загрузка...
                        </div>
                    )}
                </div>

                {filteredData.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                        {data.length === 0 ? "Список позиций пуст. Добавьте первую позицию." : "По вашему запросу ничего не найдено."}
                    </div>
                )}
            </div>

            {/* Modals */}
            <PlanningForm
                isOpen={!!editingRow}
                onClose={() => setEditingRow(null)}
                initialData={editingRow}
                onSave={handleSave}
                structure={structure}
                canEditFinancials={canEditFinancials}
            />

            <PlanningHistory
                isOpen={!!historyId}
                onClose={() => setHistoryId(null)}
                planId={historyId || 0}
            />
        </div>
    );
}
