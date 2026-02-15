import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui-mocks';
import { StructureItem } from '../../hooks/useStructure';

type PlanningFiltersProps = {
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    branchFilter: string;
    setBranchFilter: (val: string) => void;
    departmentFilter: string;
    setDepartmentFilter: (val: string) => void;
    structure: StructureItem[];
};

export const PlanningFilters: React.FC<PlanningFiltersProps> = ({
    searchQuery, setSearchQuery,
    branchFilter, setBranchFilter,
    departmentFilter, setDepartmentFilter,
    structure
}) => {
    const selectedFilterBranch = structure.find(b => b.id.toString() === branchFilter);

    return (
        <>
            <div className="relative w-full sm:w-64">
                <select
                    className="h-10 w-full rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900/10 focus:bg-white outline-none hover:bg-slate-100 transition-all font-medium text-slate-600"
                    value={branchFilter || 'all'}
                    onChange={e => {
                        setBranchFilter(e.target.value === 'all' ? '' : e.target.value);
                        setDepartmentFilter('');
                    }}
                >
                    <option value="all">Все структуры</option>
                    {structure.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>
            <div className="relative w-full sm:w-64">
                <select
                    className="h-10 w-full rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900/10 focus:bg-white outline-none hover:bg-slate-100 transition-all font-medium text-slate-600 disabled:opacity-50"
                    value={departmentFilter || 'all'}
                    onChange={e => setDepartmentFilter(e.target.value === 'all' ? '' : e.target.value)}
                    disabled={!branchFilter || branchFilter === 'all'}
                >
                    <option value="all">Все подразделения</option>
                    {selectedFilterBranch?.departments.map(d => (
                        <option key={d.id} value={d.id}>
                            {d.parent_id && d.parent_id !== selectedFilterBranch?.id ? ` - ${d.name}` : d.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    placeholder="Поиск по должности..."
                    className="pl-9 bg-slate-50 border-transparent focus:bg-white transition-all rounded-xl"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>
        </>
    );
};
