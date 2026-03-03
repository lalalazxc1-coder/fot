import React from 'react';
import { Plus, Building2, MapPin, Users, Briefcase } from 'lucide-react';
import { Vacancy } from '../../types/recruiting';
import { Button } from '../ui-mocks';

interface VacancyListProps {
    vacancies: Vacancy[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    onNewVacancy?: () => void;
}

const statusColors: Record<string, string> = {
    'Draft': 'bg-slate-100 text-slate-700 border-slate-200',
    'Open': 'bg-blue-50 text-blue-700 border-blue-200',
    'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
    'Closed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Cancelled': 'bg-red-50 text-red-700 border-red-200',
};

const priorityColors: Record<string, string> = {
    'Low': 'text-slate-500',
    'Medium': 'text-blue-500',
    'High': 'text-amber-500',
    'Critical': 'text-red-500',
};

export const VacancyList: React.FC<VacancyListProps> = ({ vacancies, selectedId, onSelect, onNewVacancy }) => {
    return (
        <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                        <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Заявки в работе</h2>
                        <p className="text-xs text-slate-500 font-medium">Активные и закрытые ({vacancies.length})</p>
                    </div>
                </div>
                {onNewVacancy && (
                    <Button onClick={onNewVacancy} className="h-9 px-3 gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm">
                        <Plus className="w-4 h-4" />
                        <span>Создать</span>
                    </Button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {vacancies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                        <Briefcase className="w-10 h-10 mb-2 opacity-20" />
                        <p className="text-sm">Нет вакансий</p>
                    </div>
                ) : (
                    vacancies.map((vacancy) => {
                        const isSelected = selectedId === vacancy.id;
                        return (
                            <div
                                key={vacancy.id}
                                onClick={() => onSelect(isSelected ? null : vacancy.id)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer group ${isSelected
                                    ? 'bg-blue-50/50 border-blue-300 shadow-sm ring-1 ring-blue-500/20'
                                    : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-sm hover:bg-slate-50'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className={`font-semibold flex-1 pr-2 truncate ${isSelected ? 'text-blue-900' : 'text-slate-800 group-hover:text-blue-700'}`}>
                                        {vacancy.title}
                                    </h3>
                                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${statusColors[vacancy.status] || statusColors['Draft']}`}>
                                        {vacancy.status}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-500 mt-3">
                                    <div className="flex items-center gap-1.5" title="Подразделение / Код департамента">
                                        <Building2 className="w-3.5 h-3.5 opacity-70" />
                                        <span className="truncate">Деп: {vacancy.department_id}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 justify-end" title="Локация">
                                        <MapPin className="w-3.5 h-3.5 opacity-70" />
                                        <span className="truncate">{vacancy.location || 'Удаленно'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5" title="План найма">
                                        <Users className="w-3.5 h-3.5 opacity-70" />
                                        <span>{vacancy.planned_count} мест</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 justify-end" title="Приоритет">
                                        <span className={`w-2 h-2 rounded-full ${vacancy.priority === 'Critical' ? 'bg-red-500 animate-pulse' : vacancy.priority === 'High' ? 'bg-amber-500' : vacancy.priority === 'Medium' ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                                        <span className={`font-medium ${priorityColors[vacancy.priority] || priorityColors['Medium']}`}>{vacancy.priority}</span>
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
