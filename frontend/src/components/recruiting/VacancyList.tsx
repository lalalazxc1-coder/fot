import React from 'react';
import { Plus, MapPin, Users, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';
import { Vacancy } from '../../types/recruiting';
import { Button } from '../ui-mocks';

interface VacancyListProps {
    vacancies: Vacancy[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    onNewVacancy?: () => void;
    collapsed?: boolean;
    onToggleCollapsed?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
    'Draft': 'Черновик',
    'Open': 'Открыта',
    'In Progress': 'В работе',
    'Closed': 'Закрыта',
    'Cancelled': 'Отменена',
};

const statusDots: Record<string, string> = {
    'Draft': 'bg-slate-400',
    'Open': 'bg-blue-500',
    'In Progress': 'bg-amber-500 animate-pulse',
    'Closed': 'bg-emerald-500',
    'Cancelled': 'bg-red-400',
};

const statusText: Record<string, string> = {
    'Draft': 'text-slate-600',
    'Open': 'text-blue-700',
    'In Progress': 'text-amber-700',
    'Closed': 'text-emerald-700',
    'Cancelled': 'text-red-600',
};

const getVacancyBadgeLabel = (vacancy: Vacancy): string => {
    const source = (vacancy.position_name || vacancy.title || '').trim();
    if (!source) return '•';

    const words = source.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
};

export const VacancyList: React.FC<VacancyListProps> = ({
    vacancies,
    selectedId,
    onSelect,
    onNewVacancy,
    collapsed = false,
    onToggleCollapsed,
}) => {
    return (
        <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className={`shrink-0 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 ${collapsed ? 'px-2 py-2' : 'px-3 py-2.5'}`}>
                <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                        <Briefcase className="w-4 h-4" />
                    </div>
                    {!collapsed && (
                        <div>
                            <h2 className="text-sm font-bold text-slate-800">Заявки в работе</h2>
                            <p className="text-[10px] text-slate-500 font-medium">{vacancies.length} заявок</p>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {onNewVacancy && (
                        collapsed ? (
                            <button
                                onClick={onNewVacancy}
                                className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
                                title="Создать заявку"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <Button onClick={onNewVacancy} className="h-7 px-2.5 gap-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm">
                                <Plus className="w-3.5 h-3.5" />
                                Создать
                            </Button>
                        )
                    )}
                    {onToggleCollapsed && (
                        <button
                            onClick={onToggleCollapsed}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors"
                            title={collapsed ? 'Развернуть список заявок' : 'Свернуть список заявок'}
                        >
                            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar ${collapsed ? 'py-2 px-1.5' : 'py-1'}`}>
                {vacancies.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center text-slate-400 ${collapsed ? 'h-20' : 'h-32'}`}>
                        <Briefcase className={`${collapsed ? 'w-6 h-6 mb-1 opacity-25' : 'w-8 h-8 mb-2 opacity-20'}`} />
                        {!collapsed && <p className="text-sm">Нет вакансий</p>}
                    </div>
                ) : collapsed ? (
                    <div className="flex flex-col items-center gap-2">
                        {vacancies.map((vacancy) => {
                            const isSelected = selectedId === vacancy.id;
                            const statusLabel = STATUS_LABELS[vacancy.status] || vacancy.status;
                            return (
                                <button
                                    key={vacancy.id}
                                    onClick={() => onSelect(isSelected ? null : vacancy.id)}
                                    title={`${vacancy.title} (${statusLabel})`}
                                    className={`relative w-11 h-11 rounded-xl border transition-all shadow-sm ${isSelected
                                            ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-500/20'
                                            : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                        }`}
                                >
                                    <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${statusDots[vacancy.status] || 'bg-slate-400'}`} />
                                    <span className={`text-[11px] font-bold ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>
                                        {getVacancyBadgeLabel(vacancy)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    vacancies.map((vacancy) => {
                        const isSelected = selectedId === vacancy.id;
                        return (
                            <div
                                key={vacancy.id}
                                onClick={() => onSelect(isSelected ? null : vacancy.id)}
                                className={`mx-2 my-1 px-3 py-2.5 rounded-lg border transition-all cursor-pointer group ${isSelected
                                        ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-500/20'
                                        : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-sm hover:bg-slate-50/80'
                                    }`}
                            >
                                {/* Title + status dot */}
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <h3 className={`font-semibold text-sm flex-1 leading-tight ${isSelected ? 'text-blue-900' : 'text-slate-800 group-hover:text-blue-700'}`}>
                                        {vacancy.title}
                                    </h3>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className={`w-1.5 h-1.5 rounded-full ${statusDots[vacancy.status] || 'bg-slate-400'}`} />
                                        <span className={`text-[10px] font-semibold ${statusText[vacancy.status] || 'text-slate-600'}`}>
                                            {STATUS_LABELS[vacancy.status] || vacancy.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Meta row */}
                                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                    {vacancy.position_name && (
                                        <span className="truncate text-slate-500 font-medium">{vacancy.position_name}</span>
                                    )}
                                    {vacancy.location && (
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <MapPin className="w-3 h-3" />
                                            <span>{vacancy.location}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-0.5 ml-auto shrink-0">
                                        <Users className="w-3 h-3" />
                                        <span>{vacancy.planned_count}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
