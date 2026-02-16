import React, { useState } from 'react';
import Modal from '../Modal';
import { Button, Input } from '../ui-mocks';

interface DismissModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string, date: string) => Promise<void>;
    employeeName: string;
}

const DISMISSAL_REASONS = [
    "По собственному желанию",
    "Соглашение сторон",
    "Сокращение штата",
    "Непрохождение испытательного срока",
    "Нарушение трудовой дисциплины",
    "Перевод в другой филиал",
    "Окончание срочного договора",
    "Другое"
];

export const DismissModal: React.FC<DismissModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    employeeName
}) => {
    const [reason, setReason] = useState(DISMISSAL_REASONS[0]);
    const [customReason, setCustomReason] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const finalReason = reason === "Другое" ? customReason : reason;
            await onConfirm(finalReason, date);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Увольнение сотрудника: ${employeeName}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    <p>Внимание! После увольнения сотрудник будет переведен в архив и исключен из расчетов ФОТ.</p>
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-500 ml-1">Дата увольнения</label>
                    <Input
                        type="date"
                        required
                        value={date}
                        onChange={e => setDate(e.target.value)}
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-500 ml-1">Причина увольнения</label>
                    <select
                        className="input-base w-full h-10 rounded-lg border-slate-200"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                    >
                        {DISMISSAL_REASONS.map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                </div>

                {reason === "Другое" && (
                    <div>
                        <label className="text-xs font-bold text-slate-500 ml-1">Укажите причину</label>
                        <Input
                            required
                            type="text"
                            placeholder="Введите причину..."
                            value={customReason}
                            onChange={e => setCustomReason(e.target.value)}
                        />
                    </div>
                )}

                <div className="flex gap-2 justify-end mt-6">
                    <Button
                        type="button"
                        className="bg-slate-100 text-slate-600 hover:bg-slate-200"
                        onClick={onClose}
                    >
                        Отмена
                    </Button>
                    <Button
                        type="submit"
                        className="bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-200"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Обработка...' : 'Подтвердить увольнение'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
