import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
    Plus, Loader2, Trash2, Edit3, Sparkles,
    MapPin, Video, Package, Eye, Building2, ChevronDown, Users
} from 'lucide-react';
import Modal from '../../components/Modal';
import { toast } from 'sonner';
import WelcomeDashboard from '../../components/WelcomeDashboard';

interface TeamMember {
    name: string;
    role: string;
    description: string;
}

const emptyForm = () => ({
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
    const [showPreview, setShowPreview] = useState(false);

    const { data: configs = [], isLoading } = useQuery({
        queryKey: ['welcome-pages'],
        queryFn: () => api.get('/welcome-pages/').then(r => r.data),
    });

    const { data: branches = [] } = useQuery({
        queryKey: ['branches-for-welcome'],
        queryFn: () => api.get('/structure/').then(r => (r.data as any[]).filter((u: any) => u.type === 'branch')),
    });

    const mutation = useMutation({
        mutationFn: (data: any) => editingId
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

    const openEdit = (cfg: any) => {
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

    const set = (field: string, val: any) => setFormData(prev => ({ ...prev, [field]: val }));

    const updateInstruction = (i: number, val: string) => {
        const upd = [...formData.first_day_instructions];
        upd[i] = val;
        set('first_day_instructions', upd);
    };

    const removeInstruction = (i: number) =>
        set('first_day_instructions', formData.first_day_instructions.filter((_, idx) => idx !== i));

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
            <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center bg-white p-6 rounded-[2rem] border border-slate-200">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-slate-400" />
                        Welcome Pages
                    </h2>
                    <p className="text-slate-500 font-medium text-sm mt-1">
                        Настройте страницу приветствия для каждого филиала
                    </p>
                </div>
                <button
                    onClick={openNew}
                    id="btn-new-welcome-page"
                    className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 w-full md:w-auto"
                >
                    <Plus className="w-4 h-4" /> Новый конфиг
                </button>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {configs.map((cfg: any) => (
                    <div key={cfg.id} className="bg-white rounded-[2rem] border border-slate-200 p-6 flex flex-col group hover:shadow-xl hover:shadow-slate-200/40 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                <Sparkles className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(cfg)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900">
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button onClick={() => { if (confirm('Удалить?')) deleteMutation.mutate(cfg.id); }} className="p-2 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <h3 className="font-black text-slate-900 text-lg mb-1">{cfg.name}</h3>
                        {cfg.branch_name && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold mb-3">
                                <Building2 className="w-3.5 h-3.5" />
                                {cfg.branch_name}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-auto pt-3">
                            {cfg.video_url && <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"><Video className="w-3 h-3" /> Видео</span>}
                            {cfg.address && <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"><MapPin className="w-3 h-3" /> Адрес</span>}
                            {cfg.first_day_instructions?.length > 0 && <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold">{cfg.first_day_instructions.length} инстр.</span>}
                            {cfg.merch_info && <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"><Package className="w-3 h-3" /> Мерч</span>}
                            {cfg.team_members?.length > 0 && <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"><Users className="w-3 h-3" /> {cfg.team_members.length} чел.</span>}
                        </div>
                        <button
                            onClick={() => openEdit(cfg)}
                            className="mt-4 w-full py-3 bg-slate-50 text-slate-600 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all"
                        >
                            Настроить данные
                        </button>
                    </div>
                ))}

                {configs.length === 0 && (
                    <div className="col-span-full py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-slate-300 mb-4 shadow-sm">
                            <Plus className="w-8 h-8" />
                        </div>
                        <h4 className="text-slate-900 font-bold mb-1">Нет конфигов Welcome Page</h4>
                        <p className="text-slate-400 text-sm">Создайте страницу приветствия для каждого филиала</p>
                    </div>
                )}
            </div>

            {/* Edit / Create Modal */}
            <Modal isOpen={isOpen} onClose={() => { setIsOpen(false); setEditingId(null); }} title={editingId ? 'Редактировать Welcome Page' : 'Новый Welcome Page'} maxWidth="max-w-4xl">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">

                    {/* Column 1 */}
                    <div className="space-y-5">
                        <section className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100 space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Основная информация</h4>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-1 mb-1 block">Название *</label>
                                <input
                                    required
                                    placeholder="Напр.: Welcome — Алматы офис"
                                    className="w-full h-11 bg-white border border-slate-200 rounded-2xl px-4 text-sm font-bold outline-none focus:border-slate-400 shadow-sm"
                                    value={formData.name}
                                    onChange={e => set('name', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-1 mb-1 block">Филиал</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select
                                        className="w-full h-11 bg-white border border-slate-200 rounded-2xl pl-9 pr-4 text-sm outline-none appearance-none focus:border-slate-400"
                                        value={formData.branch_id ?? ''}
                                        onChange={e => set('branch_id', e.target.value ? Number(e.target.value) : null)}
                                    >
                                        <option value="">Все филиалы</option>
                                        {branches.map((b: any) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </section>

                        <section className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100 space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Контент</h4>
                            <div className="flex items-center gap-3">
                                <Video className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <input
                                    placeholder="Ссылка на видео-тур (YouTube / Vimeo)"
                                    className="flex-1 h-11 bg-white border border-slate-200 rounded-2xl px-4 text-sm outline-none focus:border-slate-400 shadow-sm"
                                    value={formData.video_url}
                                    onChange={e => set('video_url', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <input
                                    placeholder="Адрес офиса"
                                    className="flex-1 h-11 bg-white border border-slate-200 rounded-2xl px-4 text-sm outline-none focus:border-slate-400 shadow-sm"
                                    value={formData.address}
                                    onChange={e => set('address', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <input
                                    placeholder="Welcome Pack (мерч, подарки)"
                                    className="flex-1 h-11 bg-white border border-slate-200 rounded-2xl px-4 text-sm outline-none focus:border-slate-400 shadow-sm"
                                    value={formData.merch_info}
                                    onChange={e => set('merch_info', e.target.value)}
                                />
                            </div>
                        </section>

                        <section className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Инструкции для первого дня</h4>
                            <div className="space-y-2">
                                {formData.first_day_instructions.map((instr, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input
                                            className="flex-1 h-10 bg-white border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-slate-400 shadow-sm"
                                            value={instr} placeholder={`Пункт ${i + 1}`}
                                            onChange={e => updateInstruction(i, e.target.value)}
                                        />
                                        <button type="button" onClick={() => removeInstruction(i)} className="p-2 text-slate-300 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button type="button"
                                    onClick={() => set('first_day_instructions', [...formData.first_day_instructions, ''])}
                                    className="w-full py-2.5 bg-white border border-dashed border-slate-300 rounded-xl text-xs font-black text-slate-500 uppercase hover:bg-slate-100 transition-colors"
                                >
                                    + Добавить пункт
                                </button>
                            </div>
                        </section>

                        <section className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100 space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">О компании</h4>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-1 mb-1 block">Описание компании</label>
                                <textarea
                                    placeholder="Расскажите кратко о компании..."
                                    className="w-full h-20 bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm outline-none focus:border-slate-400 shadow-sm resize-none"
                                    value={formData.company_description}
                                    onChange={e => set('company_description', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-1 mb-1 block">Миссия</label>
                                <textarea
                                    placeholder="Наша миссия — ..."
                                    className="w-full h-16 bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm outline-none focus:border-slate-400 shadow-sm resize-none"
                                    value={formData.mission}
                                    onChange={e => set('mission', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-1 mb-1 block">Видение</label>
                                <textarea
                                    placeholder="Мы стремимся к ..."
                                    className="w-full h-16 bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm outline-none focus:border-slate-400 shadow-sm resize-none"
                                    value={formData.vision}
                                    onChange={e => set('vision', e.target.value)}
                                />
                            </div>
                        </section>
                    </div>

                    {/* Column 2 — Team / Org Hierarchy */}
                    <div className="space-y-5">
                        <section className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                <Users className="w-3.5 h-3.5" /> Команда и иерархия
                            </h4>
                            <p className="text-slate-400 text-xs mb-4">Кто в компании за что отвечает — кандидат увидит это на Welcome Page</p>
                            <div className="space-y-3">
                                {formData.team_members.map((member, i) => (
                                    <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2 relative group shadow-sm">
                                        <button type="button" onClick={() => removeTeamMember(i)} className="absolute top-2 right-2 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                        <input
                                            className="w-full bg-slate-50 px-4 py-2 rounded-xl text-sm font-bold text-slate-900 outline-none"
                                            placeholder="ФИО (напр. Иванов Иван)"
                                            value={member.name}
                                            onChange={e => updateTeamMember(i, 'name', e.target.value)}
                                        />
                                        <input
                                            className="w-full bg-white border border-slate-100 px-4 py-2 rounded-xl text-xs text-slate-600 outline-none"
                                            placeholder="Должность (напр. Директор по HR)"
                                            value={member.role}
                                            onChange={e => updateTeamMember(i, 'role', e.target.value)}
                                        />
                                        <input
                                            className="w-full bg-white border-b border-dashed border-slate-200 px-4 py-1 text-[11px] text-slate-500 outline-none"
                                            placeholder="За что отвечает (напр. Адаптация новых сотрудников)"
                                            value={member.description}
                                            onChange={e => updateTeamMember(i, 'description', e.target.value)}
                                        />
                                    </div>
                                ))}
                                <button type="button" onClick={addTeamMember}
                                    className="w-full py-3 bg-white border border-dashed border-slate-300 rounded-2xl text-xs font-black text-slate-500 uppercase hover:bg-slate-100 transition-colors"
                                >
                                    + Добавить сотрудника
                                </button>
                            </div>
                        </section>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
                            <button type="button" onClick={() => setShowPreview(true)}
                                className="flex items-center gap-2 px-5 py-3 bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl text-sm font-bold hover:bg-slate-100 transition-all">
                                <Eye className="w-4 h-4" /> Превью
                            </button>
                            <button type="submit" disabled={mutation.isPending}
                                className="flex-1 h-14 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-900/10 disabled:opacity-50">
                                {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingId ? 'Сохранить' : 'Создать')}
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
                    <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-[2rem] shadow-2xl" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowPreview(false)}
                            className="absolute top-4 right-4 z-10 bg-white/80 backdrop-blur text-slate-900 rounded-full w-9 h-9 flex items-center justify-center hover:bg-white text-lg font-bold shadow-lg">
                            ✕
                        </button>
                        <div className="pointer-events-none text-[10px] bg-slate-900 text-white text-center py-1.5 font-black uppercase tracking-widest rounded-t-[2rem]">
                            Превью — так видит кандидат
                        </div>
                        <WelcomeDashboard
                            candidateName="Алия Сейткали"
                            positionTitle="Ваша должность"
                            companyName={branches.find((b: any) => b.id === formData.branch_id)?.name || 'Компания'}
                            startDate={new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0]}
                            welcomeContent={{
                                video_url: formData.video_url || undefined,
                                address: formData.address || undefined,
                                first_day_instructions: formData.first_day_instructions.filter(Boolean),
                                merch_info: formData.merch_info || undefined,
                                team_members: formData.team_members.filter(m => m.name || m.role),
                                office_tour_images: formData.office_tour_images,
                                company_description: formData.company_description || undefined,
                                mission: formData.mission || undefined,
                                vision: formData.vision || undefined,
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
