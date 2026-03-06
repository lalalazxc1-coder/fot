import React, { useState, useEffect } from 'react';
import { Plus, Search, Building2, Briefcase, Clock, MessageSquare, User as UserIcon } from 'lucide-react';
import { useVacancies, useCreateVacancy, useCandidates } from '../hooks/useRecruiting';
import { useFlatStructure, FlatStructureItem } from '../hooks/useStructure';
import { useUsers } from '../hooks/useAdmin';
import { usePositions } from '../hooks/usePositions';
import { Button, Input, Select } from '../components/ui-mocks';
import Modal from '../components/Modal';
import { CommentsSection } from '../components/recruiting/CommentsSection';
import { PageHeader } from '../components/shared';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
    'Draft': 'bg-slate-100 text-slate-700 border-slate-200',
    'Open': 'bg-blue-100 text-blue-700',
    'In Progress': 'bg-amber-100 text-amber-700',
    'Closed': 'bg-emerald-100 text-emerald-700',
    'Cancelled': 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
    'Draft': 'Черновик',
    'Open': 'Открыта',
    'In Progress': 'В работе',
    'Closed': 'Закрыта',
    'Cancelled': 'Отменена',
};

const priorityColors: Record<string, string> = {
    'Low': 'bg-slate-100 text-slate-700',
    'Medium': 'bg-blue-100 text-blue-700',
    'High': 'bg-amber-100 text-amber-700',
    'Critical': 'bg-red-100 text-red-700',
};

const priorityLabels: Record<string, string> = {
    'Low': 'Низкий',
    'Medium': 'Средний',
    'High': 'Срочно',
    'Critical': 'Критично',
};

