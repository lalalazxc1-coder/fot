import { ColumnDef } from '@tanstack/react-table';
import { Edit2, History, Trash2 } from 'lucide-react';
import { PlanRow } from '../../hooks/usePlanning';
import { FlatStructureItem } from '../../hooks/useStructure';
import { FinancialCell } from '../payroll/FinancialCell';

export const createColumns = (
    flatStructure: FlatStructureItem[],
    canManage: boolean,
    onHistory: (id: number) => void,
    onEdit: (row: PlanRow) => void,
    onDelete: (id: number) => void
): ColumnDef<PlanRow>[] => [
        {
            header: '#',
            accessorFn: (_, index) => index + 1,
            cell: info => <span className="text-slate-400 font-mono text-xs">{info.getValue() as number}</span>,
            size: 50,
        },
        {
            header: 'Подразделение',
            accessorKey: 'branch_id',
            cell: info => {
                const row = info.row.original;
                // Prefer department if set, else branch
                const targetId = row.department_id || row.branch_id;
                if (!targetId) return <span className="text-slate-300 text-xs">Не указано</span>;

                const unit = flatStructure.find(u => u.id.toString() === targetId.toString());

                let branchName = "Неизвестно";
                let deptName = null;

                if (!unit) {
                    // Unit not found - data inconsistency
                    console.warn(`Planning position ${row.id} references non-existent unit ${targetId}`);
                    return (
                        <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-red-600">⚠️ Неизвестно</span>
                            <span className="text-[9px] text-red-400">(ID:{targetId})</span>
                        </div>
                    );
                }

                // If unit is branch or head_office, use it as branch
                if (unit.type === 'branch' || unit.type === 'head_office') {
                    branchName = unit.name;
                } else {
                    // Unit is department - show department name
                    deptName = unit.name;
                    // Find branch or head_office parent
                    let current = unit;
                    while (current.parent_id) {
                        const p = flatStructure.find(u => u.id === current.parent_id);
                        if (p) {
                            if (p.type === 'branch' || p.type === 'head_office') {
                                branchName = p.name;
                                break;
                            }
                            current = p;
                        } else {
                            break;
                        }
                    }
                    // Fallback: if still unknown and current is branch/head_office, use it
                    if (branchName === "Неизвестно" && (current.type === 'branch' || current.type === 'head_office')) {
                        branchName = current.name;
                    }
                }

                return (
                    <div>
                        <div className="text-sm font-medium text-slate-700">{branchName}</div>
                        {deptName && <div className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-1">{deptName}</div>}
                    </div>
                );
            }
        },
        {
            header: 'Должность',
            accessorKey: 'position',
            cell: info => <div className="font-medium text-slate-800 text-sm">{info.getValue() as string}</div>,
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
            cell: ({ row }) => <FinancialCell value={{
                net: row.original.base_net,
                gross: row.original.base_gross
            }} />,
        },
        {
            header: 'KPI (Net/Gross)',
            id: 'kpi',
            cell: ({ row }) => <FinancialCell value={{
                net: row.original.kpi_net,
                gross: row.original.kpi_gross
            }} />,
        },
        {
            header: 'Итого на ед.',
            id: 'total_per_unit',
            cell: ({ row }) => {
                const r = row.original;
                const net = r.base_net + r.kpi_net + r.bonus_net;
                const gross = r.base_gross + r.kpi_gross + r.bonus_gross;
                return <FinancialCell value={{ net, gross }} />;
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
                    <div className="bg-slate-900 text-white px-2 py-1.5 rounded-lg shadow-sm min-w-[100px]">
                        <FinancialCell value={{ net, gross }} isTotal={true} />
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
                        <button onClick={() => onHistory(row.original.id)} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors" title="История">
                            <History className="w-4 h-4" />
                        </button>
                        <button onClick={() => onEdit(row.original)} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-lg transition-colors" title="Редактировать">
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDelete(row.original.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Удалить">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )
            }
        }
    ];
