import React, { useState, useMemo } from 'react';
import { Button, Input } from '../ui-mocks';
import Modal from '../Modal';
import { MoneyInput } from '../shared';
import { useCreateEmployee } from '../../hooks/useEmployees';

interface AddEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    structure: any[];
    planningData: any[];
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
    isOpen,
    onClose,
    structure,
    planningData
}) => {
    const createMutation = useCreateEmployee();

    const [newEmployee, setNewEmployee] = useState({
        full_name: '',
        hire_date: new Date().toISOString().split('T')[0],
        branch_id: '',
        department_id: '',
        position_title: '',
        base_net: 0,
        base_gross: 0,
        kpi_net: 0,
        kpi_gross: 0,
        bonus_net: 0,
        bonus_gross: 0
    });

    const selectedBranch = structure.find(b => b.id.toString() === newEmployee.branch_id);

    const availablePositions = useMemo(() => {
        if (!newEmployee.branch_id || !newEmployee.department_id) return [];
        return planningData.filter(p =>
            p.branch_id?.toString() === newEmployee.branch_id &&
            p.department_id?.toString() === newEmployee.department_id &&
            p.count > 0 // Only positions that have slots
        );
    }, [newEmployee.branch_id, newEmployee.department_id, planningData]);

    const handlePositionSelect = (posTitle: string) => {
        const planItem = availablePositions.find(p => p.position === posTitle);
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
            await createMutation.mutateAsync(newEmployee);
            onClose();
            // Reset form
            setNewEmployee({
                full_name: '',
                hire_date: new Date().toISOString().split('T')[0],
                branch_id: '',
                department_id: '',
                position_title: '',
                base_net: 0,
                base_gross: 0,
                kpi_net: 0,
                kpi_gross: 0,
                bonus_net: 0,
                bonus_gross: 0
            });
        } catch (error) {
            console.error(error);
            // Toast is handled in hook
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Добавить сотрудника">
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

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 ml-1">Филиал</label>
                        <select
                            className="input-base w-full h-10 rounded-lg border-slate-200"
                            required
                            value={newEmployee.branch_id}
                            onChange={e => setNewEmployee({ ...newEmployee, branch_id: e.target.value, department_id: '', position_title: '' })}
                        >
                            <option value="">Выберите филиал</option>
                            {structure.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 ml-1">Отдел</label>
                        <select
                            className="input-base w-full h-10 rounded-lg border-slate-200"
                            required
                            value={newEmployee.department_id}
                            onChange={e => setNewEmployee({ ...newEmployee, department_id: e.target.value, position_title: '' })}
                            disabled={!newEmployee.branch_id}
                        >
                            <option value="">Выберите отдел</option>
                            {selectedBranch?.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-500 ml-1">Должность</label>
                    <select
                        className="input-base w-full h-10 rounded-lg border-slate-200"
                        required
                        value={newEmployee.position_title}
                        onChange={e => handlePositionSelect(e.target.value)}
                        disabled={!newEmployee.branch_id}
                    >
                        <option value="">Выберите должность из плана</option>
                        {[...new Set(availablePositions.map(p => p.position))].map(pos => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                    {availablePositions.length === 0 && newEmployee.branch_id && (
                        <div className="text-[10px] text-orange-500 mt-1 ml-1">В плане нет доступных позиций для выбранного филиала/отдела</div>
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
