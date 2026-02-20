import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Eye, HelpCircle, Calculator } from 'lucide-react';
import { PageHeader } from '../components/shared';
import Modal from '../components/Modal';
import { useRequests, useUpdateRequestStatus } from '../hooks/useRequests';
import { useEmployees } from '../hooks/useEmployees';
import { formatMoney } from '../utils';

// New Components
import { CreateRequestModal } from './requests/CreateRequestModal';
import { RequestDetailsModal } from './requests/RequestDetailsModal';

export default function RequestsPage() {
    const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');

    // Hooks
    const [page, setPage] = useState(1);
    const { data: requestsData, isLoading: isRequestsLoading } = useRequests(page, 20, viewMode);
    const requestsList = requestsData?.items || [];
    const totalPages = requestsData?.total_pages || 1;

    const { data: employees = [], isLoading: isEmployeesLoading } = useEmployees();

    const statusMutation = useUpdateRequestStatus();
    const loading = isRequestsLoading || isEmployeesLoading;

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    // Available employees for dropdown (Active only)
    const availableEmployees = employees.filter(e => e.status !== 'Dismissed');

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

    // Lock scroll when any modal is open
    useEffect(() => {
        const anyModalOpen = isModalOpen || !!selectedRequest || isHelpOpen || statusModal.isOpen;
        if (anyModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isModalOpen, selectedRequest, isHelpOpen, statusModal.isOpen]);

    if (loading) return <div className="p-10">Загрузка...</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

            <CreateRequestModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                availableEmployees={availableEmployees}
            />

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
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="leading-relaxed">
                            <span className="font-bold text-slate-900 text-base block mb-1">Центр согласований</span>
                            Система управления изменениями. Здесь менеджеры запрашивают повышение окладов или разовые бонусы, а руководство принимает обоснованные решения.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Процесс (Workflow)</h4>
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">1</div>
                                <div>
                                    <div className="font-bold text-slate-900">Подача запроса</div>
                                    <div className="text-xs">Вы выбираете сотрудника и указываете новую сумму с обоснованием.</div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">2</div>
                                <div>
                                    <div className="font-bold text-slate-900">Цепочка одобрений</div>
                                    <div className="text-xs">Заявка летит по этапам (HR → Finance → CEO). Каждый может оставить комментарий или отклонить.</div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">✓</div>
                                <div>
                                    <div className="font-bold text-slate-900">Автоматическое применение</div>
                                    <div className="text-xs font-medium text-emerald-700">Как только финальный аппрувер нажимает "Одобрить", данные в карточке сотрудника обновляются мгновенно.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <h4 className="font-bold text-blue-900 text-xs uppercase mb-2">Инструменты принятия решений</h4>
                        <p className="text-blue-800 text-xs leading-relaxed">
                            При просмотре заявки система автоматически подтягивает <strong>рыночные данные</strong> по этой должности. Вы сразу видите, находится ли запрос в рамках рынка или выше него.
                        </p>
                    </div>

                    <div className="bg-slate-900 p-4 rounded-xl text-white text-xs shadow-lg">
                        <div className="font-bold mb-1 flex items-center gap-2">
                            <Calculator size={14} className="text-blue-400" />
                            Настройка этапов
                        </div>
                        <div>
                            Администратор может изменить количество шагов и ответственных в разделе <strong>"Настройки цепочки"</strong> в админ-панели.
                        </div>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
