import React, { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,

  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';
import { Plus, Loader2, Download, HelpCircle } from 'lucide-react';
import { PageHeader } from './shared';
import { Button } from './ui-mocks';
import { api } from '../lib/api';
import Modal from './Modal';

import {
  EmployeeStats,
  EmployeeTabs,
  EmployeeTableFilters,
  AddEmployeeModal,
  EditEmployeeModal,
  HistoryModal,
  usePayrollColumns,
  EmployeeRecord,
  AuditLog
} from './payroll';



import { useEmployees, useDismissEmployee } from '../hooks/useEmployees';
import { useStructure } from '../hooks/useStructure';
import { usePlanningData } from '../hooks/usePlanning';

export default function EmployeeTable({ user }: { onLogout: () => void, user: any }) {
  // Config
  const { data: data = [], isLoading: isEmployeesLoading } = useEmployees();
  const { data: structure = [] } = useStructure();
  const { data: planningData = [] } = usePlanningData();

  const dismissMutation = useDismissEmployee();

  const loading = isEmployeesLoading;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'dismissed'>('active');

  // Filters
  const [globalFilter, setGlobalFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Infinite Scroll State
  const [visibleRows, setVisibleRows] = useState(20);
  const observerTarget = React.useRef<HTMLDivElement>(null);

  // Modal States
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const handleHistoryClick = async (e: React.MouseEvent, emp: EmployeeRecord) => {
    e.stopPropagation();
    try {
      // Assuming api.get returns the logs directly
      // In real backend, endpoint might differ, e.g. /audit-logs/:id
      // Keeping original fetchHistory logic flavor but renamed
      const logs = await api.get(`/audit-logs/${emp.id}`);
      setAuditLogs(logs.data);
      setIsHistoryOpen(true);
    } catch (e) { alert('Failed to load history'); }
  };

  const handleRowClick = (emp: EmployeeRecord) => {
    setSelectedEmployee(emp);
    setIsEditOpen(true);
  };

  const handleDismiss = async (id: number) => {
    if (!confirm("Вы действительно хотите уволить этого сотрудника?")) return;
    await dismissMutation.mutateAsync(id);
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




    // Helper to find all descendants of a unit
    const getDescendantIds = (rootId: number, structureData: typeof structure) => {
      const ids = new Set<number>();
      // We need a flat map of all units to traverse easily or just iterate
      // Since structure is Branch -> Departments[], we can iterate capable branches

      // Let's build a flat parent-lookup from structure
      // Actually structure is BranchStructure[] which contains all descendants in 'departments' list now (flat list with parent_id)

      // Find the branch or unit in structure
      const branch = structureData.find(b => b.id === rootId);
      if (branch) {
        ids.add(branch.id);
        branch.departments.forEach(d => ids.add(d.id));
        return ids;
      }

      // If rootId is a department, we need to find it in one of the branches
      for (const b of structureData) {
        const dept = b.departments.find(d => d.id === rootId);
        if (dept) {
          ids.add(dept.id);
          // Find all children of this department
          // Simple 1-level down check? No, we need recursive.
          // Re-build tree from flat list to find descendants
          const findChildren = (pid: number) => {
            b.departments.filter(d => d.parent_id === pid).forEach(child => {
              ids.add(child.id);
              findChildren(child.id);
            });
          };
          findChildren(rootId);
          return ids;
        }
      }
      return ids;
    };

    // Filter by Branch (UI Filter) - Now using ID
    if (branchFilter !== 'all') {
      const branchId = parseInt(branchFilter);
      const validIds = getDescendantIds(branchId, structure);
      // Include the branch itself and all its sub-units
      // Data items have org_unit_id
      res = res.filter(item => item.org_unit_id && validIds.has(item.org_unit_id));
    }

    // Filter by Department (UI Filter) - Now using ID
    if (departmentFilter !== 'all') {
      const deptId = parseInt(departmentFilter);
      const validIds = getDescendantIds(deptId, structure);
      res = res.filter(item => item.org_unit_id && validIds.has(item.org_unit_id));
    }
    // Filter by Search
    if (globalFilter) {
      res = res.filter(item =>
        item.full_name.toLowerCase().includes(globalFilter.toLowerCase()) ||
        item.position.toLowerCase().includes(globalFilter.toLowerCase())
      );
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

  const table = useReactTable<EmployeeRecord>({
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
      <PageHeader
        title="Список сотрудников"
        subtitle="Реестр сотрудников и начислений"
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
        <EmployeeStats
          totalNet={filteredData.reduce((acc, curr) => acc + curr.total.net, 0)}
          totalGross={filteredData.reduce((acc, curr) => acc + curr.total.gross, 0)}
        />
      </PageHeader>

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
              const response = await fetch('/api/employees/export', {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              if (!response.ok) throw new Error('Export failed');
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Employees_${new Date().toISOString().slice(0, 10)}.xlsx`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } catch (error) {
              alert('Ошибка при экспорте');
            }
          }}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 active:scale-[0.98] transition-all rounded-xl py-2.5 px-4 font-semibold mr-2"
          title="Экспорт в Excel"
        >
          <Download className="w-4 h-4 mr-2" />
          Экспорт
        </Button>
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
                        className="px-4 py-3 font-bold text-slate-500 select-none align-top"
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
                      <td key={cell.id} className="px-4 py-3 align-top">
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
        planningData={planningData}
      />

      <EditEmployeeModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        employee={selectedEmployee}
        planningData={planningData}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        logs={auditLogs}
      />

      {/* Help Modal */}
      <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Как работает управление сотрудниками?">
        <div className="space-y-6 text-sm text-slate-600">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="mb-2">
              <span className="font-bold text-slate-900">Реестр сотрудников</span> — это центральная база данных о всех сотрудниках компании.
            </p>
            <p>
              Здесь вы фиксируете фактически нанятых людей и отслеживаете их финансовые условия.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-slate-900">Основные функции</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="font-medium text-slate-900">Добавление сотрудников:</span> При добавлении вы можете выбрать позицию из плана ФОТ, и зарплатные данные заполнятся автоматически.
              </li>
              <li>
                <span className="font-medium text-slate-900">Просмотр данных:</span> Здесь отображаются текущие финансовые условия всех сотрудников.
              </li>
              <li>
                <span className="font-medium text-slate-900">История изменений:</span> Нажмите на иконку истории, чтобы увидеть все изменения зарплаты и статуса.
              </li>
              <li>
                <span className="font-medium text-slate-900">Увольнение:</span> При увольнении сотрудник не удаляется, а переходит в статус "Уволен" и доступен на соответствующей вкладке.
              </li>
            </ul>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <div className="font-bold text-amber-900 mb-1 flex items-center gap-2">
              ⚠️ Важно
            </div>
            <div className="text-amber-800 text-xs space-y-2">
              <p>
                Изменения условий оплаты происходят только через вкладку <span className="font-bold">"Фонд оплаты труда"</span>.
              </p>
              <p>
                Изменения автоматически применяются к связанным сотрудникам. Если по какой-то причине данные не обновились, вы можете вручную подтянуть актуальную информацию в настройках сотрудника.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-slate-900">Фильтры и поиск</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li>Используйте поиск по имени или должности</li>
              <li>Фильтруйте по филиалу и отделу</li>
              <li>Переключайтесь между активными и уволенными сотрудниками</li>
            </ul>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl text-blue-800 text-xs">
            <div className="font-bold mb-1">Совет:</div>
            <div>
              Для контроля бюджета сравнивайте общий ФОТ сотрудников с плановым ФОТ на странице Аналитики.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
