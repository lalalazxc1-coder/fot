import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui-mocks';

interface BranchStructure {
    id: number;
    name: string;
    departments: { id: number; name: string }[];
}

interface EmployeeTableFiltersProps {
    searchValue: string;
    onSearchChange: (value: string) => void;
    branchFilter: string;
    onBranchFilterChange: (value: string) => void;
    departmentFilter: string;
    onDepartmentFilterChange: (value: string) => void;
    structure: BranchStructure[];
    children?: React.ReactNode;
}

export const EmployeeTableFilters: React.FC<EmployeeTableFiltersProps> = ({
    searchValue,
    onSearchChange,
    branchFilter,
    onBranchFilterChange,
    departmentFilter,
    onDepartmentFilterChange,
    structure,
    children
}) => {
    const selectedFilterBranch = structure.find(b => b.name === branchFilter);

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-5 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100">
            {/* Search */}
            <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    placeholder="Поиск по ФИО..."
                    value={searchValue}
                    className="pl-9 bg-slate-50 border-transparent focus:bg-white transition-all rounded-xl"
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            {/* Branch Filter */}
            <div className="relative w-full sm:w-64">
                <select
                    className="h-10 w-full rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900/10 focus:bg-white outline-none hover:bg-slate-100 transition-all font-medium text-slate-600"
                    value={branchFilter}
                    onChange={(e) => {
                        onBranchFilterChange(e.target.value);
                        onDepartmentFilterChange('Все');
                    }}
                >
                    <option value="Все">Все филиалы</option>
                    {structure.map(b => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                </select>
            </div>

            {/* Department Filter */}
            <div className="relative w-full sm:w-64">
                <select
                    className="h-10 w-full rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900/10 focus:bg-white outline-none hover:bg-slate-100 transition-all font-medium text-slate-600 disabled:opacity-50"
                    value={departmentFilter}
                    onChange={(e) => onDepartmentFilterChange(e.target.value)}
                    disabled={branchFilter === 'Все'}
                >
                    <option value="Все">Все отделы</option>
                    {selectedFilterBranch?.departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                </select>
            </div>
            {/* Actions */}
            <div className="ml-auto">
                {children}
            </div>
        </div>
    );
};
