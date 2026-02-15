import React, { useState, useEffect } from 'react';
import { Button, Input } from '../ui-mocks';
import Modal from '../Modal';
import { MoneyInput } from '../shared';
import { useUpdateEmployee } from '../../hooks/useEmployees';
import { useFlatStructure } from '../../hooks/useStructure';
import { ChevronRight, ChevronDown, Building2, Users } from 'lucide-react';

interface EditEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: any;
    planningData: any[];
}

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
    isOpen,
    onClose,
    employee,
    planningData
}) => {
    const { data: flatStructure } = useFlatStructure();
    const updateMutation = useUpdateEmployee();
    const [editDetails, setEditDetails] = useState<any>(null);

    // Tree State
    const [isTreeOpen, setIsTreeOpen] = useState(false);
    const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

    // Initialize state when employee changes
    useEffect(() => {
        if (employee) {
            setEditDetails({
                id: employee.id,
                full_name: employee.full_name,
                gender: employee.gender || 'Male',
                dob: employee.dob || '1990-01-01',
                org_unit_id: employee.org_unit_id,
                branch_id: employee.branch_id?.toString() || '',
                department_id: employee.department_id?.toString() || '',
                position_title: employee.position,
                base_net: employee.base.net,
                base_gross: employee.base.gross,
                kpi_net: employee.kpi.net,
                kpi_gross: employee.kpi.gross,
                bonus_net: employee.bonus.net,
                bonus_gross: employee.bonus.gross
            });
        }
    }, [employee]);

    // Tree Logic
    const toggleNode = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(expandedNodes);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedNodes(next);
    };

    const treeData = React.useMemo(() => {
        if (!flatStructure) return [];
        const map = new Map();
        const roots: any[] = [];
        flatStructure.forEach(item => map.set(item.id, { ...item, children: [] }));
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
        // Resolve IDs similar to AddEmployeeModal logic
        let bId: string | number = '';
        let dId: string | number = '';

        if (unit.type === 'branch') {
            bId = unit.id;
        } else {
            dId = unit.id;
            // Backtrack to find branch
            let current = unit;
            while (current.parent_id) {
                const parent = flatStructure?.find(i => i.id === current.parent_id);
                if (parent && parent.type === 'branch') {
                    bId = parent.id;
                    break;
                } else if (parent) {
                    current = parent;
                } else {
                    break;
                }
            }
            if (!bId && current) bId = current.id;
        }

        setEditDetails({
            ...editDetails,
            org_unit_id: unit.id,
            branch_id: bId,
            department_id: dId,
            position_title: '' // resetting position as positions depend on unit
        });
        setIsTreeOpen(false);
    };

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


    // If modal is closed or no details, don't render content or handle nulls
    if (!editDetails && isOpen) return null;
    if (!editDetails) return null;

    if (!editDetails && isOpen) return null;
    if (!editDetails) return null;

    const selectedUnitName = flatStructure?.find(u => u.id === editDetails.org_unit_id)?.name || 'Неизвестно';

    const editPositions = planningData.filter(p =>
        p.branch_id?.toString() === editDetails.branch_id &&
        p.department_id?.toString() === editDetails.department_id
    );

    const handleSyncPlan = () => {
        const planItem = editPositions.find((p: any) => p.position === editDetails.position_title);
        if (planItem) {
            setEditDetails({
                ...editDetails,
                base_net: planItem.base_net,
                base_gross: planItem.base_gross,
                kpi_net: planItem.kpi_net,
                kpi_gross: planItem.kpi_gross,
                bonus_net: planItem.bonus_net,
                bonus_gross: planItem.bonus_gross
            });
        } else {
            alert('Позиция не найдена в плане для выбранного отдела');
        }
    };

    const handleSaveDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateMutation.mutateAsync({ id: editDetails.id, data: editDetails });
            onClose();
        } catch (error) {
            console.error(error);
            // Toast in hook
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Редактировать сотрудника">
            <form onSubmit={handleSaveDetails} className="space-y-4">
                <div>
                    <label className="text-sm font-bold text-slate-700">ФИО</label>
                    <Input
                        value={editDetails.full_name}
                        onChange={e => setEditDetails({ ...editDetails, full_name: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 ml-1">Пол</label>
                        <select
                            required
                            className="input-base w-full h-10 rounded-lg border-slate-200"
                            value={editDetails.gender}
                            onChange={e => setEditDetails({ ...editDetails, gender: e.target.value })}
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
                            value={editDetails.dob}
                            onChange={e => setEditDetails({ ...editDetails, dob: e.target.value })}
                        />
                    </div>
                </div>

                {/* Tree Selector */}
                <div className="relative">
                    <label className="text-xs font-bold text-slate-500 ml-1">Подразделение</label>
                    <div
                        className="input-base w-full min-h-[40px] rounded-lg border border-slate-200 flex items-center px-3 cursor-pointer bg-white hover:border-indigo-300 transition-colors"
                        onClick={() => setIsTreeOpen(!isTreeOpen)}
                    >
                        <span className="text-slate-800 text-sm font-medium">{selectedUnitName}</span>
                        <ChevronRight className={`w-4 h-4 ml-auto text-slate-400 transition-transform ${isTreeOpen ? 'rotate-90' : ''}`} />
                    </div>

                    {isTreeOpen && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[300px] overflow-y-auto p-2">
                            {treeData.map(node => renderTreeNode(node))}
                            {treeData.length === 0 && <div className="p-4 text-center text-slate-400 text-xs">Структура пуста</div>}
                        </div>
                    )}
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-500 ml-1">Должность</label>
                    <select
                        className="input-base w-full h-10 rounded-lg border-slate-200"
                        required
                        value={editDetails.position_title}
                        onChange={e => setEditDetails({ ...editDetails, position_title: e.target.value })}
                        disabled={!editDetails.branch_id}
                    >
                        <option value={editDetails.position_title}>{editDetails.position_title} (Текущая)</option>
                        {[...new Set(editPositions.map((p: any) => p.position))].map((pos: any) => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Финансы</div>
                        <button
                            type="button"
                            onClick={handleSyncPlan}
                            className="text-[10px] bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded-md text-slate-600 font-bold transition-colors"
                        >
                            Применить данные из Плана
                        </button>
                    </div>
                    {[
                        { label: 'Оклад', fields: ['base_net', 'base_gross'] },
                        { label: 'KPI', fields: ['kpi_net', 'kpi_gross'] },
                        { label: 'Доплаты', fields: ['bonus_net', 'bonus_gross'] },
                    ].map((group, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2 items-center">
                            <span className="text-sm font-medium text-slate-600">{group.label}</span>
                            <MoneyInput
                                className="bg-slate-100 text-slate-500 cursor-not-allowed"
                                value={(editDetails as any)[group.fields[0]] || 0}
                                onChange={() => { }}
                                disabled
                            />
                            <MoneyInput
                                className="bg-slate-100 text-slate-500 cursor-not-allowed"
                                value={(editDetails as any)[group.fields[1]] || 0}
                                onChange={() => { }}
                                disabled
                            />
                        </div>
                    ))}
                </div>

                <Button className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl mt-4">Сохранить изменения</Button>
            </form>
        </Modal>
    );
};
