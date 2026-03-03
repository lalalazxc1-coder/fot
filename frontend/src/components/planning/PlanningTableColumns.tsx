import { ColumnDef } from '@tanstack/react-table';
import { PlanRow } from '../../hooks/usePlanning';
import { FlatStructureItem } from '../../hooks/useStructure';
import { FinancialCell } from '../payroll/FinancialCell';
import { ActionMenu } from './ActionMenu';

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
            enableSorting: false,
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
                    <div className="opacity-90 hover:opacity-100 transition-opacity">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{branchName}</div>
                        {deptName && <div className="text-sm font-medium text-slate-800 mt-1">{deptName}</div>}
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
            sortDescFirst: true,
            cell: info => <div className="flex justify-center"><span className="bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200/50 text-xs font-bold px-2.5 py-1 rounded-lg min-w-[32px] text-center">{info.getValue() as number}</span></div>,
        },
        {
            header: 'Оклад',
            id: 'base',
            accessorFn: row => row.base_net,
            sortDescFirst: true,
            cell: ({ row }) => <FinancialCell value={{
                net: row.original.base_net,
                gross: row.original.base_gross
            }} />,
        },
        {
            header: 'KPI',
            id: 'kpi',
            accessorFn: row => row.kpi_net,
            sortDescFirst: true,
            cell: ({ row }) => <FinancialCell value={{
                net: row.original.kpi_net,
                gross: row.original.kpi_gross
            }} />,
        },
        {
            header: 'Доплаты',
            id: 'bonus',
            accessorFn: row => row.bonus_net,
            sortDescFirst: true,
            cell: ({ row }) => {
                const r = row.original;
                const hasPartialBonus = r.bonus_count !== null && r.bonus_count !== undefined && r.bonus_count < r.count && (r.bonus_net > 0 || r.bonus_gross > 0);
                return (
                    <div className="flex flex-col items-center justify-center relative group">
                        <FinancialCell value={{
                            net: r.bonus_net,
                            gross: r.bonus_gross
                        }} />
                        {hasPartialBonus && (
                            <div className="absolute -top-1 -right-2 flex h-2.5 w-2.5 cursor-help" title={`Доплата применяется только для ${r.bonus_count} ед.`}>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-white"></span>
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            header: 'Итого на ед.',
            id: 'total_per_unit',
            accessorFn: row => row.base_net + row.kpi_net + row.bonus_net,
            sortDescFirst: true,
            cell: ({ row }) => {
                const r = row.original;
                const net = r.base_net + r.kpi_net + r.bonus_net;
                const gross = r.base_gross + r.kpi_gross + r.bonus_gross;

                const bonusCount = r.bonus_count !== null && r.bonus_count !== undefined ? r.bonus_count : r.count;
                const hasPartialBonus = bonusCount > 0 && bonusCount < r.count && (r.bonus_net > 0 || r.bonus_gross > 0);

                return (
                    <div className="flex flex-col items-center justify-center relative group">
                        <FinancialCell value={{ net, gross }} />
                        {hasPartialBonus && (
                            <div className="absolute -top-1 -right-2 flex h-2.5 w-2.5 cursor-help" title={`Включает доплату только для ${bonusCount} ед.`}>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-white"></span>
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            header: 'Общий итог',
            id: 'grand_total',
            accessorFn: row => {
                const bonusCount = row.bonus_count !== null && row.bonus_count !== undefined ? row.bonus_count : row.count;
                return (row.base_net + row.kpi_net) * row.count + (row.bonus_net * bonusCount);
            },
            sortDescFirst: true,
            size: 140,
            cell: ({ row }) => {
                const r = row.original;
                const bonusCount = r.bonus_count !== null && r.bonus_count !== undefined ? r.bonus_count : r.count;
                const net = (r.base_net + r.kpi_net) * r.count + (r.bonus_net * bonusCount);
                const gross = (r.base_gross + r.kpi_gross) * r.count + (r.bonus_gross * bonusCount);
                return (
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 text-white px-3 py-2 rounded-xl shadow-md flex flex-col justify-center transform transition-transform hover:scale-[1.02]">
                        <FinancialCell value={{ net, gross }} isTotal={true} />
                    </div>
                );
            }
        },
        {
            id: 'actions',
            header: '',
            enableSorting: false,
            size: 80,
            cell: ({ row }) => {
                if (!canManage) return null;
                return (
                    <ActionMenu
                        row={row.original}
                        onHistory={onHistory}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                )
            }
        }
    ];
