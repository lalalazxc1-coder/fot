import React, { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';
import { History, Plus, Edit2, Loader2, Save, Search, Filter, Layers, Calculator, Trash2, UserX } from 'lucide-react';
import { Line, LineChart, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, Button, Input } from './ui-mocks';
import { api } from '../lib/api';
import Modal from './Modal';

const CURRENCY = '₸';
const formatMoney = (val: number) => val.toLocaleString('ru-RU') + ' ' + CURRENCY;

type FinancialValue = { net: number; gross: number };

type EmployeeRecord = {
  id: number;
  full_name: string;
  position: string;
  branch: string;
  department: string;
  base: FinancialValue;
  kpi: FinancialValue;
  bonus: FinancialValue;
  total: FinancialValue;
  status: string;
};

type BranchStructure = {
  id: number;
  name: string;
  departments: { id: number; name: string }[];
};

type AuditLog = {
  date: string;
  user: string;
  field: string;
  oldVal: string;
  newVal: string;
};

type PlanRow = {
  id: number;
  position: string;
  branch_id?: string | number;
  department_id?: string | number;
  count: number;
  base_net: number;
  base_gross: number;
  kpi_net: number;
  kpi_gross: number;
  bonus_net: number;
  bonus_gross: number;
};

const MoneyInput = ({ value, onChange, placeholder, className }: { value: number, onChange: (val: number) => void, placeholder?: string, className?: string }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    onChange(raw ? parseInt(raw, 10) : 0);
  };

  return (
    <Input
      type="text"
      className={className}
      placeholder={placeholder}
      value={value === 0 ? '' : value.toLocaleString('ru-RU')}
      onChange={handleChange}
    />
  );
};

