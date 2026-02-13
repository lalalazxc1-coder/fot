import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
// import { useOutletContext } from 'react-router-dom';
import { Plus, X, Clock, ArrowUpRight, Eye, HelpCircle } from 'lucide-react';
import { PageHeader } from '../components/shared';
import Modal from '../components/Modal';
import { useRequests, useCreateRequest, useUpdateRequestStatus, useRequestAnalytics } from '../hooks/useRequests';
import { useEmployees } from '../hooks/useEmployees';
import { formatMoney } from '../utils';

export const RequestAnalytics = ({ reqId }: { reqId: number }) => {
    const { data, isLoading } = useRequestAnalytics(reqId, true);

    if (isLoading) return <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded animate-pulse">Загрузка аналитики...</div>;
    if (!data) return <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded">Нет данных</div>;

    return (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
            {/* Market */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-slate-400 uppercase font-bold text-[10px] mb-2 tracking-wider">Рынок (Топ-3)</div>
                {data.market ? (
                    <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-baseline">
                            <span className="text-slate-500">Мин:</span>
                            <span className="font-mono text-slate-700">{formatMoney(data.market.min)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                            <span className="text-slate-500">Макс:</span>
                            <span className="font-mono text-slate-700">{formatMoney(data.market.max)}</span>
                        </div>
                        <div className="flex justify-between items-baseline font-bold text-slate-900 border-t border-slate-200 pt-1 mt-1">
                            <span>Медиана:</span>
                            <span className="font-mono">{formatMoney(data.market.median)}</span>
                        </div>
                    </div>
                ) : <div className="text-slate-400 italic text-xs">Нет данных</div>}
            </div>

            {/* Internal */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-slate-400 uppercase font-bold text-[10px] mb-2 tracking-wider">Филиал (Ср. ЗП)</div>
                {data.internal ? (
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="font-bold text-slate-800 text-sm">{formatMoney(data.internal.avg_total_net)}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">похожие позиции</div>
                        </div>
                        <div className="text-xs font-mono bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">
                            {data.internal.count} сотр.
                        </div>
                    </div>
                ) : <div className="text-slate-400 italic text-xs">Нет данных</div>}
            </div>

            {/* Budget */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-slate-400 uppercase font-bold text-[10px] mb-2 tracking-wider">Бюджет Отдела</div>
                {data.budget ? (
                    <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-baseline">
                            <span className="text-slate-500">План:</span>
                            <span className="font-mono text-slate-700">{formatMoney(data.budget.plan)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                            <span className="text-slate-500">Факт:</span>
                            <span className="font-mono text-slate-700">{formatMoney(data.budget.fact)}</span>
                        </div>
                        <div className={`flex justify-between items-baseline font-bold border-t border-slate-200 pt-1 mt-1 ${data.budget.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            <span>Остаток:</span>
                            <span className="font-mono">{data.budget.balance > 0 ? '+' : ''}{formatMoney(data.budget.balance)}</span>
                        </div>
                    </div>
                ) : <div className="text-slate-400 italic text-xs">Нет данных</div>}
            </div>
        </div>
    );
};



const RequestDetailsModal = ({ req, isOpen, onClose, onAction }: { req: any | null, isOpen: boolean, onClose: () => void, onAction: (id: number, type: 'approved' | 'rejected') => void }) => {
    if (!isOpen || !req) return null;

    const isRaise = req.type === 'raise';

    const diff = req.requested_value - req.current_value;

    return createPortal(
        <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col md:flex-row overflow-hidden" onClick={e => e.stopPropagation()}>

                {/* Left Panel: Request Info */}
                <div className="flex-1 p-8 overflow-y-auto">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                    req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                    {req.status === 'pending' ? 'Ожидает' : req.status === 'approved' ? 'Согласовано' : 'Отклонено'}
                                </span>
                                <span className="text-slate-400 text-xs">#{req.id}</span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900">{req.employee_details.name}</h2>
                            <p className="text-slate-500">{req.employee_details.position} • {req.employee_details.department || req.employee_details.branch}</p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {/* Financial Card */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Тип запроса</div>
                                    <div className="font-medium text-slate-700">{isRaise ? 'Повышение оклада' : 'Разовый бонус'}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">{isRaise ? 'Прирост' : 'Сумма'}</div>
                                    <div className={`text-xl font-bold ${isRaise ? 'text-emerald-600' : 'text-purple-600'}`}>
                                        +{formatMoney(isRaise ? diff : req.requested_value)}
                                    </div>
                                </div>
                            </div>

                            {isRaise && (
                                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                                    <div>
                                        <div className="text-xs text-slate-400 mb-0.5">Текущий оклад</div>
                                        <div className="font-mono text-slate-600">{formatMoney(req.current_value)}</div>
                                    </div>
                                    <ArrowUpRight className="w-5 h-5 text-slate-300" />
                                    <div className="text-right">
                                        <div className="text-xs text-slate-400 mb-0.5">Новый оклад</div>
                                        <div className="font-mono text-slate-900 font-bold">{formatMoney(req.requested_value)}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Reason */}
                        <div>
                            <h3 className="font-bold text-slate-900 mb-2">Обоснование</h3>
                            <div className="text-slate-600 text-sm leading-relaxed bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                {req.reason}
                            </div>
                        </div>

                        {/* History Timeline */}
                        <div>
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" /> История согласований
                            </h3>
                            <div className="space-y-4 pl-2 border-l-2 border-slate-100 ml-2">
                                {req.history.map((h: any) => (
                                    <div key={h.id} className="relative pl-6 pb-2">
                                        <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${h.action === 'approved' ? 'bg-emerald-500' :
                                            h.action === 'rejected' ? 'bg-red-500' : 'bg-slate-300'
                                            }`} />
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-slate-500">{h.created_at}</span>
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${h.action === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                                                    h.action === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {h.action}
                                                </span>
                                            </div>
                                            <div className="text-sm font-medium text-slate-900">
                                                {h.actor_name || 'System'}
                                            </div>
                                            {h.actor_role && <div className="text-xs text-slate-500">{h.actor_role}</div>}
                                            {h.comment && h.comment !== 'Created request' && (
                                                <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                                                    "{h.comment}"
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Analytics & Actions */}
                <div className="md:w-96 bg-slate-50 border-l border-slate-200 flex flex-col h-full overflow-hidden">
                    <div className="p-6 border-b border-slate-200 bg-white">
                        <div className="flex items-center gap-2 font-bold text-slate-700">
                            <Eye className="w-4 h-4" /> Аналитика
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <RequestAnalytics reqId={req.id} />
                    </div>

                    {/* Quick Actions Footer (Sticky) */}
                    <div className="p-6 bg-white border-t border-slate-200 space-y-3">
                        {req.can_approve && req.status === 'pending' && (
                            <div className={`grid gap-3 ${req.is_final ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                {!req.is_final && (
                                    <button
                                        onClick={() => onAction(req.id, 'rejected')}
                                        className="px-4 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold border border-red-100 transition-colors"
                                    >
                                        Отклонить
                                    </button>
                                )}
                                <button
                                    onClick={() => onAction(req.id, 'approved')}
                                    className={`px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 ${req.is_final ? 'w-full' : ''}`}
                                >
                                    {req.is_final ? 'Утвердить' : 'Согласовать'}
                                </button>
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition-colors"
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default function RequestsPage() {
    // const { user } = useOutletContext<{ user: any }>();


    const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');

    // Hooks
    const [page, setPage] = useState(1);
    const { data: requestsData, isLoading: isRequestsLoading } = useRequests(page, 20, viewMode);
    const requestsList = requestsData?.items || []; // Handle usage
    const totalPages = requestsData?.total_pages || 1;

    const { data: employees = [], isLoading: isEmployeesLoading } = useEmployees();

    const createMutation = useCreateRequest();
    const statusMutation = useUpdateRequestStatus();

    const loading = isRequestsLoading || isEmployeesLoading;

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);


    // Available employees for dropdown (Active only)
    const availableEmployees = employees.filter(e => e.status !== 'Dismissed');

    // Form State
    const [formData, setFormData] = useState({
        employee_id: '',
        type: 'raise',
        increase_amount: '',
        reason: ''
    });

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

        setIsModalOpen(false);
        setFormData({ employee_id: '', type: 'raise', increase_amount: '', reason: '' });
    };

    // Status Modal State
    const [statusModal, setStatusModal] = useState<{ isOpen: boolean, type: 'approved' | 'rejected', reqId: number | null }>({
        isOpen: false,
        type: 'approved',
        reqId: null
    });
    const [statusComment, setStatusComment] = useState("");

    const handleStatus = (id: number, status: 'approved' | 'rejected') => {
        if (status === 'approved' && selectedRequest?.is_final) {
            statusMutation.mutate({
                id,
                status: 'approved',
                comment: ''
            });
            setSelectedRequest(null);
            return;
        }
        setStatusModal({ isOpen: true, type: status, reqId: id });
        setStatusComment("");
    };

    const confirmStatusUpdate = async () => {
        if (statusModal.reqId) {
            await statusMutation.mutateAsync({
                id: statusModal.reqId,
                status: statusModal.type,
                comment: statusComment
            });
            setStatusModal({ ...statusModal, isOpen: false });
        }
    };

    // Backend filtering active
    const filteredRequests = requestsList;

    // Reset page when viewMode changes
    useEffect(() => {
        setPage(1);
    }, [viewMode]);




    if (loading) return <div className="p-10">Загрузка...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <PageHeader
                title="Заявки на пересмотр"
                subtitle="Управление запросами на повышение и бонусы"
                extra={
                    <button
                        onClick={() => setIsHelpOpen(true)}
                        className="mt-2 flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors text-sm font-medium"
                    >
                        <HelpCircle className="w-5 h-5" />
                        Как это работает?
                    </button>
                }
            >
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-slate-900/20 transition-all active:scale-95 whitespace-nowrap"
                >
                    <Plus className="w-4 h-4" /> Создать заявку
                </button>
            </PageHeader>

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
            </div>

            {/* List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-xs">
                        <tr>
                            <th className="px-6 py-4 font-bold">Сотрудник</th>
                            <th className="px-6 py-4 font-bold">Филиал</th>
                            <th className="px-6 py-4 font-bold">Тип</th>
                            <th className="px-6 py-4 font-bold text-right">Сумма</th>
                            <th className="px-6 py-4 font-bold">Статус</th>
                            <th className="px-6 py-4 font-bold">Этап</th>
                            <th className="px-4 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredRequests.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                                    Список заявок пуст
                                </td>
                            </tr>
                        )}
                        {filteredRequests.map(req => {
                            const isRaise = req.type === 'raise';
                            const diff = req.requested_value - req.current_value;
                            return (
                                <tr
                                    key={req.id}
                                    onClick={() => setSelectedRequest(req)}
                                    className="group hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{req.employee_details.name}</div>
                                        <div className="text-xs text-slate-500">{req.employee_details.position}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-600">{req.employee_details.branch}</div>
                                        <div className="text-xs text-slate-400">{req.employee_details.department}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${isRaise ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                            {isRaise ? 'Повышение' : 'Бонус'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={`font-mono font-bold ${isRaise ? 'text-slate-900' : 'text-slate-900'}`}>
                                            {formatMoney(isRaise ? req.requested_value : req.requested_value)}
                                        </div>
                                        {isRaise && (
                                            <div className="text-xs text-emerald-600 font-mono font-bold">
                                                +{formatMoney(diff)}
                                            </div>
                                        )}
                                        {!isRaise && (
                                            <div className="text-xs text-purple-600 font-mono font-bold">
                                                бонус
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                            req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {req.status === 'pending' ? 'Ожидает' : req.status === 'approved' ? 'Принято' : 'Отказ'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-600 font-medium text-xs">{req.current_step_label}</div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors inline-block">
                                            <Eye className="w-4 h-4" />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <RequestDetailsModal
                req={selectedRequest}
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
                onAction={(id, type) => {
                    handleStatus(id, type);
                    setSelectedRequest(null);
                }}
            />

            {/* Create Modal */}
            {
                isModalOpen && createPortal(
                    <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
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
                    </div>,
                    document.body
                )
            }



            {/* Pagination Controls */}
            {
                totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-8 pb-8">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                        >
                            Назад
                        </button>
                        <span className="text-sm text-slate-600">
                            Страница <span className="font-bold text-slate-900">{page}</span> из <span className="font-bold text-slate-900">{totalPages}</span>
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                        >
                            Вперед
                        </button>
                    </div>
                )
            }

            {/* Status Confirmation Modal */}
            {
                statusModal.isOpen && createPortal(
                    <div className="fixed inset-0 z-[60000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setStatusModal({ ...statusModal, isOpen: false })}>
                        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

                            <h3 className={`text-lg font-bold mb-2 ${statusModal.type === 'approved' ? 'text-emerald-700' : 'text-red-700'}`}>
                                {statusModal.type === 'approved' ?
                                    (selectedRequest?.is_final ? 'Утверждение заявки' : 'Согласование заявки')
                                    : 'Отклонение заявки'}
                            </h3>
                            <p className="text-sm text-slate-600 mb-4">
                                {statusModal.type === 'approved'
                                    ? `Вы уверены, что хотите ${selectedRequest?.is_final ? 'утвердить' : 'согласовать'} эту заявку? Вы можете добавить комментарий.`
                                    : 'Укажите причину отказа. Это обязательное поле.'}
                            </p>

                            <textarea
                                value={statusComment}
                                onChange={(e) => setStatusComment(e.target.value)}
                                placeholder={statusModal.type === 'approved' ? "Комментарий (необязательно)" : "Причина отказа..."}
                                className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[100px] mb-4"
                                onClick={e => e.stopPropagation()}
                            />

                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setStatusModal({ ...statusModal, isOpen: false })}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={confirmStatusUpdate}
                                    disabled={statusModal.type === 'rejected' && !statusComment.trim()}
                                    className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                                    ${statusModal.type === 'approved' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : 'bg-red-600 hover:bg-red-500 shadow-red-500/20'}
                                `}
                                >
                                    {statusModal.type === 'approved' ? 'Согласовать' : 'Отклонить'}
                                </button>
                            </div>

                        </div>
                    </div>,
                    document.body
                )
            }

            {/* Help Modal */}
            <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Как работают заявки?">
                <div className="space-y-6 text-sm text-slate-600">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="mb-2">
                            <span className="font-bold text-slate-900">Система заявок</span> позволяет управлять запросами на повышение зарплаты и бонусы.
                        </p>
                        <p>
                            Каждая заявка проходит многоуровневое согласование в соответствии с настроенным Workflow.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-900">Основные этапы</h4>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>
                                <span className="font-medium text-slate-900">1. Создание:</span> Менеджер создает заявку на повышение или бонус с обоснованием.
                            </li>
                            <li>
                                <span className="font-medium text-slate-900">2. Согласование:</span> Заявка проходит через несколько уровней: Руководитель филиала → HR → Директор.
                            </li>
                            <li>
                                <span className="font-medium text-slate-900">3. Утверждение:</span> После одобрения на всех этапах, изменения автоматически применяются к финансовым данным сотрудника.
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-900">Типы заявок</h4>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-start gap-3">
                                <div className="w-3 h-3 rounded-full bg-blue-500 mt-1"></div>
                                <div>
                                    <span className="font-bold text-blue-600">Повышение:</span> Постоянное увеличение оклада. Изменения сохраняются в истории сотрудника.
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-3 h-3 rounded-full bg-purple-500 mt-1"></div>
                                <div>
                                    <span className="font-bold text-purple-600">Бонус:</span> Разовая выплата за достижения. Не влияет на постоянный оклад.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-900">Аналитика</h4>
                        <p>
                            При просмотре заявки автоматически показываются рыночные данные (медиана, мин/макс) и внутренняя статистика по филиалу для обоснованного решения.
                        </p>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl text-blue-800 text-xs">
                        <div className="font-bold mb-1">Совет:</div>
                        <div>
                            Настройте Workflow в разделе Администрирование для настройки этапов согласования под вашу организации.
                        </div>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
