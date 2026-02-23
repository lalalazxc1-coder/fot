import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import {
    Loader2,
    Download,
    Shield,
    CheckCircle2,
    Lock,
    ArrowRight
} from 'lucide-react';
import { formatMoney } from '../../utils';
import { toast } from 'sonner';

export default function PublicOfferPage() {
    const { token } = useParams();
    const [searchParams] = useSearchParams();
    const [offer, setOffer] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Security State
    const [pin, setPin] = useState('');
    const [isLocked, setIsLocked] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [pinError, setPinError] = useState(false);

    const fetchOffer = async (providedPin?: string) => {
        setIsVerifying(true);
        try {
            const pinParam = providedPin ? `?pin=${providedPin}` : '';
            const res = await api.get(`/offers/public/${token}${pinParam}`);

            if (res.data.is_locked) {
                setIsLocked(true);
                setOffer(res.data);
                if (providedPin) {
                    setPinError(true);
                    toast.error('Неверный код доступа');
                }
            } else {
                setIsLocked(false);
                setPinError(false);
                setOffer(res.data);
                if (searchParams.get('print') === 'true') {
                    setTimeout(() => window.print(), 1000);
                }
            }
        } catch (e: any) {
            setError("Оффер не найден или срок его действия истек");
        } finally {
            setIsLoading(false);
            setIsVerifying(false);
        }
    };

    useEffect(() => {
        fetchOffer();
    }, [token, searchParams]);

    const handleVerifyPin = (e: React.FormEvent) => {
        e.preventDefault();
        fetchOffer(pin);
    };

    const handleAction = async (action: 'accept' | 'reject') => {
        setIsSubmitting(true);
        try {
            await api.post(`/offers/public/${token}/action`, { action, pin });
            setOffer({ ...offer, status: action === 'accept' ? 'accepted' : 'rejected' });
            if (action === 'accept') {
                toast.success('Предложение принято успешно.');
            } else {
                toast.info('Предложение отклонено.');
            }
        } catch (e) {
            toast.error('Ошибка при выполнении действия.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-4" />
        </div>
    );

    if (error || !offer) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f1f5f9] p-6 text-slate-900 text-center">
            <Lock className="w-12 h-12 text-slate-300 mx-auto mb-6" />
            <h1 className="text-xl font-bold mb-2 tracking-tight">Доступ ограничен</h1>
            <p className="text-slate-500 text-sm max-w-xs">{error}</p>
        </div>
    );

    const isPending = offer?.status === 'pending';

    // LOCK SCREEN: Ask for PIN (Light Version)
    if (isLocked) {
        return (
            <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-6">
                <div className="w-full max-w-md bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-200 text-center">
                    <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-slate-900/20">
                        <Shield className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Защищенный доступ</h1>
                    <p className="text-slate-500 text-sm mb-8 font-medium italic">Для просмотра оффера введите 6-значный код доступа.</p>

                    <form onSubmit={handleVerifyPin} className="space-y-4">
                        <input
                            type="text"
                            maxLength={6}
                            placeholder="0 0 0 0 0 0"
                            value={pin}
                            onChange={e => {
                                setPin(e.target.value);
                                setPinError(false);
                            }}
                            className={`w-full h-16 bg-slate-50 border rounded-2xl text-center text-3xl font-black tracking-[0.5em] focus:ring-4 outline-none transition-all placeholder:text-slate-200 text-slate-900 ${pinError
                                ? 'border-red-500 text-red-600 focus:ring-red-100'
                                : 'border-slate-200 focus:ring-slate-900/5'
                                }`}
                        />
                        {pinError && (
                            <p className="text-red-500 text-xs font-bold uppercase tracking-wider">Неверный код доступа</p>
                        )}
                        <button
                            type="submit"
                            disabled={pin.length < 6 || isVerifying}
                            className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 transition-all"
                        >
                            {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Открыть <ArrowRight className="w-4 h-4" /></>}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f1f5f9] font-sans text-slate-900 selection:bg-slate-200">
            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    body { background: white !important; -webkit-print-color-adjust: exact; margin: 0; padding: 0; overflow: hidden; }
                    .no-print { display: none !important; }
                    .offer-screen { display: none !important; }
                    .offer-pdf { 
                        display: block !important; 
                        width: 210mm !important; 
                        height: 297mm !important; 
                        padding: 12mm 18mm !important; 
                        background: white !important; 
                        color: black !important;
                        box-sizing: border-box; 
                        position: relative; 
                        font-family: 'Inter', sans-serif;
                    }
                    .pdf-header-meta { text-align: right; margin-bottom: 30px; }
                    .pdf-header-meta div:first-child { color: #2563eb; font-weight: 800; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.1em; }
                    .pdf-header-meta div:last-child { color: black; font-weight: 700; font-size: 8pt; margin-top: 2px; }
                    
                    .pdf-center-header { text-align: center; margin-bottom: 25px; }
                    .pdf-company-name { font-size: 11pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
                    .pdf-greeting { font-size: 16pt; font-weight: 900; color: black; margin: 10px 0; }
                    .pdf-intro { text-align: center; font-size: 9pt; color: #475569; margin-bottom: 20px; line-height: 1.5; }
                    
                    .pdf-main-text { font-size: 9pt; line-height: 1.6; color: black; }
                    .pdf-bullet-list { margin: 20px 0; padding-left: 0; list-style: none; }
                    .pdf-bullet-item { position: relative; padding-left: 25px; margin-bottom: 12px; }
                    .pdf-bullet-item:before { 
                        content: '✓'; position: absolute; left: 0; top: 0; 
                        color: #2563eb; font-weight: bold; font-size: 11pt; 
                    }
                    
                    .pdf-details-row { margin-top: 15px; font-size: 9pt; color: #334155; }
                    .pdf-details-row strong { color: black; }
                    
                    .pdf-date-start { margin-top: 25px; font-size: 9.5pt; font-weight: 700; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
                    
                    .pdf-signature-section { margin-top: 35px; width: 100%; }
                    .pdf-sig-row { display: grid; grid-template-columns: 1fr 220px; gap: 40px; margin-bottom: 25px; align-items: flex-end; }
                    .pdf-sig-label { font-size: 8.5pt; font-weight: 800; color: #2563eb; margin-bottom: 4px; }
                    .pdf-sig-name { font-size: 9pt; font-weight: 700; color: black; }
                    .pdf-sig-line { border-bottom: 1px solid #000; width: 100%; margin-bottom: 15px; }
                    .pdf-sig-hint { text-align: center; font-size: 7pt; color: #64748b; text-transform: uppercase; font-weight: 700; }
                }
                @media screen {
                    .offer-pdf { display: none; }
                }
            `}</style>

            <div className="fixed top-8 right-8 z-50 no-print flex gap-3">
                <button
                    onClick={() => window.print()}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl"
                >
                    <Download className="w-3.5 h-3.5" /> Скачать в PDF
                </button>
            </div>

            {/* SCREEN VIEW (Restored Light Slate Mode) */}
            <main className="max-w-4xl mx-auto px-4 py-12 md:py-24 offer-screen">
                <div className="bg-white shadow-2xl shadow-slate-200/50 rounded-[2.5rem] border border-slate-200 overflow-hidden">

                    <div className="bg-slate-50 border-b border-slate-100 p-8 md:p-12">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-4">Официальный документ</div>
                                <h1 className="text-4xl font-black tracking-tighter text-slate-900 mb-2 uppercase">Предложение о работе</h1>
                                <p className="text-slate-500 font-medium">Для кандидата: <span className="text-slate-900 font-bold">{offer.candidate_name}</span></p>
                            </div>
                            <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm text-center min-w-[200px]">
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">ID Оффера</p>
                                <p className="font-mono text-sm font-bold text-slate-900">{token?.slice(0, 12).toUpperCase()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 md:p-16 space-y-20">
                        <div className="max-w-3xl border-l-4 border-slate-900 pl-8">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-6">Приветствую</h2>
                            <div className="text-lg leading-relaxed text-slate-800 font-medium">
                                {offer.welcome_text || `Мы рады предложить Вам позицию в нашей команде.`}
                                <p className="mt-4 text-slate-500 text-base italic">
                                    {offer.description_text || `Мы впечатлены вашим потенциалом и надеемся на долгосрочное и продуктивное сотрудничество.`}
                                </p>
                            </div>
                        </div>

                        <section>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-8 font-mono">01. Финансовая мотивация</h2>
                            <div className="space-y-4">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 rounded-3xl bg-slate-50 border border-slate-100">
                                    <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 md:mb-0">Ежемесячный оклад (На руки)</div>
                                    <div className="text-3xl font-black text-slate-900">{formatMoney(offer.base_net)}</div>
                                </div>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
                                    <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 md:mb-0">Переменная часть (Бонусы)</div>
                                    <div className="text-3xl font-black text-slate-900">{formatMoney(offer.kpi_net)}</div>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-10 font-mono">02. Условия трудоустройства</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="p-4 border-b border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Работодатель</p>
                                    <p className="text-lg font-bold text-slate-900">{offer.company_name}</p>
                                </div>
                                <div className="p-4 border-b border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Должность</p>
                                    <p className="text-lg font-bold text-slate-900">{offer.position_title}</p>
                                </div>
                                <div className="p-4 border-b border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Дата выхода</p>
                                    <p className="text-lg font-bold text-slate-900">{offer.start_date || 'По согласованию'}</p>
                                </div>
                                <div className="p-4 border-b border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Испытательный срок</p>
                                    <p className="text-lg font-bold text-slate-900">{offer.probation_period || '3 месяца'}</p>
                                </div>
                            </div>
                        </section>

                        {offer.benefits?.length > 0 && (
                            <section>
                                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-8 font-mono">03. Социальный пакет</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {offer.benefits.map((b: string, i: number) => (
                                        <div key={i} className="flex items-center gap-4 p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                                            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4 text-slate-900" />
                                            </div>
                                            <span className="font-semibold text-slate-700 text-sm">{b}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="bg-slate-900 rounded-[2rem] p-10 text-white">
                            <div className="flex items-center gap-3 mb-6">
                                <Shield className="w-5 h-5 text-slate-400" />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Конфиденциальность</h3>
                            </div>
                            <p className="text-lg font-serif italic text-slate-300 leading-relaxed">
                                "{offer.non_compete_text || `Любая информация, содержащаяся в данном документе, является строго конфиденциальной и не подлежит разглашению третьим лицам.`}"
                            </p>
                        </section>

                        <div className="pt-20 border-t border-slate-100">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                                <div className="max-w-sm">
                                    <h4 className="text-xs font-black uppercase tracking-widest mb-3">Ваше решение</h4>
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                        Подтверждение условий через данную форму является предварительным согласием с Вашей стороны.
                                    </p>
                                </div>

                                <div className="w-full md:w-auto min-w-[300px]">
                                    {!isPending ? (
                                        <div className={`p-8 text-center rounded-[2rem] border-2 shadow-xl ${offer.status === 'accepted' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-red-500 text-red-600 bg-red-50'}`}>
                                            <div className="text-[10px] font-black uppercase tracking-[0.4em] mb-2 text-slate-400">Статус оффера</div>
                                            <div className="text-2xl font-black uppercase">{offer.status === 'accepted' ? 'ПРИНЯТО ВАМИ' : 'ОТКЛОНЕНО'}</div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            <button
                                                onClick={() => handleAction('accept')}
                                                disabled={isSubmitting}
                                                className="h-16 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.3em] hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 shadow-2xl shadow-slate-900/20"
                                            >
                                                {isSubmitting ? <Loader2 className="animate-spin" /> : "Принять предложение"}
                                            </button>
                                            <button
                                                onClick={() => handleAction('reject')}
                                                disabled={isSubmitting}
                                                className="h-14 bg-white border border-slate-200 text-slate-500 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] hover:bg-slate-50 transition-all"
                                            >
                                                Отклонить
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* RESTORED & ENHANCED PDF VIEW (Matching the Screenshot Request) */}
            <div className="offer-pdf">
                <div className="pdf-header-meta">
                    <div>Строго конфиденциально</div>
                    <div>Предложение о работе</div>
                </div>

                <div className="pdf-center-header">
                    <div className="pdf-company-name">Компания {offer.company_name}</div>
                    <div className="pdf-greeting">Уважаемый {offer.candidate_name}</div>
                </div>

                <div className="pdf-intro">
                    Примите наши поздравления и выражаем благодарность за интерес к работе в нашей Компании.<br />
                    Мы с большим удовольствием приглашаем Вас присоединиться к нашему коллективу.
                </div>

                <div className="pdf-main-text">
                    Основные условия Вашего трудоустройства:
                    <ul className="pdf-bullet-list">
                        <li className="pdf-bullet-item">Ежемесячный должностной оклад составляет <strong>{formatMoney(offer.base_net)}</strong> (после вычета налогов/Net).</li>
                        {offer.kpi_net > 0 && <li className="pdf-bullet-item">Дополнительно предусмотрен целевой бонус в размере <strong>{formatMoney(offer.kpi_net)}</strong> за достижение KPI.</li>}
                        {offer.benefits?.map((b: string, i: number) => (
                            <li key={i} className="pdf-bullet-item">{b}</li>
                        ))}
                    </ul>
                </div>

                <div className="pdf-details-row">
                    Испытательный срок: <strong>{offer.probation_period || '3 месяца'}</strong>.
                </div>

                <div className="pdf-details-row" style={{ marginTop: '10px' }}>
                    В Компании установлен следующий рабочий график и время отдыха:<br />
                    • Рабочий график: <strong>{offer.working_hours || '09:00 - 18:00'}</strong><br />
                    • Время отдыха и приема пищи: <strong>{offer.lunch_break || '13:00 - 14:00'}</strong>
                </div>

                <div className="pdf-main-text" style={{ marginTop: '20px' }}>
                    <p>Обязательным условием является соблюдение политики конфиденциальности и безопасности Компании.</p>
                </div>

                <div className="pdf-date-start">
                    Дата выхода на работу: {offer.start_date || '_________________'} 202_г.
                </div>

                <div className="pdf-signature-section">
                    <p style={{ fontWeight: 800, fontSize: '9pt', marginBottom: '20px' }}>С уважением,</p>
                    {offer.signatories?.map((sig: any, idx: number) => (
                        <div key={idx} className="pdf-sig-row">
                            <div>
                                <div className="pdf-sig-label text-blue-500">{sig.title}</div>
                                <div className="pdf-sig-name">{sig.name}</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div className="pdf-sig-line"></div>
                                <div className="pdf-sig-hint">Подпись</div>
                            </div>
                        </div>
                    ))}

                    <div className="pdf-sig-row" style={{ marginTop: '30px' }}>
                        <div>
                            <div className="pdf-sig-label">Кандидат / Согласие с условиями</div>
                            <div className="pdf-sig-name" style={{ color: '#cbd5e1' }}>{offer.candidate_name}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div className="pdf-sig-line" style={{ borderBottom: '1px solid #3b82f6' }}></div>
                            <div className="pdf-sig-hint" style={{ color: '#3b82f6' }}>Подпись кандидата</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
