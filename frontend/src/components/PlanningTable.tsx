import { useState, useMemo, useRef, useEffect } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table';
import { Plus, Loader2, Settings, Download, HelpCircle, Calculator, RefreshCw } from 'lucide-react';
import { PageHeader } from './shared';
import { Button } from './ui-mocks';
import SalarySettingsModal from './SalarySettingsModal';
import Modal from './Modal';

import { usePlanningData, useCreatePlanItem, useUpdatePlanItem, useDeletePlanItem, PlanRow } from '../hooks/usePlanning';
import { useStructure, useFlatStructure } from '../hooks/useStructure';

import { PlanningStats } from './planning/PlanningStats';
import { PlanningFilters } from './planning/PlanningFilters';
import { PlanningHistory } from './planning/PlanningHistory';
import { PlanningForm } from './planning/PlanningForm';
import { createColumns } from './planning/PlanningTableColumns';

export default function PlanningTable({ user }: { user: any }) {
    // Hooks
    const { data: data = [], isLoading: isDataLoading } = usePlanningData();
    const { data: structure = [] } = useStructure();
    const { data: flatStructure = [], isLoading: isStructureLoading } = useFlatStructure();

    const createMutation = useCreatePlanItem();
    const updateMutation = useUpdatePlanItem();
    const deleteMutation = useDeletePlanItem();

    // Local State
    const [editingRow, setEditingRow] = useState<PlanRow | null>(null);
    const [historyId, setHistoryId] = useState<number | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

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

    // Helper to check manage permission
    const checkManagePermission = (user: any) => {
        return user.role === 'Administrator' || user.permissions?.manage_planning || user.permissions?.admin_access;
    };

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
        flatStructure,
        checkManagePermission(user),
        (id) => setHistoryId(id),
        (row) => setEditingRow(row),
        (id) => handleDelete(id)
    ), [flatStructure, user]);

    // Helper to find all descendants of a unit (Same logic as EmployeeTable)
    const getDescendantIds = (rootId: number) => {
        const ids = new Set<number>();
        ids.add(rootId);

        const findChildren = (pid: number) => {
            flatStructure.filter(u => u.parent_id === pid).forEach(child => {
                ids.add(child.id);
                findChildren(child.id);
            });
        };
        findChildren(rootId);
        return ids;
    };

    // Filtering logic
    const filteredData = useMemo(() => {
        let res = data;

        // Filter by Branch
        if (branchFilter && branchFilter !== 'all') {
            const branchId = parseInt(branchFilter);
            const validIds = getDescendantIds(branchId);
            res = res.filter(row => {
                const targetId = row.department_id || row.branch_id;
                return targetId && validIds.has(Number(targetId));
            });
        }

        // Filter by Department
        if (departmentFilter && departmentFilter !== 'all') {
            const deptId = parseInt(departmentFilter);
            const validIds = getDescendantIds(deptId);
            res = res.filter(row => {
                const targetId = row.department_id || row.branch_id;
                return targetId && validIds.has(Number(targetId));
            });
        }

        // Filter by Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            res = res.filter(row =>
                row.position.toLowerCase().includes(q)
            );
        }

        return res;
    }, [data, searchQuery, branchFilter, departmentFilter, flatStructure]);

    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (isDataLoading || isStructureLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PageHeader
                title="Фонд оплаты труда"
                subtitle="Управление штатными позициями и бюджетом"
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
                <PlanningStats data={filteredData} />
            </PageHeader>

            {/* Filters & Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-5 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100">
                <PlanningFilters
                    searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                    branchFilter={branchFilter} setBranchFilter={setBranchFilter}
                    departmentFilter={departmentFilter} setDepartmentFilter={setDepartmentFilter}
                    structure={structure}
                />

                <div className="ml-auto flex gap-2">
                    <Button
                        onClick={async () => {
                            try {
                                const userStr = localStorage.getItem('fot_user');
                                if (!userStr) {
                                    alert('Не авторизован');
                                    return;
                                }
                                const user = JSON.parse(userStr);
                                const token = user.access_token;
                                if (!token) {
                                    alert('Токен не найден');
                                    return;
                                }
                                const filteredIds = table.getRowModel().rows.map((r: any) => r.original.id);

                                const response = await fetch('/api/planning/export', {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ ids: filteredIds })
                                });
                                if (!response.ok) {
                                    const text = await response.text();
                                    console.error('Export error:', response.status, text);
                                    throw new Error(`Export failed: ${response.status}`);
                                }
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `FOT_Planning_${new Date().toISOString().slice(0, 10)}.xlsx`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                            } catch (error) {
                                console.error('Export error:', error);
                                alert('Ошибка при экспорте');
                            }
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 active:scale-[0.98] transition-all rounded-xl py-2.5 px-4 font-semibold"
                        title="Экспорт в Excel"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Экспорт
                    </Button>
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

            {/* Help Modal */}
            <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Как работает планирование ФОТ?">
                <div className="space-y-6 text-sm text-slate-600">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="leading-relaxed">
                            <span className="font-bold text-slate-900 text-base block mb-1">Штатное расписание</span>
                            Это фундамент вашего бюджета. Здесь вы управляете не людьми, а <strong>позициями</strong>. Вы определяете, сколько сотрудников нужно компании и какие ресурсы (деньги) на это выделены.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Механика работы</h4>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex gap-3">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg h-fit"><Calculator size={16} /></div>
                                <div>
                                    <span className="font-bold text-slate-900 block">Авторасчет налогов</span>
                                    Вы вводите сумму "на руки" (Net), а система автоматически считает "грязную" зарплату (Gross) со всеми налогами РК на 2026 год.
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg h-fit"><RefreshCw size={16} /></div>
                                <div>
                                    <span className="font-bold text-slate-900 block">Умная синхронизация</span>
                                    При изменении оклада в этом реестре, данные <strong>автоматически обновятся</strong> у всех привязанных к этой позиции сотрудников. Больше не нужно менять ЗП каждому вручную!
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                        <div className="font-bold text-amber-900 mb-1 flex items-center gap-2 uppercase text-[10px] tracking-widest">
                            ⚠️ Обратите внимание
                        </div>
                        <div className="text-amber-800 text-xs">
                            Если вы меняете количество позиций (Count), это напрямую влияет на общую сумму ФОТ в аналитике, даже если вакансия еще не занята.
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl text-blue-800 text-xs shadow-sm">
                        <div className="font-bold mb-1 italic">PRO-совет:</div>
                        <div>
                            Для моделирования масштабных изменений (например, индексация на 10% по всему филиалу) используйте раздел <strong>"Сценарии"</strong>, чтобы не сломать "живой" бюджет.
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
