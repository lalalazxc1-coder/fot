import { useState } from 'react';
import { useAuditLogs } from '../../hooks/useAdmin';
import { Loader2, Activity, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import Modal from '../../components/Modal';

export default function LogsPage() {
    const [page, setPage] = useState(1);
    const limit = 50;
    const { data: logsData, isLoading, error } = useAuditLogs(page, limit);
    const [selectedLog, setSelectedLog] = useState<any>(null);

    if (isLoading) return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
    );

    if (error || !logsData) return <div className="p-8 text-center text-red-500">Ошибка загрузки логов</div>;

    const formatJSON = (data: any) => {
        if (!data || Object.keys(data).length === 0) return <span className="text-slate-400 italic">Нет данных</span>;
        return (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2 overflow-x-auto text-[13px] font-mono text-slate-700 whitespace-pre-wrap">
                {JSON.stringify(data, null, 2)}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                    <Activity className="w-5 h-5" />
                    Расширенные логи
                </h2>
                <div className="text-sm text-slate-500">
                    Всего записей: <span className="font-bold text-slate-900">{logsData.total}</span>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">Время</th>
                                <th className="px-4 py-3">Пользователь</th>
                                <th className="px-4 py-3">Объект</th>
                                <th className="px-4 py-3">Изменения</th>
                                <th className="px-4 py-3 text-right">Детали</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logsData.logs.map((log: any) => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                                    <td className="px-4 py-3 font-medium text-slate-900">{log.user}</td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                                            {log.entity}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">
                                        {log.new_values && log.new_values.note
                                            ? log.new_values.note
                                            : Object.keys(log.new_values || {}).join(', ') || 'Действие'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => setSelectedLog(log)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {logsData.logs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">Логи отсутствуют</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {logsData.total_pages > 1 && (
                    <div className="p-4 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-sm text-slate-500">
                            Страница {page} из {logsData.total_pages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(logsData.total_pages, p + 1))}
                                disabled={page === logsData.total_pages}
                                className="p-2 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Log Details Modal */}
            <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Детали лога">
                {selectedLog && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div>
                                <span className="block text-xs text-slate-400 font-bold uppercase mb-1">Пользователь</span>
                                <span className="font-medium text-slate-900">{selectedLog.user}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-slate-400 font-bold uppercase mb-1">Дата и время</span>
                                <span className="font-mono text-slate-700">{selectedLog.timestamp}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-slate-400 font-bold uppercase mb-1">Сущность</span>
                                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600">
                                    {selectedLog.entity} (ID: {selectedLog.target_entity_id})
                                </span>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm text-slate-800 mb-2">Старые значения</h4>
                            {formatJSON(selectedLog.old_values)}
                        </div>

                        <div>
                            <h4 className="font-bold text-sm text-slate-800 mb-2">Новые значения (Изменения)</h4>
                            {formatJSON(selectedLog.new_values)}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
