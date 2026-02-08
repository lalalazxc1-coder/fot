import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Check, X, Clock, ArrowUpRight } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

// --- Types ---
type Details = {
    name: string;
    position: string;
    branch: string;
    department: string;
    date?: string; // For approver
};

type RequestRow = {
    id: number;
    employee_id: number;
    employee_details: Details;
    requester_details: Details;
    approver_details?: Details; // Helper from API
    type: 'raise' | 'bonus';
    current_value: number;
    requested_value: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
};

type EmployeeSimple = {
    id: number;
    full_name: string;
    position: string;
    total: { net: number };
};

const formatMoney = (val: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(val);

export default function RequestsPage() {
    const { user } = useOutletContext<{ user: any }>();
    const [requests, setRequests] = useState<RequestRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // For specific viewing
    const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');

    // Form State
    const [availableEmployees, setAvailableEmployees] = useState<EmployeeSimple[]>([]);
    const [formData, setFormData] = useState({
        employee_id: '',
        type: 'raise',
        increase_amount: '',
        reason: ''
    });

    const loadData = async () => {
        try {
            const res = await api.get('/requests');
            setRequests(res.data);

            // Load employees for dropdown
            const emps = await api.get('/employees');
            setAvailableEmployees(emps.data.filter((e: any) => e.status !== 'Dismissed'));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const emp = availableEmployees.find(e => e.id === Number(formData.employee_id));
            if (!emp) return;

            // Calculate total requested value (Current + Increase)
            const current = emp.total.net || 0;
            const increase = Number(formData.increase_amount);
            const requested = current + increase;

            await api.post('/requests', {
                employee_id: Number(formData.employee_id),
                type: formData.type,
                current_value: current,
                requested_value: requested,
                reason: formData.reason
            });
            setIsModalOpen(false);
            setFormData({ employee_id: '', type: 'raise', increase_amount: '', reason: '' });
            loadData();
        } catch (e) {
            alert('Failed to create request');
        }
    };

    const handleStatus = async (id: number, status: 'approved' | 'rejected') => {
        if (!confirm(`Вы уверены, что хотите ${status === 'approved' ? 'одобрить' : 'отклонить'} заявку?`)) return;
        try {
            await api.patch(`/requests/${id}/status`, { status });
            loadData();
        } catch (e) {
            alert('Error updating status');
        }
    };

    const filteredRequests = requests.filter(r => {
        if (viewMode === 'pending') return r.status === 'pending';
        return r.status !== 'pending';
    });

    const canManage = user?.role === 'Administrator' || user?.permissions?.admin_access; // Or specific permission

    if (loading) return <div className="p-10">Загрузка...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Заявки на пересмотр</h1>
                <p className="text-slate-500 mt-2 text-lg">Управление запросами на повышение и бонусы</p>
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('pending')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'pending' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        Ожидающие
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'history' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        История
                    </button>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-slate-900/20 transition-all active:scale-95"
                >
                    <Plus className="w-4 h-4" /> Создать заявку
                </button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-4">
                {filteredRequests.length === 0 && (
                    <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        Список заявок пуст
                    </div>
                )}
                {filteredRequests.map(req => (
                    <div key={req.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden">
                        {/* Status Stripe */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${req.status === 'pending' ? 'bg-yellow-400' :
                            req.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'
                            }`} />

                        <div className="flex flex-col md:flex-row justify-between gap-6 pl-4">
                            <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${req.type === 'raise' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                        }`}>
                                        {req.type === 'raise' ? 'Повышение' : 'Бонус'}
                                    </span>
                                    <span className="text-slate-400 text-xs flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {req.created_at}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    {/* Requester */}
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Инициатор</div>
                                        <div className="font-bold text-slate-900">{req.requester_details.name}</div>
                                        <div className="text-xs text-slate-500">{req.requester_details.position}</div>
                                        <div className="text-xs text-slate-400 mt-1">{req.requester_details.branch}, {req.requester_details.department}</div>
                                    </div>

                                    {/* Target Employee */}
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Кому</div>
                                        <div className="font-bold text-slate-900">{req.employee_details.name}</div>
                                        <div className="text-xs text-slate-500">{req.employee_details.position}</div>
                                        <div className="text-xs text-slate-400 mt-1">{req.employee_details.branch}, {req.employee_details.department}</div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <p className="text-sm text-slate-600 italic">"{req.reason}"</p>
                                </div>
                            </div>

                            <div className="flex flex-col items-end justify-start gap-4">
                                <div className="flex flex-col items-end gap-1 min-w-[150px]">
                                    <div className="text-xs text-slate-400 uppercase font-bold">Текущая ЗП</div>
                                    <div className="text-slate-600 font-mono">{formatMoney(req.current_value)}</div>

                                    <div className="flex items-center gap-2 text-emerald-600 mt-1">
                                        <ArrowUpRight className="w-4 h-4" />
                                        <span className="font-bold text-lg">{formatMoney(req.requested_value)}</span>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        {req.type === 'raise' ?
                                            `+${formatMoney(req.requested_value - req.current_value)}` :
                                            'разовый бонус'}
                                    </div>
                                </div>

                                {/* Actions */}
                                {req.status === 'pending' && canManage && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleStatus(req.id, 'approved')}
                                            className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Одобрить"
                                        >
                                            <Check className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleStatus(req.id, 'rejected')}
                                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Отклонить"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                                {req.status !== 'pending' && (
                                    <div className="flex flex-col items-end gap-2 min-w-[150px]">
                                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {req.status === 'approved' ? 'Одобрено' : 'Отклонено'}
                                        </span>
                                        {req.approver_details && (
                                            <div className="text-right mt-1">
                                                <div className="text-[10px] uppercase font-bold text-slate-400">Кем обработано</div>
                                                <div className="text-xs font-bold text-slate-700">{req.approver_details.name}</div>
                                                <div className="text-[10px] text-slate-500">{req.approver_details.position}</div>
                                                <div className="text-[10px] text-slate-400">{req.approver_details.date}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900">Новая заявка</h2>
                            <button onClick={() => setIsModalOpen(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors">
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
                </div>
            )}
        </div>
    );
}
