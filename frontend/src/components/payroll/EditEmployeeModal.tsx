import React, { useState, useEffect } from 'react';
import { Button, Input } from '../ui-mocks';
import Modal from '../Modal';
import { MoneyInput } from '../shared';
import { useUpdateEmployee } from '../../hooks/useEmployees';

interface EditEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: any;
    structure: any[];
    planningData: any[];
}

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
    isOpen,
    onClose,
    employee,
    structure,
    planningData
}) => {
    const updateMutation = useUpdateEmployee();
    const [editDetails, setEditDetails] = useState<any>(null);

    // Initialize state when employee changes
    useEffect(() => {
        if (employee) {
            setEditDetails({
                id: employee.id,
                full_name: employee.full_name,
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
    }, [employee, structure]);

    // If modal is closed or no details, don't render content or handle nulls
    if (!editDetails && isOpen) return null;
    if (!editDetails) return null;

    const editBranch = structure.find(b => b.id.toString() === editDetails.branch_id);

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
                        <label className="text-xs font-bold text-slate-500 ml-1">Филиал</label>
                        <select
                            className="input-base w-full h-10 rounded-lg border-slate-200"
                            required
                            value={editDetails.branch_id || ''}
                            onChange={e => setEditDetails({ ...editDetails, branch_id: e.target.value, department_id: '', position_title: '' })}
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
                            value={editDetails.department_id || ''}
                            onChange={e => setEditDetails({ ...editDetails, department_id: e.target.value, position_title: '' })}
                            disabled={!editDetails.branch_id}
                        >
                            <option value="">Выберите отдел</option>
                            {editBranch?.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
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
