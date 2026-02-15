import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../Modal';
import { Input } from '../ui-mocks';
import { Button } from '../ui-mocks';
import { HelpCircle, ChevronRight, ChevronDown, Building2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { MoneyInput } from '../shared';
import { calculateTaxes, solveGrossFromNet, DEFAULT_CONFIG, SalaryConfig } from '../../utils/salary';
import { PlanRow } from '../../hooks/usePlanning';
import { StructureItem, useFlatStructure } from '../../hooks/useStructure';
import { usePositions } from '../../hooks/usePositions';
import { api } from '../../lib/api';

type PlanningFormProps = {
    isOpen: boolean;
    onClose: () => void;
    initialData: PlanRow | null;
    onSave: (data: any) => Promise<void>;
    structure: StructureItem[];
    canEditFinancials?: boolean;
};

export const PlanningForm: React.FC<PlanningFormProps> = ({ isOpen, onClose, initialData, onSave, canEditFinancials = false }) => {
    const { data: positions = [] } = usePositions();
    const { data: flatStructure } = useFlatStructure();

    const [editingRow, setEditingRow] = useState<PlanRow | null>(null);
    const [useAutoCalc, setUseAutoCalc] = useState(true);
    const [applyDeduction, setApplyDeduction] = useState(true);
    const [salaryConfig, setSalaryConfig] = useState<SalaryConfig>(DEFAULT_CONFIG);

    // Tree State
    const [isTreeOpen, setIsTreeOpen] = useState(false);
    const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

    useEffect(() => {
        api.get('/salary-config').then(res => setSalaryConfig(res.data)).catch(console.error);
    }, []);

    useEffect(() => {
        if (initialData) {
            setEditingRow({ ...initialData });
        } else {
            setEditingRow({
                id: 0, position: '', count: 1, base_net: 0, base_gross: 0, kpi_net: 0, kpi_gross: 0, bonus_net: 0, bonus_gross: 0, department_id: '', branch_id: ''
            } as any);
        }
    }, [initialData, isOpen]);

    const handleMoneyChange = (field: string, val: number, otherField: string) => {
        if (!editingRow) return;

        const updates: any = { [field]: val };

        if (useAutoCalc) {
            const isNet = field.includes('_net');
            if (isNet) {
                const gross = solveGrossFromNet(val, salaryConfig, applyDeduction);
                updates[otherField] = gross;
            } else {
                const res = calculateTaxes(val, salaryConfig, applyDeduction);
                updates[otherField] = res.net;
            }
        }
        setEditingRow(prev => prev ? ({ ...prev, ...updates }) : null);
    };

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
        flatStructure.forEach(item => {
            map.set(item.id, { ...item, children: [] });
        });
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
        if (!editingRow) return;

        let bId = '';
        let dId = '';

        if (unit.type === 'branch') {
            bId = unit.id.toString();
        } else {
            dId = unit.id.toString();
            // Trace back to find branch
            let current = unit;
            while (current.parent_id) {
                const parent = flatStructure?.find(i => i.id === current.parent_id);
                if (parent) {
                    if (parent.type === 'branch') {
                        bId = parent.id.toString();
                        break;
                    }
                    current = parent;
                } else {
                    break;
                }
            }
            if (!bId && current) {
                bId = current.id.toString();
            }
        }

        setEditingRow({
            ...editingRow,
            branch_id: bId,
            department_id: dId
        });
        setIsTreeOpen(false);
    };

    const selectedUnitName = useMemo(() => {
        if (!editingRow || !flatStructure) return '';
        // If department is set, show department name
        if (editingRow.department_id) {
            const d = flatStructure.find(i => i.id.toString() === editingRow.department_id?.toString());
            return d ? d.name : 'Отдел не найден';
        }
        // Else if branch is set, show branch name
        if (editingRow.branch_id) {
            const b = flatStructure.find(i => i.id.toString() === editingRow.branch_id?.toString());
            return b ? b.name : 'Филиал не найден';
        }
        return '';
    }, [editingRow?.branch_id, editingRow?.department_id, flatStructure]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRow) return;

        // Validation logic can be moved here or kept in parent, but let's do basic here
        if (!editingRow.position?.trim()) {
            toast.error("Укажите должность");
            return;
        }

        await onSave(editingRow);
        onClose();
    };

    if (!editingRow) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingRow.id === 0 ? "Новая позиция" : "Редактирование позиции"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-bold text-slate-700">Должность</label>
                        <select
                            required
                            className="input-base w-full h-10 rounded-lg border-slate-200 bg-white"
                            value={editingRow.position}
                            onChange={e => setEditingRow({ ...editingRow, position: e.target.value })}
                        >
                            <option value="">Выберите должность</option>
                            {positions.map(p => (
                                <option key={p.id} value={p.title}>{p.title}</option>
                            ))}
                            {/* If current position is not in list (legacy data), show it */}
                            {editingRow.position && !positions.find(p => p.title === editingRow.position) && (
                                <option value={editingRow.position}>{editingRow.position}</option>
                            )}
                        </select>
                    </div>
                    <div><label className="text-sm font-bold text-slate-700">Кол-во</label>
                        <Input required type="number" min="1" value={editingRow.count} onChange={e => setEditingRow({ ...editingRow, count: parseInt(e.target.value) || 0 })} /></div>
                </div>

                {/* Tree Selector for Unit */}
                <div className="relative">
                    <label className="text-sm font-bold text-slate-700">Подразделение</label>
                    <div
                        className="input-base w-full min-h-[40px] rounded-lg border border-slate-200 flex items-center px-3 cursor-pointer bg-white hover:border-indigo-300 transition-colors"
                        onClick={() => setIsTreeOpen(!isTreeOpen)}
                    >
                        {selectedUnitName ? (
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-indigo-500" />
                                <span className="text-slate-800 text-sm font-medium">{selectedUnitName}</span>
                            </div>
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

                <div><label className="text-sm font-bold text-slate-700">График</label>
                    <Input required value={editingRow.schedule || ''} onChange={e => setEditingRow({ ...editingRow, schedule: e.target.value })} placeholder="5/2" /></div>

                <div className={`bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100 ${!canEditFinancials ? 'opacity-75 pointer-events-none grayscale' : ''}`}>
                    <div className="flex justify-between items-center px-1">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={useAutoCalc}
                                onChange={e => setUseAutoCalc(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                                disabled={!canEditFinancials}
                            />
                            <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 transition-colors">Авто-расчет (Net ↔ Gross)</span>
                        </label>

                        {useAutoCalc && (
                            <div className="group relative flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={applyDeduction}
                                        onChange={e => setApplyDeduction(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                                        disabled={!canEditFinancials}
                                    />
                                    <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600 transition-colors flex items-center gap-1">
                                        Вычет (14 МРП)
                                        <HelpCircle className="w-3 h-3 text-slate-300" />
                                    </span>
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase text-slate-400 text-center tracking-wider">
                        <div></div><div>Net</div><div>Gross</div>
                    </div>
                    {[
                        { label: 'Оклад', net: 'base_net', gross: 'base_gross' },
                        { label: 'KPI', net: 'kpi_net', gross: 'kpi_gross' },
                        { label: 'Доплаты', net: 'bonus_net', gross: 'bonus_gross' }
                    ].map((group, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2 items-center">
                            <div className="text-sm font-bold text-slate-700">{group.label}</div>
                            <MoneyInput
                                className="bg-white"
                                value={(editingRow as any)[group.net]}
                                onChange={val => handleMoneyChange(group.net, val, group.gross)}
                                disabled={!canEditFinancials}
                            />
                            <MoneyInput
                                className="bg-white"
                                value={(editingRow as any)[group.gross]}
                                onChange={val => handleMoneyChange(group.gross, val, group.net)}
                                disabled={!canEditFinancials}
                            />
                        </div>
                    ))}
                </div>
                <Button className="w-full bg-slate-900 text-white hover:bg-slate-800 py-3 rounded-xl font-bold shadow-lg">Сохранить</Button>
            </form>
        </Modal>
    );
};
