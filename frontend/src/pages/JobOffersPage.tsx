import { useState, useMemo } from 'react';
import { PageHeader } from '../components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
    Plus,
    Loader2,
    Copy,
    Check,
    Search,
    ExternalLink,
    Clock,
    UserPlus,
    CheckCircle2,
    XCircle,
    Building2,
    Wallet,

    Download,
    Gift,
    Trash2,
    Edit3,
    FileText,
    Layout,
    Sparkles,
    Users,
    CheckCircle
} from 'lucide-react';
import { useEmployees } from '../hooks/useEmployees';
import Modal from '../components/Modal';
import { formatMoney } from '../utils';
import { toast } from 'sonner';

interface OfferTemplate {
    id: number;
    name: string;
    company_name?: string;
    benefits?: string[];
    welcome_text?: string;
    description_text?: string;
    theme_color?: string;
    custom_sections?: { title: string, content: string }[];
    probation_period?: string;
    working_hours?: string;
    lunch_break?: string;
    non_compete_text?: string;
    signatories?: { title: string, name: string }[];
}

interface JobOffer {
    id: number;
    candidate_name: string;
    candidate_email?: string;
    position_title: string;
    base_net: number;
    kpi_net: number;
    bonus_net?: number;
    valid_until?: string;
    benefits?: string[];
    company_name?: string;
    welcome_text?: string;
    description_text?: string;
    theme_color?: string;
    custom_sections?: { title: string, content: string }[];
    probation_period?: string;
    working_hours?: string;
    lunch_break?: string;
    non_compete_text?: string;
    start_date?: string;
    signatories?: { title: string, name: string }[];
    status: string;
    access_code?: string;
    token: string;
}

interface WelcomePageOption {
    id: number;
    name: string;
}


