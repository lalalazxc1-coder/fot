import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, Search, Briefcase, Loader2, Edit2 } from 'lucide-react';
import { usePositions, useCreatePosition, useUpdatePosition, useDeletePosition } from '../../hooks/usePositions';
import Modal from '../../components/Modal';
// import { toast } from 'sonner';

export default function PositionsPage() {
    const { user } = useOutletContext<{ user: any }>();
    const { data: positions = [], isLoading } = usePositions();
    const createMutation = useCreatePosition();
    const updateMutation = useUpdatePosition();
    const deleteMutation = useDeletePosition();

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [search, setSearch] = useState('');

    // Form State
    const [form, setForm] = useState({
        title: '',
        grade: 1
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        await createMutation.mutateAsync(form);
        setIsAddOpen(false);
        setForm({ title: '', grade: 1 });
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editId) return;
        await updateMutation.mutateAsync({ id: editId, data: form });
        setEditId(null);
        setForm({ title: '', grade: 1 });
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить должность?')) return;
        await deleteMutation.mutateAsync(id);
    };

    const filtered = positions.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase())
    );

    const canEdit = user?.role === 'Administrator' || user?.permissions?.admin_access || user?.permissions?.edit_positions;

    if (isLoading) return (
        <div className="h-64 flex justify-center items-center">
            <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        className="w-full h-10 rounded-lg border border-slate-200 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                        placeholder="Поиск должности..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {canEdit && (
                    <button
                        onClick={() => { setForm({ title: '', grade: 1 }); setIsAddOpen(true); }}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-lg shadow-slate-900/10 whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" /> Добавить
                    </button>
                )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                        <tr>
                            <th className="px-6 py-4">Название должности</th>
                            <th className="px-6 py-4 w-32 text-center">Грейд</th>
                            {canEdit && <th className="px-6 py-4 w-20"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.map(pos => (
                            <tr key={pos.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4 font-medium text-slate-900">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                            <Briefcase className="w-4 h-4" />
                                        </div>
                                        {pos.title}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                        {pos.grade}
                                    </span>
                                </td>
                                {canEdit && (
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setEditId(pos.id);
                                                    setForm({ title: pos.title, grade: pos.grade });
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(pos.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                                    Должности не найдены
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Modal */}
            <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Новая должность">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
                        <input
                            className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            required
                            placeholder="Например: Frontend Developer"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Грейд (уровень)</label>
                        <select
                            className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10 bg-white"
                            value={form.grade}
                            onChange={e => setForm({ ...form, grade: Number(e.target.value) })}
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-400 mt-1">Относительный уровень должности для расчёта вилок</p>
                    </div>
                    <button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="w-full bg-slate-900 text-white h-11 rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 mt-2 disabled:opacity-50"
                    >
                        {createMutation.isPending ? 'Сохранение...' : 'Создать'}
                    </button>
                </form>
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={!!editId} onClose={() => setEditId(null)} title="Редактирование">
                <form onSubmit={handleUpdate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
                        <input
                            className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Грейд</label>
                        <select
                            className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10 bg-white"
                            value={form.grade}
                            onChange={e => setForm({ ...form, grade: Number(e.target.value) })}
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="w-full bg-slate-900 text-white h-11 rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 mt-2 disabled:opacity-50"
                    >
                        {updateMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
