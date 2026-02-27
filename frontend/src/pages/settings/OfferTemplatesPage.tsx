import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
    Plus,
    Loader2,
    Clock,
    Gift,
    Trash2,
    Edit3,
    FileText,
    Layout,
    Users,
    Search,
    CheckCircle
} from 'lucide-react';
import Modal from '../../components/Modal';
import { toast } from 'sonner';
import { useEmployees } from '../../hooks/useEmployees';

export default function OfferTemplatesPage() {
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const initialForm = {
        name: '',
        company_name: '',
        benefits: [] as string[],
        welcome_text: 'Мы впечатлены вашим опытом и рады пригласить вас в нашу команду!',
        description_text: 'Мы заинтересованы в привлечении в штат компании таких профессионалов, как вы. Надеемся, что работа в нашей команде будет способствовать вашему профессиональному и карьерному росту.',
        theme_color: '#2563eb',
        custom_sections: [] as { title: string, content: string }[],
        probation_period: '3 месяца',
        working_hours: '09:00 - 18:00',
        lunch_break: '13:00 - 14:00',
        non_compete_text: 'Обязательное условие: Заключение договора о неконкуренции, по условиям которого Вы после увольнения в течении 3-х лет не вправе трудоустроиться в конкурентные компании осуществляющих аналогичную деятельность, за нарушение данного условия предусмотрен штраф, подлежащий выплате по первому его требованию.',
        signatories: [] as { title: string, name: string }[]
    };

    const [formData, setFormData] = useState(initialForm);
    const [isSignatorySelectOpen, setIsSignatorySelectOpen] = useState(false);
    const [signatorySearch, setSignatorySearch] = useState('');
    const [manualSignatory, setManualSignatory] = useState({ title: '', name: '' });

    const { data: templates = [], isLoading } = useQuery({
        queryKey: ['offer-templates'],
        queryFn: async () => {
            const res = await api.get('/offer-templates/');
            return res.data;
        }
    });

    const { data: searchResults = [], isLoading: isSearchLoading } = useEmployees(
        signatorySearch.length >= 2 ? signatorySearch : undefined,
        { enabled: signatorySearch.length >= 2 }
    );

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            if (editingId) {
                const res = await api.put(`/offer-templates/${editingId}`, data);
                return res.data;
            }
            const res = await api.post('/offer-templates/', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['offer-templates'] });
            setIsAddOpen(false);
            setEditingId(null);
            toast.success(editingId ? 'Шаблон обновлен' : 'Шаблон создан');
            setFormData(initialForm);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/offer-templates/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['offer-templates'] });
            toast.success('Шаблон удален');
        }
    });

    const openEdit = (template: any) => {
        setFormData({ ...initialForm, ...template });
        setEditingId(template.id);
        setIsAddOpen(true);
    };

    // Helper functions for dynamic fields
    const addSignatory = () => setIsSignatorySelectOpen(true);

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
    const removeSignatory = (idx: number) => setFormData({ ...formData, signatories: formData.signatories.filter((_, i) => i !== idx) });

    const addBenefit = () => setFormData({ ...formData, benefits: [...formData.benefits, ''] });
    const updateBenefit = (idx: number, value: string) => {
        const newBenefits = [...formData.benefits];
        newBenefits[idx] = value;
        setFormData({ ...formData, benefits: newBenefits });
    };
    const removeBenefit = (idx: number) => setFormData({ ...formData, benefits: formData.benefits.filter((_, i) => i !== idx) });

    if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center bg-white p-6 rounded-[2rem] border border-slate-200">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">Шаблоны офферов</h2>
                    <p className="text-slate-500 font-medium text-sm">Настройте варианты предложений для разных ролей или отделов</p>
                </div>
                <button
                    onClick={() => { setFormData(initialForm); setEditingId(null); setIsAddOpen(true); }}
                    className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 w-full md:w-auto"
                >
                    <Plus className="w-4 h-4" /> Новый вариант
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template: any) => (
                    <div key={template.id} className="bg-white rounded-[2rem] border border-slate-200 p-6 hover:shadow-xl hover:shadow-slate-200/40 transition-all flex flex-col group">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                <Layout className="w-6 h-6" />
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(template)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900"><Edit3 className="w-4 h-4" /></button>
                                <button onClick={() => { if (confirm('Удалить шаблон?')) deleteMutation.mutate(template.id) }} className="p-2 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>

                        <h3 className="font-black text-slate-900 text-lg mb-2">{template.name}</h3>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">{template.company_name || 'Без названия компании'}</p>

                        <div className="flex flex-wrap gap-2 mb-6">
                            <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold">{template.signatories?.length || 0} подписантов</span>
                            <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold">{template.benefits?.length || 0} льгот</span>
                        </div>

                        <button
                            onClick={() => openEdit(template)}
                            className="mt-auto w-full py-3 bg-slate-50 text-slate-600 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all"
                        >
                            Настроить данные
                        </button>
                    </div>
                ))}

                {templates.length === 0 && (
                    <div className="col-span-full py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-slate-300 mb-4 shadow-sm">
                            <Plus className="w-8 h-8" />
                        </div>
                        <h4 className="text-slate-900 font-bold mb-1">Нет созданных шаблонов</h4>
                        <p className="text-slate-400 text-sm">Создайте свой первый вариант оффера, чтобы использовать его повторно</p>
                    </div>
                )}
            </div>

            <Modal isOpen={isAddOpen} onClose={() => { setIsAddOpen(false); setEditingId(null); }} title={editingId ? "Настройка варианта" : "Новый шаблон оффера"} maxWidth="max-w-6xl">
                <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="grid grid-cols-1 md:grid-cols-3 gap-8 p-1">
                    <div className="space-y-6">
                        <section className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Название варианта</h4>
                            <input
                                placeholder="Например: Оффер для IT отдела"
                                required
                                className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-5 text-sm font-bold shadow-sm"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                            <input
                                placeholder="Юридическое название компании"
                                className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-5 text-sm"
                                value={formData.company_name}
                                onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                            />
                        </section>


                        <section className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4"><Clock className="w-3 h-3" /> График по умолчанию</h4>
                            <div className="space-y-3">
                                <input placeholder="Испытательный срок" className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-sm" value={formData.probation_period} onChange={e => setFormData({ ...formData, probation_period: e.target.value })} />
                                <div className="grid grid-cols-2 gap-2">
                                    <input placeholder="Часы работы" className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-sm" value={formData.working_hours} onChange={e => setFormData({ ...formData, working_hours: e.target.value })} />
                                    <input placeholder="Перерыв" className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-sm" value={formData.lunch_break} onChange={e => setFormData({ ...formData, lunch_break: e.target.value })} />
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="space-y-6">
                        <section className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <Gift className="w-3 h-3" /> Стандартные бенефиты
                            </h4>
                            <div className="space-y-2 mb-6 text-slate-900">
                                {formData.benefits.map((benefit, idx) => (
                                    <div key={idx} className="flex gap-2 group">
                                        <input
                                            className="flex-1 h-10 bg-white border border-slate-200 rounded-xl px-4 text-xs font-medium"
                                            placeholder="Льгота"
                                            value={benefit}
                                            onChange={e => updateBenefit(idx, e.target.value)}
                                        />
                                        <button type="button" onClick={() => removeBenefit(idx)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addBenefit} className="w-full py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-50 transition-colors">+ Добавить пункт</button>
                        </section>

                        <section className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <FileText className="w-3 h-3" /> Подписанты
                            </h4>
                            <div className="space-y-4 mb-6">
                                {formData.signatories.map((sig, idx) => (
                                    <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 relative group shadow-sm flex flex-col justify-center">
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
                            <button type="button" onClick={addSignatory} className="w-full py-3 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase hover:bg-blue-100 transition-colors shadow-sm shadow-blue-500/5">+ Добавить лицо</button>
                        </section>
                    </div>

                    <div className="space-y-6">
                        <section className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Юридические условия (Non-compete)</h4>
                            <textarea className="w-full h-40 bg-white border border-slate-200 rounded-3xl p-5 text-xs font-medium outline-none resize-none shadow-inner" value={formData.non_compete_text} onChange={e => setFormData({ ...formData, non_compete_text: e.target.value })} />
                        </section>

                        <div className="pt-10 sticky bottom-0 bg-white flex flex-col gap-4">
                            <button
                                type="submit"
                                disabled={mutation.isPending}
                                className="w-full h-16 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-slate-900/30 disabled:opacity-50"
                            >
                                {mutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                    <>{editingId ? "Сохранить шаблон" : "Создать шаблон"}</>
                                )}
                            </button>
                            <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-wider">Все изменения будут доступны при создании новых офферов</p>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Signatory Selection Modal (Shared logic with JobOffersPage) */}
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
                                        {searchResults.map((emp: any) => (
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