export default function JobOffersPage() {
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const initialForm = {
        candidate_name: '',
        candidate_email: '',
        position_title: '',
        base_net: 500000,
        kpi_net: 100000,
        bonus_net: 0,
        valid_until: '',
        benefits: [] as string[],
        company_name: '',
        welcome_text: 'Мы впечатлены вашим опытом и рады пригласить вас в нашу команду!',
        description_text: 'Мы заинтересованы в привлечении в штат компании таких профессионалов, как вы. Надеемся, что работа в нашей команде будет способствовать вашему профессиональному и карьерному росту.',
        theme_color: '#2563eb',
        custom_sections: [] as { title: string, content: string }[],
        // Formal fields
        probation_period: '3 месяца',
        working_hours: '08:30 - 17:30',
        lunch_break: '13:00 - 14:00',
        non_compete_text: 'Заключение договора о неконкуренции, по условиям которого Вы после увольнения в течении 3-х лет не вправе трудоустроиться в конкурентные компании осуществляющих аналогичную деятельность, за нарушение данного условия предусмотрен штраф, подлежащий выплате по первому его требованию.',
        start_date: '',
        signatories: [] as { title: string, name: string }[],
        welcome_page_config_id: null as number | null,
    };

    const [isSignatorySelectOpen, setIsSignatorySelectOpen] = useState(false);
    const [signatorySearch, setSignatorySearch] = useState('');
    const [manualSignatory, setManualSignatory] = useState({ title: '', name: '' });

    const [formData, setFormData] = useState(initialForm);

    const { data: offers = [], isLoading: isOffersLoading } = useQuery({
        queryKey: ['job-offers'],
        queryFn: async () => {
            const res = await api.get('/offers/');
            return res.data;
        }
    });

    const { data: searchResults = [], isLoading: isSearchLoading } = useEmployees(signatorySearch.length >= 2 ? signatorySearch : undefined);

    const { data: welcomePages = [] } = useQuery<WelcomePageOption[]>({
        queryKey: ['welcome-pages'],
        queryFn: async () => {
            const response = await api.get<WelcomePageOption[]>('/welcome-pages/');
            return response.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: Partial<JobOffer>) => {
            if (editingId) {
                const res = await api.put(`/offers/${editingId}`, data);
                return res.data;
            }
            const res = await api.post('/offers/', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-offers'] });
            setIsAddOpen(false);
            setEditingId(null);
            toast.success(editingId ? 'Оффер обновлен' : 'Оффер успешно создан');
            setFormData(initialForm);
        }
    });

    const handleCopyLink = (token: string, id: number) => {
        const url = `${window.location.origin}/public/offer/${token}`;
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        toast.success('Ссылка скопирована!');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDownload = (token: string) => {
        const url = `${window.location.origin}/public/offer/${token}?print=true`;
        window.open(url, '_blank');
    };

    const openEdit = (offer: JobOffer) => {
        setFormData({
            ...initialForm,
            ...offer,
            candidate_email: offer.candidate_email || '',
            valid_until: offer.valid_until || '',
            start_date: offer.start_date || initialForm.start_date,
            signatories: (offer.signatories && offer.signatories.length > 0) ? offer.signatories : initialForm.signatories
        });
        setEditingId(offer.id);
        setIsAddOpen(true);
    };

    const addSignatory = () => {
        setIsSignatorySelectOpen(true);
    };

    const finishAddSignatory = (title: string, name: string) => {
        setFormData({
            ...formData,
            signatories: [...formData.signatories, { title, name }]
        });
        setIsSignatorySelectOpen(false);
        setSignatorySearch('');
        setManualSignatory({ title: '', name: '' });
    };

    const updateSignatory = (idx: number, field: 'title' | 'name', value: string) => {
        const newSigns = [...formData.signatories];
        newSigns[idx][field] = value;
        setFormData({ ...formData, signatories: newSigns });
    };

    const removeSignatory = (idx: number) => {
        setFormData({
            ...formData,
            signatories: formData.signatories.filter((_, i) => i !== idx)
        });
    };

    const addBenefit = () => {
        setFormData({ ...formData, benefits: [...formData.benefits, ''] });
    };

    const updateBenefit = (idx: number, value: string) => {
        const newBenefits = [...formData.benefits];
        newBenefits[idx] = value;
        setFormData({ ...formData, benefits: newBenefits });
    };

    const removeBenefit = (idx: number) => {
        setFormData({ ...formData, benefits: formData.benefits.filter((_, i) => i !== idx) });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'accepted': return <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Принят</span>;
            case 'rejected': return <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1"><XCircle className="w-3 h-3" /> Отклонен</span>;
            case 'expired': return <span className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> Истек</span>;
            default: return <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> Ожидает</span>;
        }
    };

    const { data: templates = [] } = useQuery({
        queryKey: ['offer-templates'],
        queryFn: async () => {
            const res = await api.get('/offer-templates/');
            return res.data;
        }
    });

    const applyTemplate = (templateId: string) => {
        const template = templates.find((t: OfferTemplate) => t.id.toString() === templateId);
        if (!template) return;

        setFormData({
            ...formData,
            company_name: template.company_name || formData.company_name,
            benefits: template.benefits || [],
            welcome_text: template.welcome_text || formData.welcome_text,
            description_text: template.description_text || formData.description_text,
            theme_color: template.theme_color || formData.theme_color,
            custom_sections: template.custom_sections || [],
            probation_period: template.probation_period || formData.probation_period,
            working_hours: template.working_hours || formData.working_hours,
            lunch_break: template.lunch_break || formData.lunch_break,
            non_compete_text: template.non_compete_text || formData.non_compete_text,
            signatories: template.signatories || []
        });
        toast.info(`Применен шаблон: ${template.name}`);
    };

    const filteredOffers = useMemo(() => {
        if (!searchQuery.trim()) return offers;
        const q = searchQuery.toLowerCase();
        return offers.filter((o: JobOffer) =>
            o.candidate_name.toLowerCase().includes(q) ||
            o.position_title.toLowerCase().includes(q) ||
            (o.company_name || '').toLowerCase().includes(q) ||
            (o.status || '').toLowerCase().includes(q)
        );
    }, [offers, searchQuery]);

    if (isOffersLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Офферы компании"
                subtitle="Создание цифровых и официальных предложений о работе"
            />

            {offers.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                        <FileText className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Офферов пока нет</h3>
                    <p className="text-slate-500 max-w-sm mb-8">
                        Здесь будут отображаться созданные предложения о работе.
                    </p>
                    <button
                        onClick={() => { setFormData(initialForm); setEditingId(null); setIsAddOpen(true); }}
                        className="bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                    >
                        <Plus className="w-5 h-5" /> Создать оффер
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Controls */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center w-full bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Поиск по ФИО, должности, компании..."
                                className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 transition-all"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={() => { setFormData(initialForm); setEditingId(null); setIsAddOpen(true); }}
                            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 shrink-0 w-full md:w-auto"
                        >
                            <Plus className="w-4 h-4" /> Создать оффер
                        </button>
                    </div>

                    {/* List header */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="hidden md:grid grid-cols-[1fr_1fr_120px_100px_100px_100px_140px] gap-2 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            <span>Кандидат</span>
                            <span>Должность</span>
                            <span>Оклад</span>
                            <span>Бонус</span>
                            <span>Статус</span>
                            <span>Код</span>
                            <span className="text-right">Действия</span>
                        </div>

                        {filteredOffers.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-sm">
                                Ничего не найдено
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredOffers.map((offer: JobOffer) => (
                                    <div key={offer.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_100px_100px_100px_140px] gap-2 px-5 py-3 items-center hover:bg-slate-50/50 transition-colors group">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 truncate">{offer.candidate_name}</p>
                                            <p className="text-[10px] text-slate-400 font-medium truncate">{offer.company_name}</p>
                                        </div>
                                        <div className="text-sm text-slate-600 font-medium truncate flex items-center gap-1.5">
                                            <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                            {offer.position_title}
                                        </div>
                                        <div className="text-sm font-bold text-slate-900">{formatMoney(offer.base_net)}</div>
                                        <div className="text-sm font-bold text-slate-900">{formatMoney(offer.kpi_net)}</div>
                                        <div>{getStatusBadge(offer.status)}</div>
                                        <div>
                                            <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{offer.access_code || '---'}</span>
                                        </div>
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleCopyLink(offer.token, offer.id)}
                                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Копировать ссылку"
                                            >
                                                {copiedId === offer.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                            <button
                                                onClick={() => handleDownload(offer.token)}
                                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Скачать PDF"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => openEdit(offer)}
                                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Редактировать"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                            <a
                                                href={`/public/offer/${offer.token}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Открыть"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="text-xs text-slate-400 font-medium">
                        {filteredOffers.length} из {offers.length} офферов
                    </div>
                </div>
            )}

            <Modal isOpen={isAddOpen} onClose={() => { setIsAddOpen(false); setEditingId(null); }} title={editingId ? "Редактирование" : "Новый цифровой оффер"} maxWidth="max-w-7xl">
                <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4 p-1">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">

                        {/* ROW 1 */}
                        <section className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-2 flex flex-col justify-center">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Layout className="w-3 h-3" /> Быстрая настройка</h4>
                            <select
                                className="w-full h-8 bg-white border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-900 outline-none"
                                onChange={(e) => applyTemplate(e.target.value)}
                                defaultValue=""
                            >
                                <option value="" disabled>Шаблон...</option>
                                {templates.map((t: OfferTemplate) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </section>

                        <section className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 flex flex-col min-h-[140px]">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Безопасность (NDA)</h4>
                            <textarea
                                className="w-full flex-1 bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] font-medium outline-none resize-none"
                                value={formData.non_compete_text}
                                onChange={e => setFormData({ ...formData, non_compete_text: e.target.value })}
                                placeholder="Текст договора о неконкуренции..."
                            />
                        </section>

                        <section className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-2 flex flex-col justify-center">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock className="w-3 h-3" /> Условия</h4>
                            <div className="space-y-1.5">
                                <input placeholder="Испытательный срок" className="w-full h-7 bg-white border border-slate-200 rounded-lg px-3 text-xs" value={formData.probation_period} onChange={e => setFormData({ ...formData, probation_period: e.target.value })} />
                                <div className="grid grid-cols-2 gap-2">
                                    <input placeholder="Часы" className="w-full h-7 bg-white border border-slate-200 rounded-lg px-3 text-xs" value={formData.working_hours} onChange={e => setFormData({ ...formData, working_hours: e.target.value })} />
                                    <input placeholder="Обед" className="w-full h-7 bg-white border border-slate-200 rounded-lg px-3 text-xs" value={formData.lunch_break} onChange={e => setFormData({ ...formData, lunch_break: e.target.value })} />
                                </div>
                            </div>
                        </section>

                        {/* ROW 2 */}
                        <section className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-2 flex flex-col justify-center">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles className="w-3 h-3" /> Welcome Page
                            </h4>
                            <select
                                className="w-full h-8 bg-white border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-900 outline-none"
                                value={formData.welcome_page_config_id ?? ''}
                                onChange={e => setFormData({ ...formData, welcome_page_config_id: e.target.value ? Number(e.target.value) : null })}
                            >
                                <option value="">Не выбрано</option>
                                {welcomePages.map((wp) => (
                                    <option key={wp.id} value={wp.id}>{wp.name}</option>
                                ))}
                            </select>
                        </section>

                        <section className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Wallet className="w-3 h-3" /> Деньги</h4>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                                <div>
                                    <label className="text-[8px] font-bold text-slate-400 uppercase px-1">Оклад</label>
                                    <input type="number" className="w-full h-7 bg-white border border-slate-200 rounded-lg px-2 text-xs font-bold" value={formData.base_net} onChange={e => setFormData({ ...formData, base_net: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div>
                                    <label className="text-[8px] font-bold text-slate-400 uppercase px-1">Бонус</label>
                                    <input type="number" className="w-full h-7 bg-white border border-slate-200 rounded-lg px-2 text-xs font-bold" value={formData.kpi_net} onChange={e => setFormData({ ...formData, kpi_net: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div>
                                    <label className="text-[8px] font-bold text-slate-400 uppercase px-1">Дата выхода</label>
                                    <input type="date" className="w-full h-7 bg-white border border-slate-200 rounded-lg px-2 text-xs" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[8px] font-bold text-slate-400 uppercase px-1">До</label>
                                    <input type="date" className="w-full h-7 bg-white border border-slate-200 rounded-lg px-2 text-xs" value={formData.valid_until} onChange={e => setFormData({ ...formData, valid_until: e.target.value })} />
                                </div>
                            </div>
                        </section>

                        <section className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 flex flex-col">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Gift className="w-3 h-3" /> Соц. Пакет
                            </h4>
                            <div className="space-y-1 mb-2 overflow-y-auto max-h-[100px] pr-1 flex-1">
                                {formData.benefits.map((benefit, idx) => (
                                    <div key={idx} className="flex gap-1.5 group">
                                        <input
                                            className="flex-1 h-6 bg-white border border-slate-200 rounded-lg px-2 text-[10px]"
                                            placeholder="Льгота..."
                                            value={benefit}
                                            onChange={e => updateBenefit(idx, e.target.value)}
                                        />
                                        <button type="button" onClick={() => removeBenefit(idx)} className="p-0.5 text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addBenefit} className="w-full py-1 bg-white border border-dashed border-slate-300 text-slate-500 rounded-lg text-[8px] font-black uppercase hover:bg-slate-50 transition-colors">+ Добавить</button>
                        </section>

                        {/* ROW 3 */}
                        <section className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-2 flex flex-col justify-center">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><UserPlus className="w-3 h-3" /> Кандидат</h4>
                            <div className="space-y-1.5">
                                <input placeholder="ФИО Кандидата" required className="w-full h-8 bg-white border border-slate-200 rounded-xl px-3 text-xs" value={formData.candidate_name} onChange={e => setFormData({ ...formData, candidate_name: e.target.value })} />
                                <input placeholder="Должность" required className="w-full h-8 bg-white border border-slate-200 rounded-xl px-3 text-xs" value={formData.position_title} onChange={e => setFormData({ ...formData, position_title: e.target.value })} />
                                <input placeholder="Компания" className="w-full h-8 bg-white border border-slate-200 rounded-xl px-3 text-xs font-bold text-slate-900" value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} />
                            </div>
                        </section>

                        <div className="hidden md:flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl p-4 opacity-30 select-none grayscale">
                            <FileText className="w-8 h-8 text-slate-300 mb-2" />
                            <span className="text-[8px] font-black uppercase tracking-tighter text-slate-300 text-center leading-none">Конфиденциально<br />FOT & Payroll Hub</span>
                        </div>

                        <section className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 flex flex-col">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Подписанты</h4>
                            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 flex-1">
                                {formData.signatories.map((sig, idx) => (
                                    <div key={idx} className="p-2 bg-white rounded-xl border border-slate-200 relative group shadow-sm flex flex-col justify-center">
                                        <button type="button" onClick={() => removeSignatory(idx)} className="absolute top-1 right-1 text-red-300 opacity-0 group-hover:opacity-100 transition-opacity z-10"><Trash2 className="w-3 h-3" /></button>
                                        <div className="pr-4">
                                            <input
                                                className="w-full bg-slate-50 px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-slate-400 outline-none border-none mb-0.5"
                                                value={sig.title}
                                                onChange={e => updateSignatory(idx, 'title', e.target.value)}
                                            />
                                            <input
                                                className="w-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-900 outline-none border-none"
                                                value={sig.name}
                                                onChange={e => updateSignatory(idx, 'name', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addSignatory} className="w-full py-1.5 mt-2 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-1.5 text-slate-400 hover:bg-slate-50 transition-all font-black text-[8px] uppercase">
                                <Plus className="w-3 h-3" /> Добавить подписанта
                            </button>
                        </section>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="w-full h-12 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-900/10 disabled:opacity-50"
                        >
                            {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <>{editingId ? "Сохранить изменения" : "Создать оффер"}</>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Signatory Selection Modal */}
            <Modal isOpen={isSignatorySelectOpen} onClose={() => { setIsSignatorySelectOpen(false); setManualSignatory({ title: '', name: '' }); }} title="Добавить подписанта" maxWidth="max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
                    {/* LEFT: Manual Entry */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Edit3 className="w-4 h-4" />
                            <h5 className="text-[10px] font-black uppercase tracking-widest">Ввести вручную</h5>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                            <input
                                placeholder="Должность подписанта"
                                className="w-full h-10 px-4 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400"
                                value={manualSignatory.title}
                                onChange={e => setManualSignatory({ ...manualSignatory, title: e.target.value })}
                            />
                            <input
                                placeholder="ФИО подписанта"
                                className="w-full h-10 px-4 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400"
                                value={manualSignatory.name}
                                onChange={e => setManualSignatory({ ...manualSignatory, name: e.target.value })}
                            />
                            <button
                                type="button"
                                disabled={!manualSignatory.title || !manualSignatory.name}
                                onClick={() => finishAddSignatory(manualSignatory.title, manualSignatory.name)}
                                className="w-full h-10 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
                            >
                                <CheckCircle className="w-3 h-3" /> Добавить
                            </button>
                        </div>
                    </div>

                    {/* RIGHT: Pick from Staff */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-blue-400">
                            <Users className="w-4 h-4" />
                            <h5 className="text-[10px] font-black uppercase tracking-widest">Выбрать из штата</h5>
                        </div>
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    placeholder="Поиск сотрудника..."
                                    className="w-full h-9 pl-9 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-slate-400 transition-all focus:bg-white"
                                    value={signatorySearch}
                                    onChange={e => setSignatorySearch(e.target.value)}
                                />
                            </div>

                            <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl bg-white shadow-sm custom-scrollbar">
                                {signatorySearch.length >= 2 ? (
                                    <>
                                        {searchResults.map((emp) => (
                                            <button
                                                key={emp.id}
                                                type="button"
                                                onClick={() => finishAddSignatory(emp.position || 'Должность', emp.full_name)}
                                                className="w-full px-4 py-2.5 flex flex-col items-start hover:bg-slate-50 transition-colors text-left group"
                                            >
                                                <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{emp.full_name}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{emp.position || 'Должность не указана'}</span>
                                            </button>
                                        ))}

                                        {!isSearchLoading && searchResults.length === 0 && (
                                            <div className="p-8 text-center text-slate-400 text-[10px] font-medium leading-relaxed">
                                                Сотрудники не найдены<br />
                                                <span className="text-[8px] opacity-50 uppercase font-black tracking-tighter">Убедитесь, что данные введены верно</span>
                                            </div>
                                        )}

                                        {isSearchLoading && (
                                            <div className="p-10 flex flex-col items-center justify-center gap-2">
                                                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ищем в базе...</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="p-8 text-center text-slate-400 text-[10px] font-medium leading-relaxed">
                                        Введите минимум 2 символа для поиска<br />
                                        <span className="text-[8px] opacity-50 uppercase font-black tracking-tighter">Начните вводить ФИО или должность</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
