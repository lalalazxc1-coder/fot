import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui-mocks';

interface BranchStructure {
    id: number;
    name: string;
    departments: { id: number; name: string; parent_id?: number | null; type?: string }[];
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
    const selectedFilterBranch = structure.find(b => b.id.toString() === branchFilter);

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-5 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100">
            {/* Search */}


            {/* Branch Filter */}
            <div className="relative w-full sm:w-64">
                <select
                    className="h-10 w-full rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900/10 focus:bg-white outline-none hover:bg-slate-100 transition-all font-medium text-slate-600"
                    value={branchFilter}
                    onChange={(e) => {
                        onBranchFilterChange(e.target.value);
                        onDepartmentFilterChange('all');
                    }}
                >
                    <option value="all">Все структуры</option>
                    {structure.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>

            {/* Department Filter */}
            <div className="relative w-full sm:w-64">
                <select
                    className="h-10 w-full rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900/10 focus:bg-white outline-none hover:bg-slate-100 transition-all font-medium text-slate-600 disabled:opacity-50"
                    value={departmentFilter}
                    onChange={(e) => onDepartmentFilterChange(e.target.value)}
                    disabled={branchFilter === 'all'}
                >
                    <option value="all">Все подразделения</option>
                    {selectedFilterBranch?.departments.map(d => (
                        <option key={d.id} value={d.id}>
                            {/* Simple indentation if it's a sub-department or just name if flat list is sorted nicely? */}
                            {/* Since we don't know depth purely from just parent_id without building tree:
                                We rely on the order returned from backend?
                                Backend returns recursively, so Order: Parent, Child, Child-Child. 
                                We can infer depth or just show name for now.
                                Maybe prefix with ' - ' if parent_id matches one of the other items in this list?
                             */}
                            {d.parent_id && d.parent_id !== selectedFilterBranch?.id ? ` - ${d.name}` : d.name}
                        </option>
                    ))}
                </select>
            </div>
            {/* Search */}
            <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    placeholder="Поиск по должности..."
                    value={searchValue}
                    className="pl-9 bg-slate-50 border-transparent focus:bg-white transition-all rounded-xl"
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>
            {/* Actions */}
            <div className="ml-auto">
                {children}
            </div>
        </div>
    );
};
