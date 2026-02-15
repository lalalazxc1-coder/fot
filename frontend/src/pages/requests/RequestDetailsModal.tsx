
import { createPortal } from 'react-dom';
import { Clock, ArrowUpRight, Eye } from 'lucide-react';
import { formatMoney } from '../../utils';
import { RequestAnalytics } from './RequestAnalytics';

interface RequestDetailsModalProps {
    req: any | null;
    isOpen: boolean;
    onClose: () => void;
    onAction: (id: number, type: 'approved' | 'rejected') => void;
}

export const RequestDetailsModal = ({ req, isOpen, onClose, onAction }: RequestDetailsModalProps) => {
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
