import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
    Plus, Loader2, Trash2, Edit3, Sparkles,
    MapPin, Video, Package, Users,
    Clock, CheckCircle
} from 'lucide-react';
import Modal from '../../components/Modal';
import { toast } from 'sonner';

interface TeamMember {
    name: string;
    role: string;
    description: string;
}

interface WelcomePageForm {
    name: string;
    branch_id: number | null;
    video_url: string;
    address: string;
    first_day_instructions: string[];
    merch_info: string;
    team_members: TeamMember[];
    office_tour_images: string[];
    company_description: string | null;
    mission: string | null;
    vision: string | null;
}

interface WelcomePageConfig extends WelcomePageForm {
    id: number;
    branch_name?: string;
}

const emptyForm = (): WelcomePageForm => ({
    name: '',
    branch_id: null as number | null,
    video_url: '',
    address: '',
    first_day_instructions: [] as string[],
    merch_info: '',
    team_members: [] as TeamMember[],
    office_tour_images: [] as string[],
    company_description: '',
    mission: '',
    vision: '',
});

export default function WelcomePagesPage() {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState(emptyForm());

    // Instructions Modal State
    const [isInstructionModalOpen, setIsInstructionModalOpen] = useState(false);
    const [tempInstruction, setTempInstruction] = useState('');
    const [editingInstructionIdx, setEditingInstructionIdx] = useState<number | null>(null);


    const { data: configs = [], isLoading } = useQuery<WelcomePageConfig[]>({
        queryKey: ['welcome-pages'],
        queryFn: async () => {
            const response = await api.get<WelcomePageConfig[]>('/welcome-pages/');
            return response.data;
        },
    });



    const mutation = useMutation({
        mutationFn: (data: WelcomePageForm) => editingId
            ? api.put(`/welcome-pages/${editingId}`, data)
            : api.post('/welcome-pages/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['welcome-pages'] });
            setIsOpen(false);
            setEditingId(null);
            toast.success(editingId ? 'Конфиг обновлён' : 'Конфиг создан');
        },
        onError: () => toast.error('Ошибка сохранения'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/welcome-pages/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['welcome-pages'] });
            toast.success('Удалено');
        },
    });

    const openEdit = (cfg: WelcomePageConfig) => {
        setFormData({
            name: cfg.name || '',
            branch_id: cfg.branch_id || null,
            video_url: cfg.video_url || '',
            address: cfg.address || '',
            first_day_instructions: cfg.first_day_instructions || [],
            merch_info: cfg.merch_info || '',
            team_members: cfg.team_members || [],
            office_tour_images: cfg.office_tour_images || [],
            company_description: cfg.company_description || '',
            mission: cfg.mission || '',
            vision: cfg.vision || '',
        });
        setEditingId(cfg.id);
        setIsOpen(true);
    };

    const openNew = () => {
        setFormData(emptyForm());
        setEditingId(null);
        setIsOpen(true);
    };

    const set = <K extends keyof WelcomePageForm>(field: K, val: WelcomePageForm[K]) => {
        setFormData(prev => ({ ...prev, [field]: val }));
    };

    const removeInstruction = (i: number) =>
        set('first_day_instructions', formData.first_day_instructions.filter((_, idx) => idx !== i));

    const finishInstruction = () => {
        if (!tempInstruction.trim()) return;

        const upd = [...formData.first_day_instructions];
        if (editingInstructionIdx !== null) {
            upd[editingInstructionIdx] = tempInstruction.trim();
        } else {
            upd.push(tempInstruction.trim());
        }

        set('first_day_instructions', upd);
        setIsInstructionModalOpen(false);
        setTempInstruction('');
        setEditingInstructionIdx(null);
    };

    const openInstructionEdit = (idx: number) => {
        setTempInstruction(formData.first_day_instructions[idx]);
        setEditingInstructionIdx(idx);
        setIsInstructionModalOpen(true);
    };

    // Team members helpers
    const addTeamMember = () => set('team_members', [...formData.team_members, { name: '', role: '', description: '' }]);
    const updateTeamMember = (i: number, field: keyof TeamMember, val: string) => {
        const upd = [...formData.team_members];
        upd[i] = { ...upd[i], [field]: val };
        set('team_members', upd);
    };
    const removeTeamMember = (i: number) => set('team_members', formData.team_members.filter((_, idx) => idx !== i));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...formData,
            first_day_instructions: formData.first_day_instructions.filter(Boolean),
            team_members: formData.team_members.filter(m => m.name || m.role),
            company_description: formData.company_description || null,
            mission: formData.mission || null,
            vision: formData.vision || null,
        };
        mutation.mutate(payload);
    };

    if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center w-full bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-slate-400" />
                        Welcome Pages
                    </h2>
                    <p className="text-slate-500 font-medium text-[13px] mt-0.5">
                        Настройте страницу приветствия для каждого филиала
                    </p>
                </div>
                <button
                    onClick={openNew}
                    id="btn-new-welcome-page"
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 shrink-0 w-full md:w-auto"
                >
                    <Plus className="w-4 h-4" /> Новый конфиг
                </button>
            </div>

            {/* List */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="hidden md:grid grid-cols-[3fr_2fr_100px] gap-2 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <span>Название страницы</span>
                    <span>Наполнение</span>
                    <span className="text-right">Действия</span>
                </div>

                {configs.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                        Нет конфигов Welcome Page. Создайте первый конфиг.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {configs.map((cfg) => (
                            <div key={cfg.id} className="grid grid-cols-1 md:grid-cols-[3fr_2fr_100px] gap-2 px-5 py-3 items-center hover:bg-slate-50/50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:text-purple-600 group-hover:bg-purple-50 transition-colors">
                                        <Sparkles className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-900 truncate">{cfg.name}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {cfg.first_day_instructions?.length > 0 && <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg text-[10px] font-bold">{cfg.first_day_instructions.length} инстр.</span>}
                                    {cfg.team_members?.length > 0 && <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg text-[10px] font-bold">{cfg.team_members.length} чел.</span>}
                                    {!cfg.first_day_instructions?.length && !cfg.team_members?.length && <span className="text-xs text-slate-400">Пусто</span>}
                                </div>

                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEdit(cfg)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Настроить"><Edit3 className="w-4 h-4" /></button>
                                    <button onClick={() => { if (confirm('Удалить?')) deleteMutation.mutate(cfg.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Удалить"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit / Create Modal */}
            <Modal isOpen={isOpen} onClose={() => { setIsOpen(false); setEditingId(null); }} title={editingId ? 'Редактировать Welcome Page' : 'Новый Welcome Page'} maxWidth="max-w-4xl">
                <form onSubmit={handleSubmit} className="space-y-4 p-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        {/* Column 1 - Top */}
                        <div className="space-y-4">
                            <section className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Основная информация</h4>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase px-1 mb-1 block">Название *</label>
                                    <input
                                        required
                                        placeholder="Напр.: Welcome — Алматы офис"
                                        className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:border-slate-400 shadow-sm"
                                        value={formData.name}
                                        onChange={e => set('name', e.target.value)}
                                    />
                                </div>
                            </section>

                            <section className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Контент</h4>
                                <div className="flex items-center gap-3">
                                    <Video className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <input
                                        placeholder="Ссылка на видео-тур (YouTube / Vimeo)"
                                        className="flex-1 h-10 bg-white border border-slate-200 rounded-xl px-4 text-sm outline-none focus:border-slate-400 shadow-sm"
                                        value={formData.video_url}
                                        onChange={e => set('video_url', e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <input
                                        placeholder="Адрес офиса"
                                        className="flex-1 h-10 bg-white border border-slate-200 rounded-xl px-4 text-sm outline-none focus:border-slate-400 shadow-sm"
                                        value={formData.address}
                                        onChange={e => set('address', e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <input
                                        placeholder="Welcome Pack (мерч, подарки)"
                                        className="flex-1 h-10 bg-white border border-slate-200 rounded-xl px-4 text-sm outline-none focus:border-slate-400 shadow-sm"
                                        value={formData.merch_info}
                                        onChange={e => set('merch_info', e.target.value)}
                                    />
                                </div>
                            </section>

                            <section className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">О компании</h4>
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase px-1 mb-1 block">Описание компании</label>
                                        <textarea
                                            placeholder="Расскажите кратко о компании..."
                                            className="w-full h-16 bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none focus:border-slate-400 shadow-sm resize-none"
                                            value={formData.company_description || ''}
                                            onChange={e => set('company_description', e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase px-1 mb-1 block">Миссия</label>
                                            <textarea
                                                placeholder="..."
                                                className="w-full h-14 bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none focus:border-slate-400 shadow-sm resize-none"
                                                value={formData.mission || ''}
                                                onChange={e => set('mission', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase px-1 mb-1 block">Видение</label>
                                            <textarea
                                                placeholder="..."
                                                className="w-full h-14 bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none focus:border-slate-400 shadow-sm resize-none"
                                                value={formData.vision || ''}
                                                onChange={e => set('vision', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Column 2 - Top */}
                        <div className="space-y-4">
                            <section className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5" /> Команда и иерархия
                                </h4>
                                <p className="text-slate-400 text-[10px] mb-3">Кто в компании за что отвечает</p>
                                <div className="space-y-2">
                                    {formData.team_members.map((member, i) => (
                                        <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 relative group shadow-sm">
                                            <button type="button" onClick={() => removeTeamMember(i)} className="absolute top-2 right-2 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                            <input
                                                className="w-full bg-slate-50 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-900 outline-none"
                                                placeholder="ФИО"
                                                value={member.name}
                                                onChange={e => updateTeamMember(i, 'name', e.target.value)}
                                            />
                                            <input
                                                className="w-full bg-white border border-slate-100 px-3 py-1.5 rounded-lg text-xs text-slate-600 outline-none"
                                                placeholder="Должность"
                                                value={member.role}
                                                onChange={e => updateTeamMember(i, 'role', e.target.value)}
                                            />
                                            <input
                                                className="w-full bg-white border-b border-dashed border-slate-200 px-3 py-1 text-[11px] text-slate-500 outline-none"
                                                placeholder="Зона ответственности"
                                                value={member.description}
                                                onChange={e => updateTeamMember(i, 'description', e.target.value)}
                                            />
                                        </div>
                                    ))}
                                    <button type="button" onClick={addTeamMember}
                                        className="w-full py-2 bg-white border border-dashed border-slate-300 rounded-xl text-xs font-black text-slate-500 uppercase hover:bg-slate-100 transition-colors"
                                    >
                                        + Добавить руководителя
                                    </button>
                                </div>
                            </section>

                            <section className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Инструкции первого дня</h4>
                                        <p className="text-[10px] text-slate-400 font-medium">Пошаговый план для новичка</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setTempInstruction(''); setEditingInstructionIdx(null); setIsInstructionModalOpen(true); }}
                                        className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar min-h-[100px]">
                                    {formData.first_day_instructions.map((instr, i) => (
                                        <div key={i} className="group relative bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-slate-400 transition-all">
                                            <div className="flex items-start gap-3 pr-14">
                                                <div className="w-6 h-6 bg-slate-50 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400 flex-shrink-0 border border-slate-100">
                                                    {i + 1}
                                                </div>
                                                <p className="text-xs font-semibold text-slate-700 leading-relaxed line-clamp-2">{instr}</p>
                                            </div>
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    type="button"
                                                    onClick={() => openInstructionEdit(i)}
                                                    className="p-1.5 hover:bg-slate-50 text-slate-300 hover:text-blue-500 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeInstruction(i)}
                                                    className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {formData.first_day_instructions.length === 0 && (
                                        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-200 mb-3 shadow-sm border border-slate-100">
                                                <Clock className="w-6 h-6" />
                                            </div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-loose">
                                                Список пуст<br />
                                                <span className="opacity-40 font-bold">Нажмите +, чтобы добавить инструкцию</span>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Actions - Full Width Bottom */}
                    <div className="pt-2 sticky bottom-0 bg-white">
                        <button type="submit" disabled={mutation.isPending}
                            className="w-full h-12 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-900/10 disabled:opacity-50">
                            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingId ? 'Сохранить изменения' : 'Создать страницу')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Instruction Editor Modal */}
            <Modal isOpen={isInstructionModalOpen} onClose={() => { setIsInstructionModalOpen(false); setTempInstruction(''); setEditingInstructionIdx(null); }} title={editingInstructionIdx !== null ? "Редактировать пункт" : "Новая инструкция"} maxWidth="max-w-xl">
                <div className="space-y-6 pt-2">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Edit3 className="w-4 h-4" />
                            <h5 className="text-[10px] font-black uppercase tracking-widest leading-none">Текст инструкции</h5>
                        </div>
                        <textarea
                            autoFocus
                            placeholder="Например: Подойдите к ресепшн и спросите HR-менеджера Марию..."
                            className="w-full h-48 bg-slate-50 border border-slate-200 rounded-[2rem] p-6 text-sm font-medium leading-relaxed outline-none focus:bg-white focus:border-slate-400 transition-all shadow-inner"
                            value={tempInstruction}
                            onChange={e => setTempInstruction(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-4">
                        <button
                            type="button"
                            disabled={!tempInstruction.trim()}
                            onClick={finishInstruction}
                            className="flex-1 h-14 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 disabled:opacity-30 disabled:grayscale"
                        >
                            <CheckCircle className="w-4 h-4" />
                            {editingInstructionIdx !== null ? "Обновить данные" : "Добавить в список"}
                        </button>
                    </div>
                    <p className="text-center text-[9px] text-slate-300 font-bold uppercase tracking-widest">Текст будет виден кандидату на Welcome Page</p>
                </div>
            </Modal>
        </div>
    );
}
