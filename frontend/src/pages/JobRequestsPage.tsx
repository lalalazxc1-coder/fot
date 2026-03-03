import React, { useState } from 'react';
import { Plus, Search, Building2, Briefcase } from 'lucide-react';
import { useVacancies, useCreateVacancy } from '../hooks/useRecruiting';
import { useFlatStructure, FlatStructureItem } from '../hooks/useStructure';
import { Button, Input, Select } from '../components/ui-mocks';
import Modal from '../components/Modal';
import { CommentsSection } from '../components/recruiting/CommentsSection';

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

export default function JobRequestsPage() {
    const { data: vacancies = [], isLoading } = useVacancies();
    const createVacancy = useCreateVacancy();
    const { data: flatStructure = [] } = useFlatStructure();

    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [newRequest, setNewRequest] = useState({
        title: '',
        department_id: '',
        planned_count: 1,
        priority: 'Medium'
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
        createVacancy.mutate({
            title: newRequest.title,
            department_id: Number(newRequest.department_id),
            location: 'Определяется отделом', // default fallback
            planned_count: Number(newRequest.planned_count),
            priority: newRequest.priority,
            status: 'Draft'
        }, {
            onSuccess: () => {
                setCreateModalOpen(false);
                setNewRequest({ title: '', department_id: '', planned_count: 1, priority: 'Medium' });
            }
        });
    };

    const filteredRequests = vacancies.filter(v =>
        v.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 border-b-2 border-slate-900/10 pb-1">Заявки на подбор</h1>
                    <p className="text-sm text-slate-500 mt-1">Создание и отслеживание статуса заявок на поиск сотрудников.</p>
                </div>
                <Button onClick={() => setCreateModalOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md rounded-xl">
                    <Plus className="w-4 h-4" />
                    Новая заявка
                </Button>
            </div>

            <div className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                {/* Header Actions */}
                <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
                    <div className="relative w-full sm:w-auto min-w-[300px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                            placeholder="Поиск по названию должности..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-white border-slate-200"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center h-64">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <Briefcase className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">Нет заявок</h3>
                        <p className="text-slate-500">Заявок на подбор персонала пока не создано.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                    <th className="px-5 py-4 whitespace-nowrap">Должность</th>
                                    <th className="px-5 py-4 whitespace-nowrap">Подразделение</th>
                                    <th className="px-5 py-4 whitespace-nowrap text-center">Количество</th>
                                    <th className="px-5 py-4 whitespace-nowrap">Приоритет</th>
                                    <th className="px-5 py-4 whitespace-nowrap">Статус</th>
                                    <th className="px-5 py-4 whitespace-nowrap text-right">Действия</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filteredRequests.map(req => (
                                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-5 py-4 font-medium text-slate-900">
                                            {req.title}
                                        </td>
                                        <td className="px-5 py-4 text-slate-600">
                                            <div className="flex items-center gap-1.5">
                                                <Building2 className="w-4 h-4 text-slate-400" />
                                                Деп: {req.department_id}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center font-medium">
                                            {req.planned_count}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-flex items-center gap-1.5 ${priorityColors[req.priority] || priorityColors['Medium']}`}>
                                                <span className={`w-2 h-2 rounded-full ${req.priority === 'Critical' ? 'bg-red-500 animate-pulse' : req.priority === 'High' ? 'bg-amber-500' : req.priority === 'Medium' ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                                                {req.priority}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-lg border flex w-fit ${statusColors[req.status] || statusColors['Draft']}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <Button
                                                onClick={() => setSelectedRequestId(req.id)}
                                                className="bg-white border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 shadow-sm"
                                            >
                                                ДЕТАЛИ И ЧАТ
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} title="Новая заявка на подбор">
                <form onSubmit={handleCreateRequest} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Название должности</label>
                        <Input required value={newRequest.title} onChange={e => setNewRequest({ ...newRequest, title: e.target.value })} placeholder="Напр. Грузчик" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Подразделение (Отдел)</label>
                        <Select required value={newRequest.department_id} onChange={e => setNewRequest({ ...newRequest, department_id: e.target.value })}>
                            <option value="" disabled>Выберите подразделение...</option>
                            {flatOptions.map(opt => (
                                <option key={opt.id} value={opt.id} className={opt.depth === 0 ? 'font-bold' : ''}>
                                    {'\u00A0\u00A0\u00A0\u00A0'.repeat(opt.depth)}
                                    {opt.depth > 0 ? '— ' : ''}{opt.name} {opt.type === 'head_office' || opt.type === 'branch' ? '(Головной/Филиал)' : ''}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Количество мест</label>
                            <Input required type="number" min="1" value={newRequest.planned_count} onChange={e => setNewRequest({ ...newRequest, planned_count: parseInt(e.target.value) })} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Приоритет</label>
                            <Select value={newRequest.priority} onChange={e => setNewRequest({ ...newRequest, priority: e.target.value })}>
                                <option value="Low">Низкий (Low)</option>
                                <option value="Medium">Средний (Medium)</option>
                                <option value="High">Срочно (High)</option>
                                <option value="Critical">Очень срочно (Critical)</option>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button type="button" onClick={() => setCreateModalOpen(false)} className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-transparent focus:ring-0 transition-colors">Отмена</Button>
                        <Button type="submit" disabled={createVacancy.isPending} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
                            {createVacancy.isPending ? 'Создание...' : 'Создать заявку'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* View Modal with Chat */}
            <Modal isOpen={selectedRequestId !== null} onClose={() => setSelectedRequestId(null)} title="Заявка и переписка">
                <div className="h-[600px] flex flex-col">
                    <div className="mb-4">
                        <p className="text-sm text-slate-600 mb-2">Здесь вы можете общаться с рекрутером по поводу этой заявки.</p>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                        {selectedRequestId && (
                            <CommentsSection targetType="vacancy" targetId={selectedRequestId} />
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
