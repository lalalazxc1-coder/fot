import React, { useState, useMemo } from 'react';
import { Button, Input } from '../ui-mocks';
import Modal from '../Modal';
import { MoneyInput } from '../shared';
import { useCreateEmployee } from '../../hooks/useEmployees';
import { useFlatStructure } from '../../hooks/useStructure';
import { ChevronRight, ChevronDown, Building2, Users } from 'lucide-react';

interface AddEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    // structure: any[]; // Deprecated, using useFlatStructure internal logic
    planningData: any[];
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
    isOpen,
    onClose,
    planningData
}) => {
    const createMutation = useCreateEmployee();
    const { data: flatStructure } = useFlatStructure();

    const [newEmployee, setNewEmployee] = useState({
        full_name: '',
        hire_date: new Date().toISOString().split('T')[0],
        org_unit_id: '', // New single source of truth
        branch_id: '' as string | number, // Type assertion for mixed usage
        department_id: '' as string | number, // Kept for backend compatibility
        is_head: false,
        position_title: '',
        gender: 'Male',
        dob: '1990-01-01',
        base_net: 0,
        base_gross: 0,
        kpi_net: 0,
        kpi_gross: 0,
        bonus_net: 0,
        bonus_gross: 0,
        last_raise_date: ''
    });

    // --- Tree Select Logic ---
    const [isTreeOpen, setIsTreeOpen] = useState(false);
    const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

    const toggleNode = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(expandedNodes);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedNodes(next);
    };

    const treeData = useMemo(() => {
        if (!flatStructure) return [];
        const map = new Map();
        const roots: any[] = [];
        // First pass: create node objects
        flatStructure.forEach(item => {
            map.set(item.id, { ...item, children: [] });
        });
        // Second pass: link parents
        flatStructure.forEach(item => {
            if (item.parent_id && map.has(item.parent_id)) {
                map.get(item.parent_id).children.push(map.get(item.id));
            } else {
                roots.push(map.get(item.id));
            }
        });
        return roots;
    }, [flatStructure]);

    const handleSelectUnit = (unit: any) => {
        // Determine branch_id and department_id based on selection
        // Logic: if type is branch -> branch_id=id, dept_id=null
        // if type is dept -> dept_id=id, branch_id = (find top level parent?? or just kept blank if backend handles it?)
        // The backend expects: branch_id (REQUIRED), department_id (OPTIONAL)
        // PROBLEM: If I select a "Department" that is deep in the tree, what is its "Branch"?
        // The backend logic for creating employee seems to rely on branch_id being the top-level container?
        // Actually, backend `create_employee` does: target_org_id = data.department_id if data.department_id else data.branch_id
        // So we just need to pass the target ID.
        // Let's modify frontend to fill both, but primarily target.

        // Find "Root" parent for branch_id if needed, but for now let's just use the logic:
        // IF unit.type == 'branch' -> branch_id = unit.id
        // IF unit.type == 'department' -> department_id = unit.id (and we'll assume backend handles the rest or we mock branch_id?)

        // Actually, let's trace up to find the "Branch" type parent for `branch_id` just in case backend enforces it.
        // Simplified: We will set `org_unit_id` in state for UI, and `branch_id`/`department_id` for payload.

        let bId: string | number = '';
        let dId: string | number = '';

        if (unit.type === 'branch') {
            bId = unit.id;
        } else {
            dId = unit.id;
            // Try to find parent branch... simple search up?
            // For now, let's just set branch_id to the ROOT of this tree??
            // Just sending department_id might fail validation if branch_id is required in Pydantic?
            // Check schemas.py: EmployeeCreate has `branch_id: int` REQUIRED.
            // So we MUST find the branch. 

            // Backtracking to find branch_id
            let current = unit;
            while (current.parent_id) {
                const parent = flatStructure?.find(i => i.id === current.parent_id);
                if (parent) {
                    if (parent.type === 'branch') {
                        bId = parent.id;
                        break;
                    }
                    current = parent;
                } else {
                    break;
                }
            }
            // If still no branch found (e.g. Dept -> Dept -> Root), maybe the top level Dept is the "Branch"?
            if (!bId && current) {
                // Fallback: the top-most parent is considered the 'branch' context
                bId = current.id;
            }
        }

        setNewEmployee({
            ...newEmployee,
            org_unit_id: unit.id,
            branch_id: bId, // Now explicitly set here
            department_id: dId,
            position_title: '' // Reset position loop 
        });
        setIsTreeOpen(false);
    };

    const selectedUnitName = useMemo(() => {
        if (!newEmployee.org_unit_id || !flatStructure) return '';
        const u = flatStructure.find(i => i.id === parseInt(newEmployee.org_unit_id as string));
        return u ? u.name : 'Неизвестно';
    }, [newEmployee.org_unit_id, flatStructure]);

    const renderTreeNode = (node: any, level = 0) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes.has(node.id);

        return (
            <div key={node.id} className="select-none">
                <div
                    className={`flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition-colors ${level > 0 ? 'ml-4' : ''}`}
                    onClick={() => handleSelectUnit(node)}
                >
                    <div onClick={(e) => hasChildren && toggleNode(node.id, e)} className={`p-1 rounded-sm hover:bg-slate-200 text-slate-400 ${!hasChildren && 'opacity-0'}`}>
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </div>
                    {node.type === 'head_office' ? (
                        <Building2 className="w-4 h-4 text-purple-600" />
                    ) : node.type === 'branch' ? (
                        <Building2 className="w-4 h-4 text-indigo-500" />
                    ) : (
                        <Users className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-sm text-slate-700">{node.name}</span>
                </div>
                {hasChildren && isExpanded && (
                    <div className="border-l border-slate-100 ml-3">
                        {node.children.map((child: any) => renderTreeNode(child, level + 1))}
                    </div>
                )}
            </div>
        )
    };

    // --- End Tree Logic ---

    const availablePositions = useMemo(() => {
        if (!newEmployee.org_unit_id) return [];

        const targetDeptId = newEmployee.department_id ? String(newEmployee.department_id) : '';
        const targetBranchId = newEmployee.branch_id ? String(newEmployee.branch_id) : '';

        return planningData.filter(p => {
            const planDeptId = p.department_id ? String(p.department_id) : '';
            const planBranchId = p.branch_id ? String(p.branch_id) : '';

            // 1. Strict Department Match: If target has Dept, Plan must match Dept
            if (targetDeptId) {
                return planDeptId === targetDeptId;
            }

            // 2. Strict Branch Match: If target has NO Dept (is Branch), Plan must match Branch AND have NO Dept
            if (targetBranchId) {
                return planBranchId === targetBranchId && !planDeptId;
            }

            return false;
        });
    }, [newEmployee.branch_id, newEmployee.department_id, newEmployee.org_unit_id, planningData]);

    const handlePositionSelect = (posTitle: string) => {
        // Find best match (prefer highest salary if duplicates exist)
        const candidates = availablePositions.filter(p => p.position === posTitle);
        // Sort by total net salary desc
        const planItem = candidates.sort((a, b) => {
            const totalA = (a.base_net || 0) + (a.kpi_net || 0) + (a.bonus_net || 0);
            const totalB = (b.base_net || 0) + (b.kpi_net || 0) + (b.bonus_net || 0);
            return totalB - totalA;
        })[0];

        setNewEmployee({
            ...newEmployee,
            position_title: posTitle,
            base_net: planItem?.base_net || 0,
            base_gross: planItem?.base_gross || 0,
            kpi_net: planItem?.kpi_net || 0,
            kpi_gross: planItem?.kpi_gross || 0,
            bonus_net: planItem?.bonus_net || 0,
            bonus_gross: planItem?.bonus_gross || 0
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Prepare payload: convert empty strings to null/undefined or numbers
            const payload = {
                ...newEmployee,
                branch_id: newEmployee.branch_id ? Number(newEmployee.branch_id) : undefined,
                department_id: newEmployee.department_id ? Number(newEmployee.department_id) : undefined,
                gender: newEmployee.gender,
                dob: newEmployee.dob,
                is_head: newEmployee.is_head,
                // Ensure numbers
                base_net: Number(newEmployee.base_net),
                base_gross: Number(newEmployee.base_gross),
                kpi_net: Number(newEmployee.kpi_net),
                kpi_gross: Number(newEmployee.kpi_gross),
                bonus_net: Number(newEmployee.bonus_net),
                bonus_gross: Number(newEmployee.bonus_gross),
                last_raise_date: newEmployee.last_raise_date || null
            };

            await createMutation.mutateAsync(payload);
            onClose();
            // Reset form
            setNewEmployee({
                full_name: '',
                hire_date: new Date().toISOString().split('T')[0],
                org_unit_id: '',
                branch_id: '',
                department_id: '',
                is_head: false,
                position_title: '',
                gender: 'Male',
                dob: '1990-01-01',
                base_net: 0,
                base_gross: 0,
                kpi_net: 0,
                kpi_gross: 0,
                bonus_net: 0,
                bonus_gross: 0,
                last_raise_date: ''
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Добавить сотрудника (Иерархия)">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    required
                    placeholder="ФИО сотрудника"
                    value={newEmployee.full_name}
                    onChange={e => setNewEmployee({ ...newEmployee, full_name: e.target.value })}
                />
                <div className="mt-2">
                    <label className="text-xs font-bold text-slate-500 ml-1">Дата приема</label>
                    <Input
                        type="date"
                        required
                        value={newEmployee.hire_date}
                        onChange={e => setNewEmployee({ ...newEmployee, hire_date: e.target.value })}
                    />
                </div>

                <div className="mt-2">
                    <label className="text-xs font-bold text-slate-500 ml-1">Дата последнего обновления ЗП</label>
                    <Input
                        type="date"
                        value={newEmployee.last_raise_date}
                        onChange={e => setNewEmployee({ ...newEmployee, last_raise_date: e.target.value })}
                    />
                    <p className="text-[10px] text-slate-400 ml-1 mt-1">
                        Если зарплата не менялась давно, укажите дату последнего изменения.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 ml-1">Пол</label>
                        <select
                            required
                            className="input-base w-full h-10 rounded-lg border-slate-200"
                            value={newEmployee.gender}
                            onChange={e => setNewEmployee({ ...newEmployee, gender: e.target.value })}
                        >
                            <option value="">Выберите...</option>
                            <option value="Male">Мужской</option>
                            <option value="Female">Женский</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 ml-1">Дата рождения</label>
                        <Input
                            type="date"
                            required
                            value={newEmployee.dob}
                            onChange={e => setNewEmployee({ ...newEmployee, dob: e.target.value })}
                        />
                    </div>
                </div>

                {/* Tree Selector */}
                <div className="relative">
                    <label className="text-xs font-bold text-slate-500 ml-1">Подразделение (Выберите из структуры)</label>
                    <div
                        className="input-base w-full min-h-[40px] rounded-lg border border-slate-200 flex items-center px-3 cursor-pointer bg-white hover:border-indigo-300 transition-colors"
                        onClick={() => setIsTreeOpen(!isTreeOpen)}
                    >
                        {selectedUnitName ? (
                            <span className="text-slate-800 text-sm font-medium">{selectedUnitName}</span>
                        ) : (
                            <span className="text-slate-400 text-sm">Выберите отдел или филиал...</span>
                        )}
                        <ChevronRight className={`w-4 h-4 ml-auto text-slate-400 transition-transform ${isTreeOpen ? 'rotate-90' : ''}`} />
                    </div>

                    {isTreeOpen && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[300px] overflow-y-auto p-2">
                            {treeData.map(node => renderTreeNode(node))}
                            {treeData.length === 0 && <div className="p-4 text-center text-slate-400 text-xs">Структура пуста</div>}
                        </div>
                    )}
                </div>

                {/* Assign Head Option */}
                {(() => {
                    const selectedUnitData = flatStructure?.find(u => u.id === Number(newEmployee.org_unit_id));
                    // Check if unit has head (either head_id or head object)
                    const hasHead = selectedUnitData?.head_id || selectedUnitData?.head;

                    if (newEmployee.org_unit_id && !hasHead) {
                        return (
                            <div className="flex items-center gap-2 mt-2 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                                <input
                                    type="checkbox"
                                    id="is_head"
                                    checked={newEmployee.is_head}
                                    onChange={e => setNewEmployee({ ...newEmployee, is_head: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                />
                                <label htmlFor="is_head" className="text-sm text-slate-700 cursor-pointer select-none font-medium">
                                    Назначить руководителем отдела
                                </label>
                            </div>
                        );
                    }
                    return null;
                })()}

                <div>
                    <label className="text-xs font-bold text-slate-500 ml-1">Должность</label>
                    <select
                        className="input-base w-full h-10 rounded-lg border-slate-200"
                        required
                        value={newEmployee.position_title}
                        onChange={e => handlePositionSelect(e.target.value)}
                        disabled={!newEmployee.org_unit_id}
                    >
                        <option value="">Выберите должность из плана</option>
                        {[...new Set(availablePositions.map(p => p.position))].map(pos => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                    {availablePositions.length === 0 && newEmployee.org_unit_id && (
                        <div className="text-[10px] text-orange-500 mt-1 ml-1">В плане нет доступных позиций для выбранного подразделения</div>
                    )}
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
                            <MoneyInput
                                value={(newEmployee as any)[group.fields[0]] || 0}
                                onChange={() => { }}
                                placeholder="Net"
                                disabled
                                className="bg-slate-100 text-slate-500 cursor-not-allowed"
                            />
                            <MoneyInput
                                value={(newEmployee as any)[group.fields[1]] || 0}
                                onChange={() => { }}
                                placeholder="Gross"
                                disabled
                                className="bg-slate-100 text-slate-500 cursor-not-allowed"
                            />
                        </div>
                    ))}
                </div>

                <Button className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl mt-4">Создать сотрудника</Button>
            </form>
        </Modal>
    );
};
