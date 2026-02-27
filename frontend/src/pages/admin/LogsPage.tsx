import { useState } from 'react';
import { useAuditLogs, useLoginLogs } from '../../hooks/useAdmin';
import {
    Loader2, Activity, ChevronLeft, ChevronRight, Eye,
    LogIn, LogOut, Shield, Monitor, Smartphone, Tablet,
    Globe, User, AlertTriangle, Filter, Clock
} from 'lucide-react';
import Modal from '../../components/Modal';

// --- Helpers ---
const PAGE_LIMIT = 50;

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
    if (totalPages <= 1) return null;
    return (
        <div className="p-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-sm text-slate-500">Страница {page} из {totalPages}</span>
            <div className="flex gap-2">
                <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
                    className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                    className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

function formatTimestamp(ts: string | null) {
    if (!ts) return '—';
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return ts;
        return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return ts; }
}

// --- Вкладка: Изменения (AuditLog) ---
function AuditTab() {
    const [page, setPage] = useState(1);
    const [entityFilter, setEntityFilter] = useState('');
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const { data, isLoading } = useAuditLogs(page, PAGE_LIMIT, entityFilter || undefined);

    const entityOptions = [
        { value: '', label: 'Все объекты' },
        { value: 'employee', label: 'Сотрудники' },
        { value: 'planning', label: 'Планирование' },
        { value: 'salary_request', label: 'Заявки' },
        { value: 'salary_config', label: 'Настройки ФОТ' },
        { value: 'users', label: 'Пользователи' },
        { value: 'org_unit', label: 'Структура' },
    ];

    const entityColors: Record<string, string> = {
        'Сотрудник': 'bg-blue-100 text-blue-700',
        'Планирование': 'bg-violet-100 text-violet-700',
        'Заявка': 'bg-amber-100 text-amber-700',
        'Настройки ФОТ': 'bg-orange-100 text-orange-700',
        'Пользователь': 'bg-pink-100 text-pink-700',
        'Структура': 'bg-teal-100 text-teal-700',
    };

    const formatJSON = (data: any) => {
        if (!data || Object.keys(data).length === 0) return <span className="text-slate-400 italic text-sm">Нет данных</span>;
        return (
            <pre className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[12px] font-mono text-slate-700 whitespace-pre-wrap overflow-x-auto max-h-64">
                {JSON.stringify(data, null, 2)}
            </pre>
        );
    };

    return (
        <div className="space-y-4">
            {/* Фильтр */}
            <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-slate-400" />
                <div className="flex gap-2 flex-wrap">
                    {entityOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { setEntityFilter(opt.value); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${entityFilter === opt.value
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                {data && <span className="ml-auto text-sm text-slate-400">Всего: {data.total}</span>}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="sticky top-0 z-20 backdrop-blur-md bg-white/85 text-slate-500 font-bold uppercase text-[10px] tracking-wider after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-slate-200/80 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 whitespace-nowrap">Время</th>
                                    <th className="px-4 py-3">Пользователь</th>
                                    <th className="px-4 py-3">Объект</th>
                                    <th className="px-4 py-3">IP</th>
                                    <th className="px-4 py-3">Изменения</th>
                                    <th className="px-4 py-3 text-right">Детали</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data?.logs.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-4 py-3 font-mono text-slate-500 text-xs whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3 h-3" />
                                                {formatTimestamp(log.timestamp)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                                    <User className="w-3.5 h-3.5 text-slate-500" />
                                                </div>
                                                <span className="font-medium text-slate-800 text-sm">{log.user}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase ${entityColors[log.entity] || 'bg-slate-100 text-slate-600'}`}>
                                                {log.entity}
                                                {log.target_entity_id ? ` #${log.target_entity_id}` : ''}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                                            {log.ip_address || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-sm max-w-[200px] truncate">
                                            {log.new_values?.note || log.new_values?.Событие
                                                || Object.keys(log.new_values || {}).slice(0, 3).join(', ')
                                                || 'Действие'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => setSelectedLog(log)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {(!data?.logs.length) && (
                                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 italic">Логи отсутствуют</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pagination page={page} totalPages={data?.total_pages || 1} onChange={setPage} />
            </div>

            {/* Modal */}
            <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title={`Лог #${selectedLog?.id}`}>
                {selectedLog && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                            <div><span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Пользователь</span><span className="font-semibold text-slate-900">{selectedLog.user}</span></div>
                            <div><span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Время</span><span className="font-mono text-slate-700 text-xs">{formatTimestamp(selectedLog.timestamp)}</span></div>
                            <div><span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Объект</span><span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${entityColors[selectedLog.entity] || 'bg-slate-100 text-slate-600'}`}>{selectedLog.entity} {selectedLog.target_entity_id ? `#${selectedLog.target_entity_id}` : ''}</span></div>
                            <div><span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">IP адрес</span><span className="font-mono text-slate-700 text-xs">{selectedLog.ip_address || '—'}</span></div>
                            {selectedLog.user_agent && (
                                <div className="col-span-2"><span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">User-Agent</span><span className="text-slate-600 text-xs break-all">{selectedLog.user_agent}</span></div>
                            )}
                        </div>
                        <div><h4 className="font-bold text-sm text-slate-800 mb-2">Было (старые значения)</h4>{formatJSON(selectedLog.old_values)}</div>
                        <div><h4 className="font-bold text-sm text-slate-800 mb-2">Стало (новые значения)</h4>{formatJSON(selectedLog.new_values)}</div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

// --- Вкладка: Сессии (LoginLog) ---
function DeviceIcon({ device }: { device: string }) {
    if (device === 'Mobile') return <Smartphone className="w-4 h-4 text-slate-500" />;
    if (device === 'Tablet') return <Tablet className="w-4 h-4 text-slate-500" />;
    return <Monitor className="w-4 h-4 text-slate-500" />;
}

function ActionBadge({ label, color }: { label: string; color: string }) {
    const colorMap: Record<string, string> = {
        green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        red: 'bg-red-100 text-red-700 border-red-200',
        orange: 'bg-amber-100 text-amber-700 border-amber-200',
        slate: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    const icons: Record<string, JSX.Element> = {
        green: <LogIn className="w-3 h-3" />,
        red: <AlertTriangle className="w-3 h-3" />,
        orange: <Shield className="w-3 h-3" />,
        slate: <LogOut className="w-3 h-3" />,
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold border ${colorMap[color] || colorMap.slate}`}>
            {icons[color]} {label}
        </span>
    );
}

function SessionsTab() {
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState('');
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const { data, isLoading } = useLoginLogs(page, PAGE_LIMIT, actionFilter || undefined);

    const actionOptions = [
        { value: '', label: 'Все события' },
        { value: 'login_success', label: 'Успешные входы' },
        { value: 'login_failed', label: 'Неудачные попытки' },
        { value: 'login_blocked', label: 'Заблокированные' },
        { value: 'logout', label: 'Выходы' },
    ];

    // Подсчёт по типам
    const counts = data?.logs.reduce((acc: Record<string, number>, log: any) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="space-y-4">
            {/* Статистика */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { key: 'login_success', label: 'Успешных входов', color: 'emerald', icon: <LogIn className="w-4 h-4" /> },
                    { key: 'login_failed', label: 'Неудачных попыток', color: 'red', icon: <AlertTriangle className="w-4 h-4" /> },
                    { key: 'login_blocked', label: 'Заблокировано', color: 'amber', icon: <Shield className="w-4 h-4" /> },
                    { key: 'logout', label: 'Выходов', color: 'slate', icon: <LogOut className="w-4 h-4" /> },
                ].map(stat => (
                    <div key={stat.key} className={`bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3`}>
                        <div className={`w-9 h-9 rounded-xl bg-${stat.color}-100 flex items-center justify-center text-${stat.color}-600 flex-shrink-0`}>
                            {stat.icon}
                        </div>
                        <div>
                            <p className="text-xl font-bold text-slate-900">{counts?.[stat.key] || 0}</p>
                            <p className="text-[10px] text-slate-500 font-medium leading-tight">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Фильтр */}
            <div className="flex items-center gap-3 flex-wrap">
                <Filter className="w-4 h-4 text-slate-400" />
                {actionOptions.map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => { setActionFilter(opt.value); setPage(1); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${actionFilter === opt.value
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
                {data && <span className="ml-auto text-sm text-slate-400">Всего: {data.total}</span>}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="sticky top-0 z-20 backdrop-blur-md bg-white/85 text-slate-500 font-bold uppercase text-[10px] tracking-wider after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-slate-200/80 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 whitespace-nowrap">Время</th>
                                    <th className="px-4 py-3">Пользователь</th>
                                    <th className="px-4 py-3">Событие</th>
                                    <th className="px-4 py-3">IP адрес</th>
                                    <th className="px-4 py-3">Устройство</th>
                                    <th className="px-4 py-3">Браузер / ОС</th>
                                    <th className="px-4 py-3 text-right">Детали</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data?.logs.map((log: any) => (
                                    <tr key={log.id} className={`hover:bg-slate-50/60 transition-colors ${log.action === 'login_failed' ? 'bg-red-50/30' : ''}`}>
                                        <td className="px-4 py-3 font-mono text-slate-500 text-xs whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3 h-3" />
                                                {formatTimestamp(log.timestamp)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                                    <User className="w-3.5 h-3.5 text-slate-500" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-800 text-sm leading-tight">{log.user}</p>
                                                    {log.user_email && log.user !== log.user_email &&
                                                        <p className="text-[11px] text-slate-400">{log.user_email}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <ActionBadge label={log.action_label} color={log.action_color} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-slate-600 text-xs font-mono">
                                                <Globe className="w-3.5 h-3.5 text-slate-400" />
                                                {log.ip_address}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                                                <DeviceIcon device={log.device} />
                                                {log.device}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600">
                                            <span className="font-medium">{log.browser}</span>
                                            <span className="text-slate-400"> / {log.os}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => setSelectedLog(log)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {(!data?.logs.length) && (
                                    <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400 italic">Логов входов нет</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pagination page={page} totalPages={data?.total_pages || 1} onChange={setPage} />
            </div>

            {/* Modal */}
            <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Детали события">
                {selectedLog && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                            <div><span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Пользователь</span><p className="font-semibold text-slate-900">{selectedLog.user}</p>{selectedLog.user_email && <p className="text-xs text-slate-500">{selectedLog.user_email}</p>}</div>
                            <div><span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Событие</span><ActionBadge label={selectedLog.action_label} color={selectedLog.action_color} /></div>
                            <div><span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Время</span><span className="font-mono text-slate-700 text-xs">{formatTimestamp(selectedLog.timestamp)}</span></div>
                            <div><span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">IP адрес</span><span className="font-mono text-slate-700 text-xs">{selectedLog.ip_address}</span></div>
                            <div><span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Устройство</span><p className="text-slate-700">{selectedLog.device}</p></div>
                            <div><span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Браузер / ОС</span><p className="text-slate-700">{selectedLog.browser} / {selectedLog.os}</p></div>
                            {selectedLog.user_agent_full && (
                                <div className="col-span-2">
                                    <span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Полный User-Agent</span>
                                    <p className="text-xs text-slate-500 break-all font-mono bg-white border border-slate-200 p-2 rounded-lg">{selectedLog.user_agent_full}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

// --- Main Component ---
export default function LogsPage() {
    const [activeTab, setActiveTab] = useState<'audit' | 'sessions'>('audit');

    const tabs = [
        { id: 'audit', label: 'Журнал изменений', icon: <Activity className="w-4 h-4" /> },
        { id: 'sessions', label: 'Сессии и входы', icon: <LogIn className="w-4 h-4" /> },
    ] as const;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-slate-600" />
                    Расширенные логи
                </h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'audit' && <AuditTab />}
            {activeTab === 'sessions' && <SessionsTab />}
        </div>
    );
}
