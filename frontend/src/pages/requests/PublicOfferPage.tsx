import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import {
    Loader2,
    Download,
    Shield,
    CheckCircle2,
    Lock,
    ArrowRight,
    Sparkles
} from 'lucide-react';
import { formatMoney } from '../../utils';
import { toast } from 'sonner';
import WelcomeDashboard from '../../components/WelcomeDashboard';

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

    // Welcome Experience State
    const [welcomeContent, setWelcomeContent] = useState<any>(null);
    const [showWelcome, setShowWelcome] = useState(false);

    const fetchOffer = async () => {
        setIsVerifying(true);
        try {
            // FIX #H2: GET больше не принимает pin-параметр — только preview
            const res = await api.get(`/offers/public/${token}`);
            setOffer(res.data);
            setIsLocked(true); // Всегда начинаем как locked
        } catch (e: any) {
            setError("Оффер не найден или срок его действия истек");
        } finally {
            setIsLoading(false);
            setIsVerifying(false);
        }
    };

    useEffect(() => {
        fetchOffer();
    }, [token]);

    const handleVerifyPin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        try {
            // FIX #H2: PIN передаётся в POST JSON-теле (не в URL)
            const res = await api.post(`/offers/public/${token}/unlock`, { pin });
            setIsLocked(false);
            setPinError(false);
            setOffer(res.data);
            // If already accepted — store welcome_content but DON'T auto-show
            if (res.data.status === 'accepted' && res.data.welcome_content) {
                setWelcomeContent(res.data.welcome_content);
            }
            if (searchParams.get('print') === 'true') {
                setTimeout(() => window.print(), 1000);
            }
        } catch (e: any) {
            setPinError(true);
            if (e?.response?.status === 429) {
                toast.error('Превышен лимит попыток. Попробуйте через 15 минут.');
            } else {
                toast.error('Неверный код доступа');
            }
        } finally {
            setIsVerifying(false);
        }
    };

    const handleAction = async (action: 'accept' | 'reject') => {
        setIsSubmitting(true);
        try {
            const res = await api.post(`/offers/public/${token}/action`, { action, pin });
            const newStatus = action === 'accept' ? 'accepted' : 'rejected';
            setOffer({ ...offer, status: newStatus });
            if (action === 'accept') {
                toast.success('Предложение принято! Нажмите кнопку ниже, чтобы открыть Welcome Page.');
                // Store welcome content, show button — don't auto-redirect
                const wc = res.data?.welcome_content;
                if (wc) {
                    setWelcomeContent(wc);
                }
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

    // Show Welcome Dashboard if accepted
    if (showWelcome) {
        return (
            <WelcomeDashboard
                candidateName={offer.candidate_name}
                positionTitle={offer.position_title}
                companyName={offer.company_name}
                startDate={offer.start_date}
                welcomeContent={welcomeContent}
            />
        );
    }

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
        <div className="min-h-screen bg-[#f1f5f9] font-sans text-slate-900 selection:bg-slate-200 print:bg-white print:min-h-0">
            <style>{`
                @media print {
                    @page { size: A4; margin: 10mm 15mm; }
                    body, html { background: white !important; -webkit-print-color-adjust: exact; margin: 0; padding: 0; display: block; }
                    .no-print { display: none !important; }
                    .offer-screen { display: none !important; }
                    
                    .offer-pdf { 
                        display: block !important; 
                        background: white !important; 
                        color: black !important;
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 9.5pt;
                        line-height: 1.35;
                        width: 100%;
                        box-sizing: border-box;
                    }
                    .pdf-content-wrapper {
                        display: block;
                    }
                    
                    .pdf-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
                    .pdf-company-logo { max-width: 250px; object-fit: contain; }
                    .pdf-header-right { text-align: right; font-weight: bold; font-size: 10.5pt; line-height: 1.5; }
                    
                    .pdf-greeting { text-align: center; font-weight: bold; text-decoration: underline; font-size: 10.5pt; margin-bottom: 10px; }
                    .pdf-center-text { text-align: center; margin-bottom: 10px; }
                    .pdf-position { text-align: center; font-weight: bold; font-size: 10.5pt; margin-bottom: 15px; }
                    
                    .pdf-text { margin-bottom: 8px; text-align: justify; }
                    
                    .pdf-list { list-style: none; padding-left: 0; margin-bottom: 10px; }
                    .pdf-list li { position: relative; padding-left: 20px; margin-bottom: 5px; }
                    .pdf-list li:before { content: '✓'; position: absolute; left: 0; font-weight: bold; }
                    
                    .pdf-cond-list { padding-left: 20px; margin-bottom: 10px; list-style-type: square; }
                    .pdf-cond-list li { margin-bottom: 5px; }
                    
                    /* Блок подписей идет обычным потоком сверху вниз */
                    .pdf-signatures { margin-top: 30px; page-break-inside: avoid; }
                    .pdf-sig-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; }
                    .pdf-sig-left { width: 45%; }
                    .pdf-sig-left-title { font-weight: bold; margin-bottom: 5px; font-size: 9pt; }
                    .pdf-sig-left-name { font-size: 10pt; }
                    .pdf-sig-right { width: 45%; text-align: center; }
                    .pdf-sig-line { border-bottom: 1px solid black; width: 100%; margin-bottom: 2px; }
                    .pdf-sig-hint { font-size: 8pt; }
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
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-4">Официальный документ</div>
                            <h1 className="text-4xl font-black tracking-tighter text-slate-900 mb-2 uppercase">Предложение о работе</h1>
                            <p className="text-slate-500 font-medium">Для кандидата: <span className="text-slate-900 font-bold">{offer.candidate_name}</span></p>
                        </div>
                    </div>

                    <div className="p-8 md:p-16 space-y-20">
                        <div className="max-w-3xl border-l-4 border-slate-900 pl-8">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6">Приветствую</h2>
                            <div className="text-lg leading-relaxed text-slate-800 font-medium">
                                {offer.welcome_text || `Мы рады предложить Вам позицию в нашей команде.`}
                                <p className="mt-4 text-slate-500 text-base italic">
                                    {offer.description_text || `Мы впечатлены вашим потенциалом и надеемся на долгосрочное и продуктивное сотрудничество.`}
                                </p>
                            </div>
                        </div>

                        <section>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 font-mono">01. Финансовая мотивация</h2>
                            <div className="rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                                <div className="flex justify-between items-center px-6 py-4 bg-slate-50">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Ежемесячный оклад (На руки)</span>
                                    <span className="text-xl font-black text-slate-900">{formatMoney(offer.base_net)}</span>
                                </div>
                                <div className="flex justify-between items-center px-6 py-4 bg-white">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Переменная часть (Бонусы)</span>
                                    <span className="text-xl font-black text-slate-900">{formatMoney(offer.kpi_net)}</span>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-10 font-mono">02. Условия трудоустройства</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="p-4 border-b border-slate-100">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Работодатель</p>
                                    <p className="text-lg font-bold text-slate-900">{offer.company_name}</p>
                                </div>
                                <div className="p-4 border-b border-slate-100">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Должность</p>
                                    <p className="text-lg font-bold text-slate-900">{offer.position_title}</p>
                                </div>
                                <div className="p-4 border-b border-slate-100">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Дата выхода</p>
                                    <p className="text-lg font-bold text-slate-900">{offer.start_date || 'По согласованию'}</p>
                                </div>
                                <div className="p-4 border-b border-slate-100">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Испытательный срок</p>
                                    <p className="text-lg font-bold text-slate-900">{offer.probation_period || '3 месяца'}</p>
                                </div>
                            </div>
                        </section>

                        {offer.benefits?.length > 0 && (
                            <section>
                                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8 font-mono">03. Социальный пакет</h2>
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
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4">
                                        Этот документ носит информационный характер. Официальный трудовой договор будет подписан в первый рабочий день.
                                    </p>
                                    <p className="text-base font-bold text-slate-900 mb-2">
                                        Готовы присоединиться?
                                    </p>
                                    {offer.valid_until && (
                                        <p className="text-xs font-bold text-red-500 bg-red-50 inline-block px-3 py-1.5 rounded-lg border border-red-100">
                                            Оффер действителен до {new Date(offer.valid_until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(' г.', '')}
                                        </p>
                                    )}
                                </div>

                                <div className="w-full md:w-auto min-w-[300px]">
                                    {!isPending ? (
                                        <div className="space-y-4">
                                            <div className={`p-8 text-center rounded-[2rem] border-2 shadow-xl ${offer.status === 'accepted' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-red-500 text-red-600 bg-red-50'}`}>
                                                <div className="text-[10px] font-black uppercase tracking-[0.4em] mb-2 text-slate-500">Статус оффера</div>
                                                <div className="text-2xl font-black uppercase">{offer.status === 'accepted' ? 'ПРИНЯТО ВАМИ' : 'ОТКЛОНЕНО'}</div>
                                            </div>
                                            {offer.status === 'accepted' && welcomeContent && (
                                                <button
                                                    onClick={() => {
                                                        setShowWelcome(true);
                                                        window.scrollTo(0, 0);
                                                    }}
                                                    id="btn-open-welcome-page"
                                                    className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98]"
                                                >
                                                    <Sparkles className="w-4 h-4" />
                                                    Посмотреть Welcome Page
                                                </button>
                                            )}
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

            {/* UPDATED PDF VIEW (Matching User Reference Image) */}
            <div className="offer-pdf">
                <div className="pdf-content-wrapper">
                    <div className="pdf-header">
                        <div>
                        </div>
                        <div className="pdf-header-right">
                            <div>Строго Конфиденциально</div>
                            <div>Предложение о работе</div>
                        </div>
                    </div>

                    <div className="pdf-greeting">
                        Уважаемый {offer.candidate_name}!
                    </div>

                    <div className="pdf-center-text">
                        Компания {offer.company_name || 'KULAN OIL'} рада сделать вам предложение о работе на должность
                    </div>

                    <div className="pdf-position">
                        {offer.position_title}
                    </div>

                    <div className="pdf-text">
                        Мы заинтересованы в привлечении в штат компании таких профессионалов, как вы. Надеемся, что работа в нашей команде будет способствовать вашему профессиональному и карьерному росту.
                    </div>

                    <div className="pdf-text">
                        Компенсационный пакет включает в себя:
                    </div>

                    <ul className="pdf-list">
                        <li>Ежемесячный оклад в размере <strong>{formatMoney(offer.base_net)}</strong> тенге к начислению, с учетом пенсионных и налоговых отчислений согласно законодательству РК.</li>
                        {offer.kpi_net > 0 && <li>Ежемесячный бонус в размере <strong>{formatMoney(offer.kpi_net)}</strong> (при выполнении задач по мотивационной системе) тенге к начислению, с учетом пенсионных и налоговых отчислений согласно законодательству РК.</li>}
                        {offer.benefits?.map((b: string, i: number) => (
                            <li key={i}>{b}.</li>
                        ))}
                    </ul>

                    <div className="pdf-text">
                        Испытательный срок: {offer.probation_period || '3 месяца'} согласно ТК РК.
                    </div>

                    <div className="pdf-text">
                        В компании установлена пятидневная рабочая неделя (выходные дни: суббота, воскресенье)<br />
                        - восьмичасовой рабочий день - {offer.working_hours || 'с «09:00» часов до «18:00» часов'}<br />
                        - 1 (один) час на отдых и прием пищи - {offer.lunch_break || 'с «13.00» часов до «14.00» часов'}
                    </div>

                    <div className="pdf-text" style={{ marginTop: '5px', marginBottom: '5px' }}>
                        Обязательное условие:
                    </div>

                    <ul className="pdf-cond-list">
                        <li>
                            {offer.non_compete_text || `Заключение договора о неконкуренции, по условиям которого Вы после увольнения в течении 3-х лет не вправе трудоустроиться в конкурентные компании осуществляющих аналогичную деятельность как у ${offer.company_name || 'KULAN OIL'}, за нарушение данного условия предусмотрен штраф, подлежащий выплате по первому его требованию.`}
                        </li>
                    </ul>

                    <div className="pdf-text" style={{ marginTop: '5px' }}>
                        С нетерпением ждем Вашего присоединения к команде компании {offer.company_name || 'KULAN OIL'}.
                    </div>

                    <div className="pdf-text">
                        Дата выхода на работу: {offer.start_date ? offer.start_date.split('-').reverse().join('.') : '_______________ 202__ г.'}
                    </div>
                </div>

                <div className="pdf-signatures">
                    {offer.signatories?.length > 0 && offer.signatories.map((sig: any, idx: number) => (
                        <div key={idx} className="pdf-sig-row">
                            <div className="pdf-sig-left">
                                {sig.title && <div className="pdf-sig-left-title">{sig.title}</div>}
                                <div className="pdf-sig-left-name">{sig.name}</div>
                            </div>
                            <div className="pdf-sig-right">
                                <div className="pdf-sig-line"></div>
                                <div className="pdf-sig-hint">(подпись)</div>
                            </div>
                        </div>
                    ))}

                    <div className="pdf-sig-row" style={{ marginTop: '20px' }}>
                        <div className="pdf-sig-left">
                            <div className="pdf-sig-left-name">{offer.candidate_name}</div>
                        </div>
                        <div className="pdf-sig-right">
                            <div className="pdf-sig-line"></div>
                            <div className="pdf-sig-hint">(подпись)</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
