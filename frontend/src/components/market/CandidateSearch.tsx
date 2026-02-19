
import { useState } from 'react';
import { Search, MapPin, Briefcase, DollarSign, Filter, Sparkles, UserPlus, Loader2, ExternalLink, AlertTriangle, Info, GraduationCap, Building2, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { formatMoney } from '../../utils';
import { MOCK_CANDIDATES } from '../../data/mockCandidates';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export const CandidateSearch = () => {
    const [search, setSearch] = useState('');
    const [jobDescription, setJobDescription] = useState('Senior Python Developer');
    const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<{ [id: string]: { analysis: string, match_score: number } }>({});
    const [isFallbackMode, setIsFallbackMode] = useState(false);

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

    // --- Real Search Query ---
    const { data: hhCandidates = [], isLoading: isHHSearching, refetch: searchHH, isError, error } = useQuery({
        queryKey: ['hh-candidates', search],
        queryFn: async () => {
            if (!search.trim()) return [];
            setIsFallbackMode(false);
            try {
                const res = await api.get('/integrations/hh/search', {
                    params: { text: search }
                });
                return res.data;
            } catch (err: any) {
                console.error("HH Search Error", err);
                setIsFallbackMode(true);

                if (err.response?.status === 403) {
                    toast.error("Доступ к HH запрещен (403). Показаны демо-данные.");
                } else {
                    toast.error("Ошибка поиска HH. Показаны демо-данные.");
                }
                return [];
            }
        },
        enabled: false,
        retry: false
    });

    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSearch = () => {
        if (!search.trim()) {
            toast.warning("Введите поисковый запрос");
            return;
        }
        if (isHHActive) {
            searchHH();
        }
    };

    const handleAnalyze = async (candidate: any) => {
        setIsAnalyzing(candidate.id);
        // Automatically expand on analysis
        if (!expandedIds.includes(candidate.id)) {
            toggleExpand(candidate.id);
        }
        try {
            const res = await api.post('/integrations/ai-analyze', {
                candidate_data: {
                    name: candidate.name,
                    position: candidate.position,
                    experience: candidate.experience,
                    skills: candidate.skills,
                    salary_expectation: candidate.salary,
                    education: candidate.education || "Не указано",
                    last_work: candidate.last_work || "Не указано",
                    summary: candidate.summary || "Нет описания",
                    source: candidate.source
                },
                job_description: jobDescription
            });

            setAnalysisResult(prev => ({
                ...prev,
                [candidate.id]: res.data
            }));
        } catch (e: any) {
            console.error("AI Analysis failed", e);
            setAnalysisResult(prev => ({
                ...prev,
                [candidate.id]: {
                    analysis: "Не удалось получить ответ от ИИ. Проверьте настройки ключа.",
                    match_score: 0
                }
            }));
            toast.error("Ошибка AI анализа");
        } finally {
            setIsAnalyzing(null);
        }
    };

    const showDemo = !isHHActive;
    const effectiveShowDemo = showDemo || isFallbackMode;

    const filtered = effectiveShowDemo
        ? MOCK_CANDIDATES.filter((c: any) =>
            c.position.toLowerCase().includes(search.toLowerCase()) ||
            c.skills.some((s: string) => s.toLowerCase().includes(search.toLowerCase())) ||
            c.name.toLowerCase().includes(search.toLowerCase())
        )
        : hhCandidates;

    if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={isHHActive ? "Поиск по базе HH.ru (Навыки, должность)..." : "Демо поиск (Python, Бухгалтер, Юрист)..."}
                            className="w-full h-10 pl-9 pr-4 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                        <Filter className="w-4 h-4" />
                        Фильтры
                    </button>
                    <button
                        onClick={handleSearch}
                        disabled={isHHSearching}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 disabled:opacity-70"
                    >
                        {isHHSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Найти
                    </button>
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <label className="text-sm font-bold text-slate-700">Критерии для AI анализа:</label>
                    </div>
                    <input
                        type="text"
                        value={jobDescription}
                        onChange={e => setJobDescription(e.target.value)}
                        placeholder="Например: Бухгалтер со знанием 1С и опытом в ритейле"
                        className="w-full h-11 px-4 bg-purple-50/50 border border-purple-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-purple-900 placeholder:text-purple-300 font-medium"
                    />
                    <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        ИИ будет оценивать кандидатов именно по этим требованиям
                    </p>
                </div>
            </div>

            {/* Banner State */}
            {(!isHHActive || isFallbackMode) && (
                <div className={`border rounded-xl p-4 flex items-center justify-between text-sm ${isFallbackMode ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>
                            {isFallbackMode
                                ? <span><strong>Ошибка доступа к API HH.</strong> Показаны демо-данные для демонстрации.</span>
                                : <span>Вы находитесь в <strong>Демо-режиме</strong>. Показаны тестовые данные.</span>
                            }
                        </span>
                    </div>
                    {!isHHActive && (
                        <Link to="/admin/integrations" className="bg-white border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors">
                            Подключить HH.ru
                        </Link>
                    )}
                </div>
            )}

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filtered.map((candidate: any, index: number) => {
                    // Ensure ID is string for consistency
                    const cId = String(candidate.id || index);

                    return (
                        <div key={cId} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-4">
                                    {candidate.avatar ? (
                                        <img src={candidate.avatar} alt={candidate.name} className="w-12 h-12 rounded-full object-cover border-2 border-slate-100" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-200 text-slate-400 text-xs font-bold">
                                            N/A
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900">{candidate.name}</h3>
                                        <p className="text-slate-500 text-sm font-medium">{candidate.position}</p>
                                    </div>
                                </div>
                                <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md uppercase">
                                    {candidate.source}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{candidate.experience || 'Не указан'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-900 font-semibold">
                                    <DollarSign className="w-3.5 h-3.5 text-slate-400 font-normal" />
                                    <span>{candidate.salary ? formatMoney(candidate.salary) : 'Не указана'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{candidate.location || candidate.area || 'Не указано'}</span>
                                </div>
                                {candidate.citizenship && (
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{candidate.citizenship}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-1.5 mb-4">
                                {(candidate.skills || []).slice(0, 4).map((skill: string, idx: number) => (
                                    <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-md border border-slate-200/50">
                                        {skill}
                                    </span>
                                ))}
                                {(candidate.skills || []).length > 4 && (
                                    <span className="text-[10px] text-slate-400 self-center">+{candidate.skills.length - 4} ещё</span>
                                )}
                            </div>

                            {/* Collapsible Section */}
                            <div className={`overflow-hidden transition-all duration-300 ${expandedIds.includes(cId) ? 'max-h-[500px] mb-4' : 'max-h-0'}`}>
                                <div className="pt-4 border-t border-slate-100 space-y-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            <GraduationCap className="w-3 h-3" /> Образование
                                        </div>
                                        <p className="text-xs text-slate-600">{candidate.education || 'Нет данных'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            <Building2 className="w-3 h-3" /> Последнее место работы
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium">{candidate.last_work || 'Нет данных'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            <Info className="w-3 h-3" /> Короткое резюме
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed italic">"{candidate.summary || 'Нет описания'}"</p>
                                    </div>
                                    {candidate.url && (
                                        <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                            Открыть резюме на HH.ru <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => toggleExpand(cId)}
                                className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 mb-4 py-1 bg-slate-50 rounded-lg transition-colors"
                            >
                                {expandedIds.includes(cId) ? (
                                    <><ChevronUp className="w-3 h-3" /> Свернуть детали</>
                                ) : (
                                    <><ChevronDown className="w-3 h-3" /> Подробнее о кандидате</>
                                )}
                            </button>

                            {analysisResult[cId] ? (
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4 animate-in fade-in zoom-in-95 duration-300">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles className="w-4 h-4 text-purple-600" />
                                        <span className="font-bold text-sm text-purple-900">AI Анализ</span>
                                        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${analysisResult[cId].match_score > 70 ? 'text-emerald-600 bg-emerald-100' : 'text-amber-600 bg-amber-100'}`}>
                                            Score: {analysisResult[cId].match_score}%
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        {analysisResult[cId].analysis}
                                    </p>
                                </div>
                            ) : null}

                            <div className="flex gap-3 mt-auto pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => handleAnalyze(candidate)}
                                    disabled={isAnalyzing === cId || !!analysisResult[cId]}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm font-bold transition-all ${analysisResult[cId]
                                        ? 'bg-slate-100 text-slate-400 border-slate-100 cursor-default'
                                        : 'border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 hover:border-purple-300'
                                        }`}
                                >
                                    {isAnalyzing === cId ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Анализ...</>
                                    ) : analysisResult[cId] ? (
                                        <><Sparkles className="w-4 h-4" /> Готово</>
                                    ) : (
                                        <><Sparkles className="w-4 h-4" /> AI Анализ</>
                                    )}
                                </button>
                                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-bold">
                                    <UserPlus className="w-4 h-4" />
                                    Пригласить
                                </button>
                                {candidate.url && (
                                    <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 flex items-center justify-center">
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}

                {isHHActive && filtered.length === 0 && !isHHSearching && (
                    <div className="col-span-full py-20 text-center">
                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Начните поиск кандидатов</h3>
                        <p className="text-slate-500 mt-2 max-w-md mx-auto">
                            Введите запрос (например: "Python Developer") и нажмите "Найти", чтобы искать по базе HH.ru.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
