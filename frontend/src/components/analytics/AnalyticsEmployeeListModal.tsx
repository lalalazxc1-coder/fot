import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import Modal from '../Modal';
import { formatMoney } from '../../utils';
import { Loader2, User } from 'lucide-react';
import { useSnapshot } from '../../context/SnapshotContext';

interface AnalyticsEmployee {
    id: number;
    full_name: string;
    position: string;
    unit_name: string;
    total_net: number;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    filters: {
        unit_id?: number;
        position?: string;
        risk_level?: string;
    };
}

export const AnalyticsEmployeeListModal = ({ isOpen, onClose, title, filters }: Props) => {
    const { snapshotDate } = useSnapshot();

    const { data: employees = [], isLoading } = useQuery({
        queryKey: ['analytics', 'drill-down', filters, snapshotDate],
        queryFn: async () => {
            const params = { ...filters, date: snapshotDate };
            const res = await api.get('/analytics/employees', { params });
            return res.data as AnalyticsEmployee[];
        },
        enabled: isOpen,
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-2xl">
            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                ) : employees.length === 0 ? (
                    <div className="text-center p-12 text-slate-500 italic">Сотрудников не найдено.</div>
                ) : (
                    <div className="overflow-hidden border border-slate-100 rounded-xl">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Сотрудник</th>
                                    <th className="px-4 py-3">Подразделение</th>
                                    <th className="px-4 py-3 text-right">ФОТ (нетто)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {employees.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-slate-100 rounded-lg text-slate-400">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900">{emp.full_name}</div>
                                                    <div className="text-xs text-slate-500">{emp.position}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{emp.unit_name}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                                            {formatMoney(emp.total_net)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="flex justify-end pt-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                    >
                        Закрыть
                    </button>
                </div>
            </div>
        </Modal>
    );
};
