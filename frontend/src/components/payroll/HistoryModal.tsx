import React from 'react';
import Modal from '../Modal';

interface AuditLog {
    date: string;
    user: string;
    field: string;
    oldVal: string;
    newVal: string;
}

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    logs: AuditLog[];
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
    isOpen,
    onClose,
    logs
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="История изменений">
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar p-1">
                {logs.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">История пуста</p>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="relative pl-6 pb-6 border-l-2 border-slate-100 last:border-0 last:pb-0">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-200 border-2 border-white" />
                            <div className="text-xs text-slate-400 mb-1 font-medium">{log.date}</div>
                            <div className="text-sm">
                                <span className="font-bold text-slate-700">{log.user}</span> изменил поле{' '}
                                <span className="font-bold text-slate-900 border-b border-dashed border-slate-300">
                                    {log.field}
                                </span>
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-sm bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <span className="text-red-400 line-through text-xs">{log.oldVal}</span>
                                <span className="text-slate-300">→</span>
                                <span className="text-emerald-600 font-bold">{log.newVal}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Modal>
    );
};