export default function PayrollTable({ onLogout, user }: { onLogout: () => void, user: any }) {
  const [data, setData] = useState<EmployeeRecord[]>([]);
  const [structure, setStructure] = useState<BranchStructure[]>([]);
  const [planningData, setPlanningData] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Tabs
  const [activeTab, setActiveTab] = useState<'active' | 'dismissed'>('active');

  // Filters
  const [branchFilter, setBranchFilter] = useState<string>('Все');
  const [departmentFilter, setDepartmentFilter] = useState<string>('Все');

  // Modal States
  const [selectedHistory, setSelectedHistory] = useState<EmployeeRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [newEmployee, setNewEmployee] = useState({
    full_name: '',
    hire_date: '', // New field
    position_title: '',
    branch_id: '',
    department_id: '',
    base_net: 0, base_gross: 0,
    kpi_net: 0, kpi_gross: 0,
    bonus_net: 0, bonus_gross: 0
  });

  // Edit Details State
  const [editDetails, setEditDetails] = useState({
    full_name: '',
    position_title: '',
    branch_id: '',
    department_id: '',
    base_net: 0, base_gross: 0,
    kpi_net: 0, kpi_gross: 0,
    bonus_net: 0, bonus_gross: 0
  });

  // Helper render for cell
  const renderDual = (val: FinancialValue, isTotal = false) => (
    <div className="flex flex-col text-[10px] min-w-[90px]">
      <div className={`flex justify-between items-center gap-1.5 ${isTotal ? 'text-emerald-200' : 'text-slate-400'}`}>
        <span className="opacity-70">Net</span>
        <span className={`font-bold text-right truncate ${isTotal ? 'text-white text-xs' : 'text-emerald-700 text-[11px]'}`}>{formatMoney(val.net)}</span>
      </div>
      <div className={`flex justify-between items-center gap-1.5 border-t mt-0.5 pt-0.5 ${isTotal ? 'border-emerald-600/30' : 'border-slate-100'}`}>
        <span className={`opacity-70 ${isTotal ? 'text-emerald-300' : 'text-slate-400'}`}>Grs</span>
        <span className={`text-right truncate ${isTotal ? 'text-emerald-100' : 'text-slate-500'}`}>{formatMoney(val.gross)}</span>
      </div>
    </div>
  );

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

  const fetchHistory = async (emp: EmployeeRecord) => {
    try {
      const logs = await api.get(`/audit-logs/${emp.id}`);
      setAuditLogs(logs);
      setSelectedHistory(emp);
      setIsHistoryOpen(true);
    } catch (e) { alert('Failed to load history'); }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newEmployee,
        branch_id: parseInt(newEmployee.branch_id),
        department_id: newEmployee.department_id ? parseInt(newEmployee.department_id) : null,
      };
      await api.post('/employees', payload);
      setIsAddOpen(false);
      setNewEmployee({
        full_name: '', hire_date: '', position_title: '', branch_id: '', department_id: '',
        base_net: 0, base_gross: 0, kpi_net: 0, kpi_gross: 0, bonus_net: 0, bonus_gross: 0
      });
      fetchData();
    } catch (err: any) { alert('Ошибка: ' + err.message); }
  };

  /* Open Edit Modal with Financials */
  const openEdit = (emp: EmployeeRecord) => {
    setSelectedHistory(emp);
    const branch = structure.find(b => b.name === emp.branch);
    const dept = branch?.departments.find(d => d.name === emp.department);

    setEditDetails({
      full_name: emp.full_name,
      position_title: emp.position,
      branch_id: branch ? branch.id.toString() : '',
      department_id: dept ? dept.id.toString() : '',
      // Financials
      base_net: emp.base.net, base_gross: emp.base.gross,
      kpi_net: emp.kpi.net, kpi_gross: emp.kpi.gross,
      bonus_net: emp.bonus.net, bonus_gross: emp.bonus.gross
    });
    setIsEditOpen(true);
  };

  /* Sync Logic for Edit Modal */
  const handleSyncPlan = () => {
    if (!editDetails.position_title || !editDetails.branch_id) return;

    const plan = planningData.find(p =>
      p.position === editDetails.position_title &&
      p.branch_id?.toString() === editDetails.branch_id &&
      (!editDetails.department_id || !p.department_id || p.department_id.toString() === editDetails.department_id)
    );

    if (plan) {
      setEditDetails(prev => ({
        ...prev,
        base_net: plan.base_net, base_gross: plan.base_gross,
        kpi_net: plan.kpi_net, kpi_gross: plan.kpi_gross,
        bonus_net: plan.bonus_net, bonus_gross: plan.bonus_gross
      }));
      alert('Финансовые данные обновлены из плана!');
    } else {
      alert('Плановая позиция не найдена для выбранных параметров.');
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHistory) return;
    try {
      // 1. Update Details
      const detailsPayload = {
        full_name: editDetails.full_name,
        position_title: editDetails.position_title,
        branch_id: editDetails.branch_id ? parseInt(editDetails.branch_id) : null,
        department_id: editDetails.department_id ? parseInt(editDetails.department_id) : null,
      };
      await api.patch(`/employees/${selectedHistory.id}/details`, detailsPayload);

      // 2. Update Financials
      const financialPayload = {
        base_net: editDetails.base_net, base_gross: editDetails.base_gross,
        kpi_net: editDetails.kpi_net, kpi_gross: editDetails.kpi_gross,
        bonus_net: editDetails.bonus_net, bonus_gross: editDetails.bonus_gross
      };
      await api.patch(`/employees/${selectedHistory.id}/financials`, financialPayload);

      setIsEditOpen(false);
      fetchData();
    } catch (err: any) { alert('Ошибка: ' + err.message); }
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
    return res;
  }, [data, branchFilter, departmentFilter, structure, activeTab]);

  const hasDismissed = useMemo(() => data.some(e => e.status === 'Dismissed'), [data]);

  // Assuming EmployeeRecord is defined elsewhere, adding hire_date to it.
  // For example, if EmployeeRecord was defined like this:
  // interface EmployeeRecord {
  //   id: number;
  //   full_name: string;
  //   position: string;
  //   branch: string;
  //   department?: string;
  //   base: FinancialValue;
  //   kpi: FinancialValue;
  //   bonus: FinancialValue;
  //   total: FinancialValue;
  //   status: string;
  // }
  // It would become:
  // interface EmployeeRecord {
  //   id: number;
  //   full_name: string;
  //   position: string;
  //   branch: string;
  //   department?: string;
  //   base: FinancialValue;
  //   kpi: FinancialValue;
  //   bonus: FinancialValue;
  //   total: FinancialValue;
  //   status: string;
  //   hire_date?: string; // Added
  // }


  const columns: ColumnDef<EmployeeRecord>[] = [
    { accessorKey: 'full_name', header: 'ФИО Сотрудника', cell: i => <div className="font-semibold text-slate-800">{i.getValue() as string}</div> },
    { accessorKey: 'hire_date', header: 'Дата приема', cell: i => <div className="text-slate-500 text-xs font-mono whitespace-nowrap">{i.getValue() as string || '-'}</div> }, // Added Column
    { accessorKey: 'position', header: 'Должность' },
    {
      accessorKey: 'branch',
      header: 'Филиал / Подразделение',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-slate-700">{row.original.branch}</div>
          {row.original.department && row.original.department !== '-' && <div className="text-xs text-slate-500 mt-0.5 inline-block bg-slate-100 px-1.5 py-0.5 rounded">{row.original.department}</div>}
        </div>
      )
    },
    {
      accessorKey: 'base',
      header: 'Оклад',
      cell: ({ getValue }) => (
        <div>
          {renderDual(getValue() as FinancialValue)}
        </div>
      )
    },
    { accessorKey: 'kpi', header: 'KPI', cell: i => renderDual(i.getValue() as FinancialValue) },
    { accessorKey: 'bonus', header: 'Доплаты', cell: i => renderDual(i.getValue() as FinancialValue) },
    {
      accessorKey: 'total',
      header: 'Итого',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-sm min-w-[120px]">
            {renderDual(row.original.total, true)}
          </div>

          {/* History Button */}
          <button onClick={() => fetchHistory(row.original)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-blue-600 transition-colors" title="История изменений">
            <History className="w-4 h-4" />
          </button>

          {/* Edit Button */}
          {(user.role === 'Administrator' || user.permissions.add_employees || user.permissions.admin_access) && activeTab === 'active' && (
            <>
              <button onClick={() => openEdit(row.original)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-emerald-600 transition-colors" title="Редактировать">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDismiss(row.original.id)} className="p-1.5 hover:bg-red-50 rounded-md text-red-300 hover:text-red-600 transition-colors" title="Уволить">
                <UserX className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )
    },
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selectedBranch = structure.find(b => b.id.toString() === newEmployee.branch_id);
  const selectedFilterBranchStruct = structure.find(b => b.name === branchFilter);

  // Edit Modal Helpers
  const editBranch = structure.find(b => b.id.toString() === editDetails.branch_id);

  // Available Positions for Modal (Creation)
  const availablePositions = useMemo(() => {
    if (!newEmployee.branch_id) return [];
    return planningData.filter(p =>
      p.branch_id?.toString() === newEmployee.branch_id &&
      (!newEmployee.department_id || !p.department_id || p.department_id.toString() === newEmployee.department_id)
    );
  }, [newEmployee.branch_id, newEmployee.department_id, planningData]);

  // For Edit Modal positions - similar logic based on selected Branch in Edit
  const editPositions = useMemo(() => {
    if (!editDetails.branch_id) return [];
    return planningData.filter(p => p.branch_id?.toString() === editDetails.branch_id);
  }, [editDetails.branch_id, planningData]);


  const handlePositionSelect = (posName: string) => {
    // Find the plan for this position to autofill
    // We look for strict match first (branch + dept + name)
    const plan = planningData.find(p =>
      p.position === posName &&
      p.branch_id?.toString() === newEmployee.branch_id &&
      (!newEmployee.department_id || !p.department_id || p.department_id.toString() === newEmployee.department_id)
    );

    const updates: any = { position_title: posName };
    if (plan) {
      updates.base_net = plan.base_net;
      updates.base_gross = plan.base_gross;
      updates.kpi_net = plan.kpi_net;
      updates.kpi_gross = plan.kpi_gross;
      updates.bonus_net = plan.bonus_net;
      updates.bonus_gross = plan.bonus_gross;
    }
    setNewEmployee(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Список сотрудников</h1>
          <p className="text-slate-500 mt-1">Реестр сотрудников и начислений</p>
        </div>
        <div className="flex gap-4">
          <Card className="px-6 py-4 shadow-xl shadow-slate-200/60 border border-white bg-white min-w-[180px] rounded-2xl">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Оклад (Net)</div>
            <div className="text-3xl font-bold text-slate-900 leading-none tracking-tight">
              {formatMoney(filteredData.reduce((acc, curr) => acc + curr.total.net, 0))}
            </div>
          </Card>
          <Card className="px-6 py-4 shadow-xl shadow-slate-200/60 border border-white bg-white min-w-[180px] rounded-2xl">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Оклад (Gross)</div>
            <div className="text-3xl font-bold text-slate-900 leading-none tracking-tight">
              {formatMoney(filteredData.reduce((acc, curr) => acc + curr.total.gross, 0))}
            </div>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      {hasDismissed && (
        <div className="flex gap-2 border-b border-slate-200 mb-4">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'active' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Активные сотрудники
          </button>
          <button
            onClick={() => setActiveTab('dismissed')}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'dismissed' ? 'border-red-500 text-red-500' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Уволенные
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-5 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Поиск по ФИО..." className="pl-9 bg-slate-50 border-transparent focus:bg-white transition-all rounded-xl" onChange={e => table.getColumn('full_name')?.setFilterValue(e.target.value)} />
        </div>

        {/* Branch Filter */}
        <div className="relative w-full sm:w-64">
          <select className="h-10 w-full rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900/10 focus:bg-white outline-none hover:bg-slate-100 transition-all font-medium text-slate-600" value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setDepartmentFilter('Все'); }}>
            <option value="Все">Все филиалы</option>
            {structure.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
        </div>

        {/* Department Filter */}
        <div className="relative w-full sm:w-64">
          <select
            className="h-10 w-full rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900/10 focus:bg-white outline-none hover:bg-slate-100 transition-all font-medium text-slate-600 disabled:opacity-50"
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            disabled={branchFilter === 'Все'}
          >
            <option value="Все">Все отделы</option>
            {selectedFilterBranchStruct?.departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </div>

        <div className="ml-auto">
          {(user.role === 'Administrator' || user.permissions.add_employees || user.permissions.admin_access) && activeTab === 'active' && (
            <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 active:scale-[0.98] transition-all rounded-xl py-2.5 px-5 font-semibold" onClick={() => setIsAddOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Добавить сотрудника
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? <div className="p-20 flex justify-center"><Loader2 className="animate-spin w-8 h-8 opacity-50" /></div> :
          data.length === 0 ? <div className="p-20 text-center text-slate-500">Нет данных</div> :
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id} className="px-6 py-4 font-bold text-slate-500 select-none cursor-pointer" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-6 py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>

      {/* NEW EMPLOYEE MODAL */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Добавить сотрудника">
        <form onSubmit={handleAddEmployee} className="space-y-4">
          <Input required placeholder="ФИО сотрудника" value={newEmployee.full_name} onChange={e => setNewEmployee({ ...newEmployee, full_name: e.target.value })} />
          <div className="mt-2">
            <label className="text-xs font-bold text-slate-500 ml-1">Дата приема</label>
            <Input type="date" required value={newEmployee.hire_date} onChange={e => setNewEmployee({ ...newEmployee, hire_date: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 ml-1">Филиал</label>
              <select className="input-base w-full h-10 rounded-lg border-slate-200" required value={newEmployee.branch_id} onChange={e => setNewEmployee({ ...newEmployee, branch_id: e.target.value, department_id: '', position_title: '' })}>
                <option value="">Выберите филиал</option>
                {structure.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 ml-1">Отдел</label>
              <select className="input-base w-full h-10 rounded-lg border-slate-200" required value={newEmployee.department_id} onChange={e => setNewEmployee({ ...newEmployee, department_id: e.target.value, position_title: '' })} disabled={!newEmployee.branch_id}>
                <option value="">Выберите отдел</option>
                {selectedBranch?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 ml-1">Должность</label>
            <select className="input-base w-full h-10 rounded-lg border-slate-200" required value={newEmployee.position_title} onChange={e => handlePositionSelect(e.target.value)} disabled={!newEmployee.branch_id}>
              <option value="">Выберите должность из плана</option>
              {[...new Set(availablePositions.map(p => p.position))].map(pos => <option key={pos} value={pos}>{pos}</option>)}
            </select>
            {availablePositions.length === 0 && newEmployee.branch_id && <div className="text-[10px] text-orange-500 mt-1 ml-1">В плане нет доступных позиций для выбранного филиала/отдела</div>}
          </div>

          <div className="bg-slate-50 p-4 rounded-xl space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center mb-2">Финансовые условия</div>
            {[
              { label: 'Оклад', fields: ['base_net', 'base_gross'] },
              { label: 'KPI', fields: ['kpi_net', 'kpi_gross'] },
              { label: 'Бонусы', fields: ['bonus_net', 'bonus_gross'] },
            ].map((group, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 items-center">
                <span className="text-sm font-medium text-slate-600">{group.label}</span>
                <Input type="number" placeholder="Net" className="bg-slate-100 text-slate-500 cursor-not-allowed" value={(newEmployee as any)[group.fields[0]]} readOnly disabled />
                <Input type="number" placeholder="Gross" className="bg-slate-100 text-slate-500 cursor-not-allowed" value={(newEmployee as any)[group.fields[1]]} readOnly disabled />
              </div>
            ))}
          </div>

          <Button className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl mt-4">Создать сотрудника</Button>
        </form>
      </Modal>

      {/* EDIT DETAILS MODAL */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Редактировать сотрудника">
        {selectedHistory && (
          <form onSubmit={handleSaveDetails} className="space-y-4">
            <div>
              <label className="text-sm font-bold text-slate-700">ФИО</label>
              <Input value={editDetails.full_name} onChange={e => setEditDetails({ ...editDetails, full_name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1">Филиал</label>
                <select className="input-base w-full h-10 rounded-lg border-slate-200" required value={editDetails.branch_id} onChange={e => setEditDetails({ ...editDetails, branch_id: e.target.value, department_id: '', position_title: '' })}>
                  <option value="">Выберите филиал</option>
                  {structure.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1">Отдел</label>
                <select className="input-base w-full h-10 rounded-lg border-slate-200" required value={editDetails.department_id} onChange={e => setEditDetails({ ...editDetails, department_id: e.target.value, position_title: '' })} disabled={!editDetails.branch_id}>
                  <option value="">Выберите отдел</option>
                  {editBranch?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 ml-1">Должность</label>
              <select className="input-base w-full h-10 rounded-lg border-slate-200" required value={editDetails.position_title} onChange={e => setEditDetails({ ...editDetails, position_title: e.target.value })} disabled={!editDetails.branch_id}>
                <option value={editDetails.position_title}>{editDetails.position_title} (Текущая)</option>
                {[...new Set(editPositions.map(p => p.position))].map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Финансы</div>
                <button type="button" onClick={handleSyncPlan} className="text-[10px] bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded-md text-slate-600 font-bold transition-colors">
                  Применить данные из Плана
                </button>
              </div>
              {[
                { label: 'Оклад', fields: ['base_net', 'base_gross'] },
                { label: 'KPI', fields: ['kpi_net', 'kpi_gross'] },
                { label: 'Бонусы', fields: ['bonus_net', 'bonus_gross'] },
              ].map((group, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-sm font-medium text-slate-600">{group.label}</span>
                  {/* Using type assertions for dynamic access as defined in MoneyInput */}
                  {/* Disabled inputs for strict sync */}
                  <Input
                    className="bg-slate-100 text-slate-500 cursor-not-allowed"
                    value={(editDetails as any)[group.fields[0]]?.toLocaleString('ru-RU')}
                    readOnly
                    disabled
                  />
                  <Input
                    className="bg-slate-100 text-slate-500 cursor-not-allowed"
                    value={(editDetails as any)[group.fields[1]]?.toLocaleString('ru-RU')}
                    readOnly
                    disabled
                  />
                </div>
              ))}
            </div>

            <Button className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl mt-4">Сохранить изменения</Button>
          </form>
        )}
      </Modal>

      {/* HISTORY MODAL */}
      <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title="История изменений">
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar p-1">
          {auditLogs.length === 0 ? <p className="text-slate-400 text-center py-4">История пуста</p> :
            (() => {
              // Group logs by Date + User
              const grouped = [];
              let last = null;
              for (const log of auditLogs) {
                if (last && last.date === log.date && last.user === log.user) {
                  last.changes.push(log);
                } else {
                  last = { date: log.date, user: log.user, changes: [log] };
                  grouped.push(last);
                }
              }

              return grouped.map((group, i) => {
                const fieldLabels: any = {
                  base_net: "Оклад (Net)", base_gross: "Оклад (Gross)",
                  kpi_net: "KPI (Net)", kpi_gross: "KPI (Gross)",
                  bonus_net: "Бонусы (Net)", bonus_gross: "Бонусы (Gross)",
                  full_name: "ФИО", position_title: "Должность",
                  branch_id: "Филиал (ID)", department_id: "Отдел (ID)",
                };

                // Extract sync source if present
                const syncLog = group.changes.find((c: any) => c.field === 'sync_source');
                const normalChanges = group.changes.filter((c: any) => c.field !== 'sync_source');

                return (
                  <div key={i} className="flex gap-4 text-sm relative">
                    {/* Timeline line */}
                    {i !== grouped.length - 1 && <div className="absolute left-[88px] top-6 bottom-[-24px] w-px bg-slate-100"></div>}

                    <div className="w-20 text-slate-400 text-[10px] text-right pt-1.5 font-mono">{group.date.split(' ')[0]}<br />{group.date.split(' ')[1]}</div>

                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="font-bold text-slate-800 text-xs uppercase tracking-wider">{group.user}</div>
                        {syncLog && (
                          <div className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100 font-medium flex items-center">
                            ⚡ {syncLog.newVal.replace('Обновлено (', '').replace(')', '')}
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                        {normalChanges.map((log: any, j: number) => {
                          const label = fieldLabels[log.field] || log.field;
                          return (
                            <div key={j} className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                              <span className="text-slate-600 font-medium text-xs">{label}</span>
                              <div className="flex items-center gap-2 text-xs">
                                {log.oldVal && <span className="text-red-400 line-through decoration-red-200/50">{log.oldVal}</span>}
                                {log.oldVal && log.newVal && <span className="text-slate-300 text-[10px]">➜</span>}
                                {log.newVal && <span className="font-bold text-slate-700 bg-white shadow-sm border border-slate-100 px-1.5 py-0.5 rounded">{log.newVal}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              });
            })()
          }
        </div>
      </Modal>
    </div>
  );
}
