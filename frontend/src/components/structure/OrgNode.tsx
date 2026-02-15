import { Handle, Position, NodeProps } from 'reactflow';
import { User, Users, Briefcase, X, List } from 'lucide-react';

// Define the data structure passed to the node
export type OrgNodeData = {
    label: string;
    type: 'head_office' | 'branch' | 'department';
    head?: { full_name: string; position: string; salary: number } | null;
    count: number;
    total_salary?: number;  // NEW: Total salary of unit including children
    onAddSub: () => void;
    onSetHead: () => void;
    onRemoveHead: () => void;
    onViewEmployees: () => void;
    onDelete: () => void;
    onEdit: () => void;
    hasChildren?: boolean;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
};

export default function OrgNode({ data, selected }: NodeProps<OrgNodeData>) {
    const isHeadOffice = data.type === 'head_office';
    const isBranch = data.type === 'branch';

    return (
        <div className={`
            min-w-[260px] rounded-lg border-2 bg-white shadow-sm transition-all group relative
            ${selected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'}
        `}>
            {/* Input Handle (Top) - for incoming connections */}
            <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3" />

            {/* Header */}
            <div className={`
                px-4 py-2 border-b border-slate-100 rounded-t-lg flex items-center justify-between
                ${isBranch ? 'bg-slate-50' : 'bg-white'}
            `}>
                <div className="flex items-center gap-2">
                    {isHeadOffice ? (
                        <Briefcase className="w-4 h-4 text-purple-600" />
                    ) : isBranch ? (
                        <Briefcase className="w-4 h-4 text-indigo-600" />
                    ) : (
                        <Users className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="font-semibold text-slate-800 text-sm truncate max-w-[140px]" title={data.label}>
                        {data.label}
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); data.onViewEmployees(); }}
                        className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                        title="Список сотрудников"
                    >
                        {data.count} <List className="w-3 h-3 ml-0.5" />
                    </button>
                    {data.total_salary !== undefined && data.total_salary > 0 && (
                        <div
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"
                            title="Общая сумма зарплат"
                        >
                            {data.total_salary.toLocaleString('ru-RU')} ₸
                        </div>
                    )}
                </div>
            </div>

            {/* Content (Head of Unit) */}
            <div className="p-3">
                {data.head ? (
                    <div className="relative group/head">
                        <div
                            className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors"
                            onClick={data.onSetHead}
                            title="Нажмите, чтобы сменить руководителя"
                        >
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold ring-2 ring-white shrink-0">
                                {data.head.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                            <div className="flex flex-col overflow-hidden text-left">
                                <span className="text-xs font-semibold text-slate-800 truncate max-w-[170px]">
                                    {data.head.full_name}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium truncate max-w-[170px]">
                                    {data.head.position || 'Должность не указана'}
                                </span>
                                {data.head.salary !== undefined && (
                                    <span className="text-[10px] text-emerald-600 font-bold mt-0.5">
                                        {data.head.salary?.toLocaleString('ru-RU')} ₸
                                    </span>
                                )}
                            </div>
                        </div>
                        {selected && (
                            <button
                                onClick={(e) => { e.stopPropagation(); data.onRemoveHead(); }}
                                className="absolute -right-1 -top-1 bg-white rounded-full p-0.5 shadow border border-slate-200 text-slate-400 hover:text-red-500"
                                title="Убрать руководителя"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ) : (
                    <div
                        onClick={data.onSetHead}
                        className="flex items-center gap-2 text-slate-400 cursor-pointer hover:text-indigo-600 transition-colors p-1 rounded hover:bg-slate-50 border border-dashed border-slate-200 justify-center py-2"
                    >
                        <User className="w-4 h-4 opacity-50" />
                        <span className="text-xs">Назначить руководителя</span>
                    </div>
                )}
            </div>

            {/* Actions (Simple Footer for now, or context menu later) */}
            {selected && (
                <div className="px-3 py-2 bg-slate-50 rounded-b-lg border-t border-slate-100 flex justify-end gap-2">
                    <button onClick={(e) => { e.stopPropagation(); data.onAddSub(); }} className="p-1 hover:bg-indigo-100 rounded text-indigo-600" title="Добавить подотдел">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); data.onEdit(); }} className="p-1 hover:bg-blue-100 rounded text-blue-600" title="Изменить">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); data.onDelete(); }} className="p-1 hover:bg-red-100 rounded text-red-600" title="Удалить">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            )}

            {/* Expand/Collapse Button */}
            {data.hasChildren && data.onToggleExpand && (
                <div
                    className="absolute left-1/2 -bottom-3 -translate-x-1/2 z-10 nopan nodrag"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            data.onToggleExpand?.();
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-slate-300 shadow-sm text-slate-500 hover:text-indigo-600 hover:border-indigo-400 transition-colors cursor-pointer"
                        title={data.isExpanded ? "Свернуть" : "Развернуть"}
                    >
                        {data.isExpanded ? (
                            <div className="w-2 h-0.5 bg-current"></div>
                        ) : (
                            <div className="relative w-2 h-2 flex items-center justify-center">
                                <div className="absolute w-2 h-0.5 bg-current"></div>
                                <div className="absolute w-0.5 h-2 bg-current"></div>
                            </div>
                        )}
                    </button>
                </div>
            )}

            {/* Output Handle (Bottom) - for outgoing connections */}
            <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !w-3 !h-3 opacity-0 pointer-events-none" />
        </div>
    );
}
