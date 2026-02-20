import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useCreateRequest } from '../../hooks/useRequests';

interface CreateRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableEmployees: any[];
}

export const CreateRequestModal = ({ isOpen, onClose, availableEmployees }: CreateRequestModalProps) => {
    const createMutation = useCreateRequest();

    const [formData, setFormData] = useState({
        employee_id: '',
        type: 'raise',
        increase_amount: '',
        reason: ''
    });

    // Lock scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const emp = availableEmployees.find(e => e.id === Number(formData.employee_id));
        if (!emp) return;

        // Calculate total requested value
        const current = emp.total.net || 0;
        const increase = Number(formData.increase_amount);
        const requested = current + increase;

        await createMutation.mutateAsync({
            employee_id: Number(formData.employee_id),
            type: formData.type,
            current_value: current,
            requested_value: requested,
            reason: formData.reason
        });

        onClose();
        setFormData({ employee_id: '', type: 'raise', increase_amount: '', reason: '' });
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-slate-900">Новая заявка</h2>
                    <button onClick={onClose} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Сотрудник</label>
                        <select
                            className="w-full h-11 rounded-lg border border-slate-300 px-3 bg-white focus:ring-2 focus:ring-slate-900/10 outline-none"
                            value={formData.employee_id}
                            onChange={e => setFormData({ ...formData, employee_id: e.target.value })}
                            required
                        >
                            <option value="">Выберите сотрудника</option>
                            {availableEmployees.map(e => (
                                <option key={e.id} value={e.id}>{e.full_name} ({e.position})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Сумма повышения (Net)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₸</span>
                            <input
                                type="text"
                                className="w-full h-11 rounded-lg border border-slate-300 pl-8 pr-3 outline-none focus:ring-2 focus:ring-slate-900/10 font-mono"
                                value={formData.increase_amount ? Number(formData.increase_amount).toLocaleString('ru-RU') : ''}
                                onChange={e => {
                                    const raw = e.target.value.replace(/\D/g, '');
                                    setFormData({ ...formData, increase_amount: raw });
                                }}
                                placeholder="0"
                                required
                            />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Укажите сумму, на которую нужно увеличить оклад.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Причина / Обоснование</label>
                        <textarea
                            className="w-full h-24 rounded-lg border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-slate-900/10 resize-none"
                            value={formData.reason}
                            onChange={e => setFormData({ ...formData, reason: e.target.value })}
                            placeholder="Почему этот сотрудник заслуживает повышения?"
                            required
                        />
                    </div>

                    <button type="submit" className="w-full bg-slate-900 text-white h-12 rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10">
                        Отправить заявку
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};
