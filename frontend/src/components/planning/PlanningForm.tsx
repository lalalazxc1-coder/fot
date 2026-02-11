import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { Input } from '../ui-mocks';
import { Button } from '../ui-mocks';
import { HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MoneyInput } from '../shared';
import { calculateTaxes, solveGrossFromNet, DEFAULT_CONFIG, SalaryConfig } from '../../utils/salary';
import { PlanRow } from '../../hooks/usePlanning';
import { StructureItem } from '../../hooks/useStructure';
import { api } from '../../lib/api';

type PlanningFormProps = {
    isOpen: boolean;
    onClose: () => void;
    initialData: PlanRow | null;
    onSave: (data: any) => Promise<void>;
    structure: StructureItem[];
};

export const PlanningForm: React.FC<PlanningFormProps> = ({ isOpen, onClose, initialData, onSave, structure }) => {
    const [editingRow, setEditingRow] = useState<PlanRow | null>(null);
    const [useAutoCalc, setUseAutoCalc] = useState(true);
    const [applyDeduction, setApplyDeduction] = useState(true);
    const [salaryConfig, setSalaryConfig] = useState<SalaryConfig>(DEFAULT_CONFIG);

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

    const selectedModalBranch = structure.find(b => b.id.toString() === editingRow?.branch_id?.toString());

    if (!editingRow) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingRow.id === 0 ? "Новая позиция" : "Редактирование позиции"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm font-bold text-slate-700">Должность</label>
                        <Input required value={editingRow.position} onChange={e => setEditingRow({ ...editingRow, position: e.target.value })} /></div>
                    <div><label className="text-sm font-bold text-slate-700">Кол-во</label>
                        <Input required type="number" min="1" value={editingRow.count} onChange={e => setEditingRow({ ...editingRow, count: parseInt(e.target.value) || 0 })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm font-bold text-slate-700">Филиал</label>
                        <select required className="input-base w-full h-10 rounded-lg border-slate-200" value={editingRow.branch_id || ''} onChange={e => setEditingRow({ ...editingRow, branch_id: e.target.value, department_id: '' })}>
                            <option value="">Не выбран</option>
                            {structure.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div><label className="text-sm font-bold text-slate-700">Отдел</label>
                        <select
                            required={(selectedModalBranch?.departments?.length || 0) > 0}
                            className="input-base w-full h-10 rounded-lg border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                            value={editingRow.department_id || ''}
                            onChange={e => setEditingRow({ ...editingRow, department_id: e.target.value })}
                            disabled={!selectedModalBranch}
                        >
                            <option value="">Не выбран</option>
                            {selectedModalBranch?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                </div>
                <div><label className="text-sm font-bold text-slate-700">График</label>
                    <Input required value={editingRow.schedule || ''} onChange={e => setEditingRow({ ...editingRow, schedule: e.target.value })} placeholder="5/2" /></div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
                    <div className="flex justify-between items-center px-1">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={useAutoCalc}
                                onChange={e => setUseAutoCalc(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
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
                            />
                            <MoneyInput
                                className="bg-white"
                                value={(editingRow as any)[group.gross]}
                                onChange={val => handleMoneyChange(group.gross, val, group.net)}
                            />
                        </div>
                    ))}
                </div>
                <Button className="w-full bg-slate-900 text-white hover:bg-slate-800 py-3 rounded-xl font-bold shadow-lg">Сохранить</Button>
            </form>
        </Modal>
    );
};
