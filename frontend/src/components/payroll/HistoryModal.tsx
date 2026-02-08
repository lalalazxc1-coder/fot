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
                ) : (() => {
                    // Group logs by Date + User
                    const grouped: any[] = [];
                    let last: any = null;
                    for (const log of logs) {
                        if (last && last.date === log.date && last.user === log.user) {
                            last.changes.push(log);
                        } else {
                            last = { date: log.date, user: log.user, changes: [log] };
                            grouped.push(last);
                        }
                    }

                    return grouped.map((group, i) => {
                        const fieldLabels: any = {
                            "Оклад (Net)": "Оклад (Net)",
                            "Оклад (Gross)": "Оклад (Gross)",
                            "KPI (Net)": "KPI (Net)",
                            "KPI (Gross)": "KPI (Gross)",
                            "Бонус (Net)": "Доплаты (Net)",
                            "Бонус (Gross)": "Доплаты (Gross)",
                            "Доплаты (Net)": "Доплаты (Net)",
                            "Доплаты (Gross)": "Доплаты (Gross)",
                            base_net: "Оклад (Net)",
                            base_gross: "Оклад (Gross)",
                            kpi_net: "KPI (Net)",
                            kpi_gross: "KPI (Gross)",
                            bonus_net: "Доплаты (Net)",
                            bonus_gross: "Доплаты (Gross)",
                            "ФИО": "ФИО",
                            "Должность": "Должность",
                            position: "Должность",
                            hire_date: "Дата приема",
                            "Подрезделение (ID)": "Подразделение",
                            "Status": "Статус",
                            "Total Net": "Итого (Net)",
                            "Total Gross": "Итого (Gross)",
                            sync_source: "Источник изменения",
                            created: "Событие"
                        };

                        const fieldOrder = [
                            "created", "Событие",
                            "ФИО",
                            "Должность", "position",
                            "hire_date", "Дата приема",
                            "Подрезделение (ID)", "Подразделение",
                            "Status", "Статус",
                            "Оклад (Net)", "base_net",
                            "Оклад (Gross)", "base_gross",
                            "KPI (Net)", "kpi_net",
                            "KPI (Gross)", "kpi_gross",
                            "Доплаты (Net)", "Бонус (Net)", "bonus_net",
                            "Доплаты (Gross)", "Бонус (Gross)", "bonus_gross",
                            "Total Net", "Итого (Net)",
                            "Total Gross", "Итого (Gross)",
                            "sync_source", "Источник изменения"
                        ];

                        const sortedChanges = [...group.changes].sort((a: any, b: any) => {
                            let idxA = fieldOrder.indexOf(a.field);
                            let idxB = fieldOrder.indexOf(b.field);
                            if (idxA === -1) idxA = 999;
                            if (idxB === -1) idxB = 999;
                            return idxA - idxB;
                        });

                        return (
                            <div key={i} className="flex gap-4 text-sm relative">
                                {/* Timeline line */}
                                {i !== grouped.length - 1 && <div className="absolute left-[88px] top-6 bottom-[-24px] w-px bg-slate-100"></div>}

                                <div className="w-20 text-slate-400 text-[10px] text-right pt-1.5 font-mono">
                                    {group.date.split(' ')[0]}<br />{group.date.split(' ')[1]}
                                </div>

                                <div className="flex-1 pb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="font-bold text-slate-800 text-xs uppercase tracking-wider">{group.user}</div>
                                    </div>

                                    <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                        {sortedChanges.map((log: any, j: number) => {
                                            const label = fieldLabels[log.field] || log.field;

                                            // Transform sync_source value to be user-friendly
                                            let displayNewVal = log.newVal;
                                            let displayOldVal = log.oldVal;

                                            if (log.field === 'sync_source') {
                                                if (displayNewVal && displayNewVal.includes('План (ID:')) {
                                                    displayNewVal = 'Автосинхронизация с ФОТ';
                                                }
                                                if (displayOldVal && displayOldVal.includes('План (ID:')) {
                                                    displayOldVal = 'Автосинхронизация с ФОТ';
                                                }
                                            }

                                            return (
                                                <div key={j} className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                                                    <span className="text-slate-600 font-medium text-xs">{label}</span>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        {displayOldVal && <span className="text-red-400 line-through decoration-red-200/50">{displayOldVal}</span>}
                                                        {displayOldVal && displayNewVal && <span className="text-slate-300 text-[10px]">➜</span>}
                                                        {displayNewVal && <span className="font-bold text-slate-700 bg-white shadow-sm border border-slate-100 px-1.5 py-0.5 rounded">{displayNewVal}</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    });
                })()}
            </div>
        </Modal>
    );
};
