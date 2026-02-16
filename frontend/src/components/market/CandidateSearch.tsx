import { useState } from 'react';
import { Search, MapPin, Briefcase, DollarSign, Filter, Sparkles, UserPlus, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';
import { formatMoney } from '../../utils';
import { MOCK_CANDIDATES } from '../../data/mockCandidates';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Link } from 'react-router-dom';

export const CandidateSearch = () => {
    const [search, setSearch] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState<number | null>(null);
    const [analyzedId, setAnalyzedId] = useState<number | null>(null);

    // Check integration status
    const { data: settings, isLoading } = useQuery({
        queryKey: ['integrations'],
        queryFn: async () => {
            const res = await api.get('/integrations/settings');
            return res.data;
        }
    });

    const hhSettings = settings?.find((s: any) => s.service_name === 'hh');
    const isHHActive = hhSettings?.is_active;

    const handleAnalyze = (id: number) => {
        setIsAnalyzing(id);
        // Fake delay or real call if AI active
        setTimeout(() => {
            setIsAnalyzing(null);
            setAnalyzedId(id);
        }, 2000);
    };

    // If active, we ideally search via API. For now, since backend search endpoint isn't ready, 
    // we show an empty "Real" state or a "Simulated Real" state. 
    // User asked "if connected showing what user searches".
    // Let's implement client-side filtering on Mock data IF in demo mode.
    // IF in Real mode -> show empty state "Enter search..." and then nothing found (as backend not ready).

    const showDemo = !isHHActive;

    const filtered = showDemo
        ? MOCK_CANDIDATES.filter(c =>
            c.position.toLowerCase().includes(search.toLowerCase()) ||
            c.skills.some(s => s.toLowerCase().includes(search.toLowerCase()))
        )
        : []; // Real mode currently returns empty until backend connected

    if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder={isHHActive ? "Поиск по базе HH.ru (Навыки, должность)..." : "Демо поиск (Python, DevOps)..."}
                        className="w-full h-10 pl-9 pr-4 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                    <Filter className="w-4 h-4" />
                    Фильтры
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10">
                    <Search className="w-4 h-4" />
                    Найти
                </button>
            </div>

            {/* Banner State */}
            {!isHHActive && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between text-amber-800 text-sm">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>
                            Вы находитесь в <strong>Демо-режиме</strong>. Показаны тестовые данные.
                        </span>
                    </div>
                    <Link to="/admin/integrations" className="bg-white border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors">
                        Подключить HH.ru
                    </Link>
                </div>
            )}

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filtered.map(candidate => (
                    <div key={candidate.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-4">
                                <img src={candidate.avatar} alt={candidate.name} className="w-12 h-12 rounded-full object-cover" />
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900">{candidate.name}</h3>
                                    <p className="text-slate-500 text-sm font-medium">{candidate.position}</p>
                                </div>
                            </div>
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md uppercase">
                                {candidate.source}
                            </span>
                        </div>

                        <div className="space-y-3 mb-6 flex-1">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Briefcase className="w-4 h-4 text-slate-400" />
                                {candidate.experience} опыта
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <DollarSign className="w-4 h-4 text-slate-400" />
                                Ожидания: <span className="font-semibold text-slate-900">{formatMoney(candidate.salary)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                {candidate.location}
                            </div>

                            <div className="flex flex-wrap gap-2 mt-2">
                                {candidate.skills.map(skill => (
                                    <span key={skill} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {analyzedId === candidate.id ? (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4 animate-in fade-in zoom-in-95 duration-300">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-4 h-4 text-purple-600" />
                                    <span className="font-bold text-sm text-purple-900">AI Анализ</span>
                                    <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Score: {candidate.matchScore}%</span>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Кандидат обладает сильными техническими навыками, соответствующими стеку (Python/FastAPI). Опыт работы релевантен. Зарплатные ожидания вписываются в медиану рынка.
                                </p>
                            </div>
                        ) : null}

                        <div className="flex gap-3 mt-auto pt-4 border-t border-slate-100">
                            <button
                                onClick={() => handleAnalyze(candidate.id)}
                                disabled={isAnalyzing === candidate.id || analyzedId === candidate.id}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm font-bold transition-all ${analyzedId === candidate.id
                                    ? 'bg-slate-100 text-slate-400 border-slate-100 cursor-default'
                                    : 'border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 hover:border-purple-300'
                                    }`}
                            >
                                {isAnalyzing === candidate.id ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Анализ...</>
                                ) : analyzedId === candidate.id ? (
                                    <><Sparkles className="w-4 h-4" /> Проанализировано</>
                                ) : (
                                    <><Sparkles className="w-4 h-4" /> AI Анализ</>
                                )}
                            </button>
                            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-bold">
                                <UserPlus className="w-4 h-4" />
                                Пригласить
                            </button>
                            <button className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600">
                                <ExternalLink className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {isHHActive && filtered.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Начните поиск кандидатов</h3>
                        <p className="text-slate-500 mt-2 max-w-md mx-auto">
                            Введите поисковый запрос выше, чтобы найти кандидатов через HeadHunter API.
                            <br />
                            <span className="text-xs text-slate-400 mt-2 block">(Backend API еще в разработке)</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
