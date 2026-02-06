import React, { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,

  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from './ui-mocks';
import { api } from '../lib/api';

import {
  EmployeeStats,
  EmployeeTabs,
  EmployeeTableFilters,
  AddEmployeeModal,
  EditEmployeeModal,
  HistoryModal,
  usePayrollColumns,
  EmployeeRecord,
  BranchStructure,
  PlanRow,
  AuditLog
} from './payroll';



export default function PayrollTable({ user }: { onLogout: () => void, user: any }) {
  const [data, setData] = useState<EmployeeRecord[]>([]);
  const [structure, setStructure] = useState<BranchStructure[]>([]);
  const [planningData, setPlanningData] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Tabs
  const [activeTab, setActiveTab] = useState<'active' | 'dismissed'>('active');

  // Filters
  const [globalFilter, setGlobalFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('Все');
  const [departmentFilter, setDepartmentFilter] = useState<string>('Все');

  // Infinite Scroll State
  const [visibleRows, setVisibleRows] = useState(20);
  const observerTarget = React.useRef<HTMLDivElement>(null);


  // Modal States
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);


  const fetchData = async () => {
    setLoading(true);
    try {
      const [empJson, structJson, planJson] = await Promise.all([
        api.get('/employees'),
        api.get('/structure'),
        api.get('/planning')
      ]);
      setData(empJson);
      setStructure(structJson);
      setPlanningData(planJson);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleHistoryClick = async (e: React.MouseEvent, emp: EmployeeRecord) => {
    e.stopPropagation();
    try {
      // Assuming api.get returns the logs directly
      // In real backend, endpoint might differ, e.g. /audit-logs/:id
      // Keeping original fetchHistory logic flavor but renamed
      const logs = await api.get(`/audit-logs/${emp.id}`);
      setAuditLogs(logs);
      setIsHistoryOpen(true);
    } catch (e) { alert('Failed to load history'); }
  };

  const handleRowClick = (emp: EmployeeRecord) => {
    setSelectedEmployee(emp);
    setIsEditOpen(true);
  };

  const handleDismiss = async (id: number) => {
    if (!confirm("Вы действительно хотите уволить этого сотрудника?")) return;
    try {
      await api.post(`/employees/${id}/dismiss`, {});
      fetchData();
    } catch (e: any) { alert(e.message); }
  };

  // --- Filtering Logic ---
  const filteredData = useMemo(() => {
    let res = data;

    // Tab Filter
    if (activeTab === 'active') {
      res = res.filter(item => item.status !== 'Dismissed');
    } else {
      res = res.filter(item => item.status === 'Dismissed');
    }

    // Safety Guard: Filter against authorized structure
    if (structure.length > 0) {
      const allowedBranchNames = new Set(structure.map(b => b.name));
      res = res.filter(item => allowedBranchNames.has(item.branch));
    }

    // Filter by Branch (UI Filter)
    if (branchFilter !== 'Все') {
      res = res.filter(item => item.branch === branchFilter);
    }

    // Filter by Department (UI Filter)
    if (departmentFilter !== 'Все') {
      res = res.filter(item => item.department === departmentFilter);
    }
    // Filter by Search
    if (globalFilter) {
      res = res.filter(item => item.full_name.toLowerCase().includes(globalFilter.toLowerCase()));
    }

    return res;
  }, [data, branchFilter, departmentFilter, structure, activeTab, globalFilter]);

  // Reset infinite scroll when filters change
  useEffect(() => {
    setVisibleRows(50);
  }, [globalFilter, branchFilter, departmentFilter, activeTab, structure]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleRows((prev) => prev + 50);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [filteredData.length, visibleRows, loading]);

  const hasDismissed = useMemo(() => data.some(e => e.status === 'Dismissed'), [data]);



  const columns = usePayrollColumns({
    onHistory: handleHistoryClick,
    onEdit: handleRowClick,
    onDismiss: handleDismiss,
    user,
    activeTab: activeTab as 'active' | 'dismissed'
  });

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });



  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Список сотрудников</h1>
          <p className="text-slate-500 mt-1">Реестр сотрудников и начислений</p>
        </div>
        <div className="flex gap-4">
          <EmployeeStats
            totalNet={filteredData.reduce((acc, curr) => acc + curr.total.net, 0)}
            totalGross={filteredData.reduce((acc, curr) => acc + curr.total.gross, 0)}
          />
        </div>
      </div>

      {/* Tabs */}
      <EmployeeTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasDismissed={hasDismissed}
      />

      <EmployeeTableFilters
        searchValue={globalFilter}
        onSearchChange={setGlobalFilter}
        branchFilter={branchFilter}
        onBranchFilterChange={setBranchFilter}
        departmentFilter={departmentFilter}
        onDepartmentFilterChange={setDepartmentFilter}
        structure={structure}
      >
        {(user.role === 'Administrator' || user.permissions.add_employees || user.permissions.admin_access) && activeTab === 'active' && (
          <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 active:scale-[0.98] transition-all rounded-xl py-2.5 px-5 font-semibold" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Добавить сотрудника
          </Button>
        )}
      </EmployeeTableFilters>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="h-64 flex justify-center items-center">
            <Loader2 className="animate-spin w-8 h-8 opacity-50" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-48 flex justify-center items-center text-slate-500">Нет данных</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100 sticky top-0 z-10 backdrop-blur-sm">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className="px-6 py-4 font-bold text-slate-500 select-none align-top"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.getRowModel().rows.slice(0, visibleRows).map(row => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(row.original)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-6 py-4 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Infinite Scroll Sentinel */}
            {visibleRows < table.getRowModel().rows.length && (
              <div
                ref={observerTarget}
                className="h-20 w-full flex justify-center items-center text-slate-400 text-sm cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setVisibleRows(prev => prev + 50)}
              >
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Загрузка...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddEmployeeModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={() => { fetchData(); }}
        structure={structure}
        planningData={planningData}
      />

      <EditEmployeeModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        employee={selectedEmployee}
        onSuccess={() => { fetchData(); }}
        structure={structure}
        planningData={planningData}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        logs={auditLogs}
      />
    </div>
  );
}
