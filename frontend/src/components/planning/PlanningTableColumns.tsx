import { ColumnDef } from '@tanstack/react-table';
import { Edit2, History, Trash2 } from 'lucide-react';
import { formatMoney } from '../../utils';
import { PlanRow } from '../../hooks/usePlanning';
import { StructureItem } from '../../hooks/useStructure';

export const createColumns = (
    structure: StructureItem[],
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
