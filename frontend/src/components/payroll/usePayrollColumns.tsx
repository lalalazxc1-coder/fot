import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { EmployeeRecord, FinancialValue, AppUser } from './types';
import { FinancialCell } from './FinancialCell';
import { EmployeeActionMenu } from './EmployeeActionMenu';

interface UsePayrollColumnsProps {
    onHistory: (e: React.MouseEvent, emp: EmployeeRecord) => void;
    onEdit: (emp: EmployeeRecord) => void;
    onDismiss: (id: number) => void;
    user: AppUser;
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
                <div className="opacity-90 hover:opacity-100 transition-opacity">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider" title={row.original.branch}>{row.original.branch}</div>
                    {row.original.department && row.original.department !== '-' && (
                        <div className="text-sm font-medium text-slate-800 mt-1">
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
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 text-white px-3 py-2 rounded-xl shadow-md flex flex-col justify-center transform transition-transform hover:scale-[1.02]">
                    <FinancialCell value={row.original.total} isTotal={true} />
                </div>
            )
        },
        {
            id: 'actions',
            header: '',
            size: 80,
            cell: ({ row }) => {
                const canManage = user.role === 'Administrator' || user.permissions.add_employees || user.permissions.admin_access;
                return (
                    <EmployeeActionMenu
                        row={row.original}
                        onHistory={onHistory}
                        onEdit={onEdit}
                        onDismiss={onDismiss}
                        canManage={canManage}
                        activeTab={activeTab}
                    />
                );
            }
        }
    ], [onHistory, onEdit, onDismiss, user, activeTab]);
};