export default function JobRequestsPage() {
    const { data: vacancies = [], isLoading } = useVacancies();
    const createVacancy = useCreateVacancy();
    const { data: flatStructure = [] } = useFlatStructure();
    const { data: users = [] } = useUsers();
    const { data: positions = [] } = usePositions();

    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [activeModalTab, setActiveModalTab] = useState<'discussion' | 'pipeline'>('discussion');
    const { data: candidates = [] } = useCandidates(selectedRequestId || undefined);

    const [searchParams, setSearchParams] = useSearchParams();

    // Auto-open vacancy from URL param (e.g. from notification link)
    useEffect(() => {
        const vacancyIdParam = searchParams.get('vacancy_id');
        if (vacancyIdParam && vacancies.length > 0) {
            const id = Number(vacancyIdParam);
            const found = vacancies.find(v => v.id === id);
            if (found) {
                setSelectedRequestId(id);
                setActiveModalTab('pipeline');
                // Clean up the URL param
                setSearchParams({}, { replace: true });
            }
        }
    }, [searchParams, vacancies]);

    const [newRequest, setNewRequest] = useState({
        position_name: '',
        description: '',
        department_id: '',
        planned_count: 1,
        priority: 'Medium',
        assignee_id: '',
        salary_from: '',
        salary_to: '',
    });

    const flatOptions = React.useMemo(() => {
        const map = new Map<number, FlatStructureItem & { children: any[] }>();
        const roots: any[] = [];
        flatStructure.forEach(item => map.set(item.id, { ...item, children: [] }));
        flatStructure.forEach(item => {
            const node = map.get(item.id);
            if (!node) return;
            if (item.parent_id && map.has(item.parent_id)) {
                map.get(item.parent_id)?.children.push(node);
            } else {
                roots.push(node);
            }
        });

        const flatten = (nodes: any[], depth = 0): { id: number, name: string, depth: number, type: string }[] => {
            let res: any[] = [];
            for (const n of nodes) {
                res.push({ id: n.id, name: n.name, depth, type: n.type });
                res = res.concat(flatten(n.children, depth + 1));
            }
            return res;
        };

        return flatten(roots);
    }, [flatStructure]);

    const handleCreateRequest = (e: React.FormEvent) => {
        e.preventDefault();

        const salaryFrom = newRequest.salary_from ? Number(newRequest.salary_from) : null;
        const salaryTo = newRequest.salary_to ? Number(newRequest.salary_to) : null;

        if (salaryFrom !== null && salaryTo !== null && salaryFrom > salaryTo) {
            toast.error('Минимальная зарплата не может превышать максимальную');
            return;
        }

        createVacancy.mutate({
            title: newRequest.position_name,
            department_id: Number(newRequest.department_id),
            location: '',
            planned_count: Number(newRequest.planned_count),
            priority: newRequest.priority,
            status: 'Draft',
            assignee_id: newRequest.assignee_id ? Number(newRequest.assignee_id) : null,
            position_name: newRequest.position_name,
            description: newRequest.description.trim() || null,
            salary_from: salaryFrom,
            salary_to: salaryTo,
        }, {
            onSuccess: () => {
                setCreateModalOpen(false);
                setNewRequest({
                    position_name: '',
                    description: '',
                    department_id: '',
                    planned_count: 1,
                    priority: 'Medium',
                    assignee_id: '',
                    salary_from: '',
                    salary_to: '',
                });
            }
        });
    };

    const filteredRequests = vacancies.filter(v => {
        const searchHaystack = `${v.title} ${v.position_name || ''}`.toLowerCase();
        const matchesSearch = searchHaystack.includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PageHeader
                title="Найм: Заявки на подбор"
            />

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full mb-2 bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                    <div className="relative flex-1 min-w-[200px] sm:min-w-[280px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                            placeholder="Поиск по должности..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-slate-50 border-slate-200 w-full rounded-xl text-sm h-[42px]"
                        />
                    </div>
                    <Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-50 border-slate-200 text-sm rounded-xl h-[42px]"
                    >
                        <option value="all">Все статусы</option>
                        <option value="Draft">Черновик</option>
                        <option value="Open">Открытые</option>
                        <option value="In Progress">В работе</option>
                        <option value="Closed">Закрытые</option>
                    </Select>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 h-[42px] rounded-xl font-medium shadow-lg shadow-slate-900/20 transition-all active:scale-95 whitespace-nowrap w-full sm:w-auto text-sm"
                    >
                        <Plus className="w-4 h-4" /> Создать заявку
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
                <div className="overflow-x-auto w-full custom-scrollbar pb-2">
                    <table className="w-full text-left text-sm min-w-[800px]">
                        <thead className="sticky top-0 z-20 backdrop-blur-md bg-white/85 text-slate-500 font-bold uppercase text-[10px] tracking-wider after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-slate-200/80 shadow-sm">
                            <tr>
                                <th className="px-6 py-4 font-bold">Должность</th>
                                <th className="px-6 py-4 font-bold">Подразделение</th>
                                <th className="px-6 py-4 font-bold">Исполнитель</th>
                                <th className="px-6 py-4 font-bold text-center">Мест</th>
                                <th className="px-6 py-4 font-bold">Приоритет</th>
                                <th className="px-6 py-4 font-bold">Статус</th>
                                <th className="px-4 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                                <Briefcase className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <div className="text-slate-500 font-medium mb-1 text-base">Заявки не найдены</div>
                                            <div className="text-slate-400 text-sm">Создайте новую заявку или измените параметры поиска</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map(req => {
                                    const assigneeUser = users.find(u => u.id === req.assignee_id);
                                    return (
                                        <tr
                                            key={req.id}
                                            className="group hover:bg-slate-50 cursor-pointer transition-colors"
                                            onClick={() => setSelectedRequestId(req.id)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                                                    {/* <Briefcase className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" /> */}
                                                    {req.position_name || req.title}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    создано {new Date(req.created_at).toLocaleDateString('ru-RU')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                        <Building2 className="w-4 h-4 text-slate-400" />
                                                        {(() => {
                                                            const dept = flatStructure.find(s => s.id === Number(req.department_id));
                                                            if (!dept) return `Отдел: ${req.department_id}`;
                                                            if (!dept.parent_id) return dept.name;
                                                            const parent = flatStructure.find(s => s.id === dept.parent_id);
                                                            return parent ? `${parent.name} / ${dept.name}` : dept.name;
                                                        })()}
                                                    </div>
                                                    {req.location && req.location !== 'Определяется отделом' && <div className="text-xs text-slate-500 pl-6">{req.location}</div>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {assigneeUser ? (
                                                    <div className="flex items-center gap-2">
                                                        {assigneeUser.avatar_url ? (
                                                            <img src={assigneeUser.avatar_url} alt="" className="w-6 h-6 rounded-full border border-slate-200" />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center border border-slate-300">
                                                                <UserIcon className="w-3 h-3 text-slate-500" />
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-slate-700 break-words group-hover:text-blue-600 transition-colors line-clamp-2">
                                                                {assigneeUser.full_name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm italic text-slate-400">Не назначен</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-sm">
                                                    {req.planned_count}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${priorityColors[req.priority] || priorityColors['Medium']}`}>
                                                    {priorityLabels[req.priority] || req.priority}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${statusColors[req.status] || statusColors['Draft']}`}>
                                                    {statusLabels[req.status] || req.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="p-2 rounded-lg text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors inline-block" title="Детали и чат">
                                                    <MessageSquare className="w-5 h-5" />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} title="Новая заявка на подбор">
                <form onSubmit={handleCreateRequest} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Должность (из справочника)</label>
                        <Select
                            required
                            value={newRequest.position_name}
                            onChange={e => setNewRequest({ ...newRequest, position_name: e.target.value })}
                            className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                        >
                            <option value="" disabled>Выберите должность...</option>
                            {positions.map((position) => (
                                <option key={position.id} value={position.title}>{position.title}</option>
                            ))}
                        </Select>
                        {positions.length === 0 && (
                            <p className="mt-1 text-xs text-amber-600">Справочник должностей пуст. Добавьте должности в настройках.</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Что должен делать кандидат</label>
                        <textarea
                            required
                            rows={4}
                            value={newRequest.description}
                            onChange={e => setNewRequest({ ...newRequest, description: e.target.value })}
                            placeholder="Кратко опишите обязанности и ожидания по роли"
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 focus:bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-colors resize-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Подразделение (Отдел)</label>
                        <Select
                            required
                            value={newRequest.department_id}
                            onChange={e => setNewRequest({ ...newRequest, department_id: e.target.value })}
                            className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                        >
                            <option value="" disabled>Выберите подразделение...</option>
                            {flatOptions.map(opt => (
                                <option key={opt.id} value={opt.id} className={opt.depth === 0 ? 'font-bold' : ''}>
                                    {'\u00A0\u00A0\u00A0\u00A0'.repeat(opt.depth)}
                                    {opt.depth > 0 ? '— ' : ''}{opt.name} {opt.type === 'head_office' || opt.type === 'branch' ? '(Головной/Филиал)' : ''}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Исполнитель (Опционально)</label>
                        <Select
                            value={newRequest.assignee_id}
                            onChange={e => setNewRequest({ ...newRequest, assignee_id: e.target.value })}
                            className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                        >
                            <option value="">Не назначен (Любой рекрутер)</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.full_name || u.email}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Зарплата от (опц.)</label>
                            <Input
                                type="number"
                                min="0"
                                value={newRequest.salary_from}
                                onChange={e => setNewRequest({ ...newRequest, salary_from: e.target.value })}
                                placeholder="Напр. 500000"
                                className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Зарплата до (опц.)</label>
                            <Input
                                type="number"
                                min="0"
                                value={newRequest.salary_to}
                                onChange={e => setNewRequest({ ...newRequest, salary_to: e.target.value })}
                                placeholder="Напр. 800000"
                                className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Количество мест</label>
                            <Input
                                required
                                type="number"
                                min="1"
                                value={newRequest.planned_count}
                                onChange={e => setNewRequest({ ...newRequest, planned_count: parseInt(e.target.value) || 1 })}
                                className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Приоритет</label>
                            <Select
                                value={newRequest.priority}
                                onChange={e => setNewRequest({ ...newRequest, priority: e.target.value })}
                                className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                            >
                                <option value="Low">Низкий</option>
                                <option value="Medium">Средний</option>
                                <option value="High">Срочно</option>
                                <option value="Critical">Критично</option>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                        <Button
                            type="button"
                            onClick={() => setCreateModalOpen(false)}
                            className="bg-white border text-slate-700 hover:bg-slate-50 border-slate-200 transition-colors font-medium px-5 rounded-xl shadow-sm h-[40px]"
                        >
                            Отмена
                        </Button>
                        <button
                            type="submit"
                            disabled={createVacancy.isPending}
                            className="bg-slate-900 hover:bg-slate-800 text-white min-w-[140px] font-medium transition-all active:scale-95 shadow-lg shadow-slate-900/20 rounded-xl px-5 h-[40px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {createVacancy.isPending ? 'Создание...' : 'Создать заявку'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* View Modal with Chat and Candidates */}
            <Modal isOpen={selectedRequestId !== null} onClose={() => setSelectedRequestId(null)} title="Детали заявки">
                <div className="h-[650px] flex flex-col -mx-2">
                    <div className="flex border-b border-slate-200 mb-4 px-2">
                        <button
                            onClick={() => setActiveModalTab('discussion')}
                            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeModalTab === 'discussion'
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Описание и обсуждение
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveModalTab('pipeline')}
                            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeModalTab === 'pipeline'
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <UserIcon className="w-4 h-4" />
                                Воронка кандидатов ({candidates.length})
                            </div>
                        </button>
                    </div>

                    <div className="flex-1 bg-slate-50 rounded-xl overflow-hidden border border-slate-200 shadow-inner mx-2 flex flex-col min-h-0">
                        {activeModalTab === 'discussion' && selectedRequestId && (
                            <div className="h-full flex flex-col p-2">
                                <div className="mb-2">
                                    <p className="text-sm text-slate-500 bg-white p-3 rounded-xl border border-slate-100 flex items-start gap-3 shadow-sm">
                                        <MessageSquare className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                        Здесь вы можете обсудить детали вакансии с рекрутером и другими участниками процесса подбора.
                                    </p>
                                </div>
                                <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                                    <CommentsSection targetType="vacancy" targetId={selectedRequestId} />
                                </div>
                            </div>
                        )}
                        {activeModalTab === 'pipeline' && selectedRequestId && (
                            <div className="h-full flex flex-col">
                                {candidates.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                                        <UserIcon className="w-10 h-10 opacity-20" />
                                        <p className="text-sm">Кандидатов пока нет</p>
                                        <p className="text-xs text-slate-400">Рекрутер ещё не добавил кандидатов по этой заявке</p>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                                        {candidates.map((candidate) => {
                                            const stageConfig: Record<string, { label: string; color: string }> = {
                                                'New': { label: 'Новый', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                                                'Screening': { label: 'Скрининг', color: 'bg-purple-100 text-purple-700 border-purple-200' },
                                                'Interview': { label: 'Интервью', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                                                'Offer': { label: 'Оффер', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
                                                'Hired': { label: 'Принят', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                                                'Rejected': { label: 'Отказ', color: 'bg-red-100 text-red-700 border-red-200' },
                                            };
                                            const stage = stageConfig[candidate.stage] || { label: candidate.stage, color: 'bg-slate-100 text-slate-600' };
                                            return (
                                                <div key={candidate.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                                                            {candidate.first_name[0]}{candidate.last_name[0]}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-800">{candidate.first_name} {candidate.last_name}</p>
                                                            <p className="text-xs text-slate-400">Добавлен: {candidate.created_at ? new Date(candidate.created_at).toLocaleDateString('ru-RU') : '—'}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${stage.color}`}>
                                                        {stage.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
