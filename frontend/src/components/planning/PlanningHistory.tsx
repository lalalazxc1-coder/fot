import React, { useMemo } from 'react';
import Modal from '../Modal';
import { usePlanningHistory } from '../../hooks/usePlanning';

type PlanningHistoryProps = {
    isOpen: boolean;
    onClose: () => void;
    planId: number;
};

export const PlanningHistory: React.FC<PlanningHistoryProps> = ({ isOpen, onClose, planId }) => {
    const { data: historyLogs, isLoading } = usePlanningHistory(planId, isOpen);

    const logsContent = useMemo(() => {
        if (!historyLogs || historyLogs.length === 0) {
            return <p className="text-slate-400 text-center py-4">{isLoading ? "Загрузка..." : "История пуста"}</p>;
        }

        // Group logs by Date + User
        const grouped = [];
        let last = null;
        for (const log of historyLogs) {
            if (last && last.date === log.date && last.user === log.user) {
                last.changes.push(log);
            } else {
                last = { date: log.date, user: log.user, changes: [log] };
                grouped.push(last);
            }
        }

        return grouped.map((group, i) => {
            const fieldLabels: any = {
                base_net: "Оклад (Net)", base_gross: "Оклад (Gross)",
                kpi_net: "KPI (Net)", kpi_gross: "KPI (Gross)",
                bonus_net: "Доплаты (Net)", bonus_gross: "Доплаты (Gross)",
                "Бонусы (Net)": "Доплаты (Net)", "Бонусы (Gross)": "Доплаты (Gross)",
                position_title: "Должность", count: "Количество",
                branch_id: "Филиал (ID)", department_id: "Отдел (ID)",
                schedule: "График"
            };

            const fieldOrder = [
                "Событие",
                "Должность", "position_title",
                "Филиал (ID)", "branch_id",
                "Отдел (ID)", "department_id",
                "График", "schedule",
                "Количество", "count",
                "Оклад (Net)", "base_net",
                "Оклад (Gross)", "base_gross",
                "KPI (Net)", "kpi_net",
                "KPI (Gross)", "kpi_gross",
                "Доплаты (Net)", "bonus_net", "Бонусы (Net)",
                "Доплаты (Gross)", "bonus_gross", "Бонусы (Gross)"
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

                    <div className="w-20 text-slate-400 text-[10px] text-right pt-1.5 font-mono">{group.date.split(' ')[0]}<br />{group.date.split(' ')[1]}</div>

                    <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="font-bold text-slate-800 text-xs uppercase tracking-wider">{group.user}</div>
                        </div>

                        <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                            {sortedChanges.map((log: any, j: number) => {
                                const label = fieldLabels[log.field] || log.field;
                                return (
                                    <div key={j} className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                                        <span className="text-slate-600 font-medium text-xs">{label}</span>
                                        <div className="flex items-center gap-2 text-xs">
                                            {log.oldVal && <span className="text-red-400 line-through decoration-red-200/50">{log.oldVal}</span>}
                                            {log.oldVal && log.newVal && <span className="text-slate-300 text-[10px]">➜</span>}
                                            {log.newVal && <span className="font-bold text-slate-700 bg-white shadow-sm border border-slate-100 px-1.5 py-0.5 rounded">{log.newVal}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        });
    }, [historyLogs, isLoading]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="История изменений">
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar p-1">
                {logsContent}
            </div>
        </Modal>
    );
};
