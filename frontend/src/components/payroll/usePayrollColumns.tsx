import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { History, Edit2, UserX } from 'lucide-react';
import { EmployeeRecord, FinancialValue } from './types';
import { FinancialCell } from './FinancialCell';

interface UsePayrollColumnsProps {
    onHistory: (e: React.MouseEvent, emp: EmployeeRecord) => void;
    onEdit: (emp: EmployeeRecord) => void;
    onDismiss: (id: number) => void;
    user: any;
    activeTab: 'active' | 'dismissed';
}

export const usePayrollColumns = ({
    onHistory,
    onEdit,
    onDismiss,
    user,
    activeTab
}: UsePayrollColumnsProps): ColumnDef<EmployeeRecord>[] => {
    return React.useMemo(() => [
        {
            accessorKey: 'full_name',
            header: 'ФИО Сотрудника',
            cell: i => <div className="font-semibold text-slate-800 break-words" title={i.getValue() as string}>{i.getValue() as string}</div>
        },
        {
            accessorKey: 'hire_date',
            header: 'Дата приема',
            cell: i => <div className="text-slate-500 text-xs font-mono whitespace-nowrap">{i.getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'position',
            header: 'Должность',
            cell: i => <div className="break-words" title={i.getValue() as string}>{i.getValue() as string}</div>
        },
        {
            accessorKey: 'branch',
            header: 'Филиал / Подразделение',
            cell: ({ row }) => (
                <div className="break-words">
                    <div className="font-medium text-slate-700" title={row.original.branch}>{row.original.branch}</div>
                    {row.original.department && row.original.department !== '-' && (
                        <div className="text-xs text-slate-500 mt-0.5 inline-block bg-slate-100 px-1.5 py-0.5 rounded break-words">
                            {row.original.department}
                        </div>
                    )}
                </div>
            )
        },
        {
            accessorKey: 'base',
            header: 'Оклад',
            cell: ({ getValue }) => <FinancialCell value={getValue() as FinancialValue} />
        },
        {
            accessorKey: 'kpi',
            header: 'KPI',
            cell: i => <FinancialCell value={i.getValue() as FinancialValue} />
        },
        {
            accessorKey: 'bonus',
            header: 'Доплаты',
            cell: i => <FinancialCell value={i.getValue() as FinancialValue} />
        },
        {
            accessorKey: 'total',
            header: 'Итого',
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-sm min-w-[120px]">
                        <FinancialCell value={row.original.total} isTotal={true} />
                    </div>

                    {/* History Button */}
                    <button
                        onClick={(e) => onHistory(e, row.original)}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-blue-600 transition-colors"
                        title="История изменений"
                    >
                        <History className="w-4 h-4" />
                    </button>

                    {/* Edit/Dismiss Buttons */}
                    {(user.role === 'Administrator' || user.permissions.add_employees || user.permissions.admin_access) && activeTab === 'active' && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(row.original);
                                }}
                                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-emerald-600 transition-colors"
                                title="Редактировать"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDismiss(row.original.id);
                                }}
                                className="p-1.5 hover:bg-red-50 rounded-md text-red-300 hover:text-red-600 transition-colors"
                                title="Уволить"
                            >
                                <UserX className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            )
        }
    ], [onHistory, onEdit, onDismiss, user, activeTab]);
};
