import React, { useState } from 'react';
import { Users, Trash2, Edit2, User as UserIcon, Loader2 } from 'lucide-react';
import Modal from '../../components/Modal';
import { useUsers, useRoles, useCreateUser, useUpdateUser, useDeleteUser, User } from '../../hooks/useAdmin';
import { useFlatStructure } from '../../hooks/useStructure';

export default function UsersPage() {
    const { data: users = [], isLoading: isUsersLoading } = useUsers();
    const { data: roles = [], isLoading: isRolesLoading } = useRoles();
    const { data: structure = [], isLoading: isStructureLoading } = useFlatStructure();

    const createUserMutation = useCreateUser();
    const updateUserMutation = useUpdateUser();
    const deleteUserMutation = useDeleteUser();

    const isSubmitting = createUserMutation.isPending || updateUserMutation.isPending || deleteUserMutation.isPending;

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        email: '',
        full_name: '',
        password: '',
        role_id: '',
        scope_branches: [] as number[],
        scope_departments: [] as number[]
    });

    const openCreateModal = () => {
        setEditingUser(null);
        setFormData({ email: '', full_name: '', password: '', role_id: '', scope_branches: [], scope_departments: [] });
        setIsModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormData({
            email: user.email,
            full_name: user.full_name,
            password: '',
            role_id: user.role_id.toString(),
            scope_branches: user.scope_branches || [],
            scope_departments: user.scope_departments || []
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            email: formData.email,
            full_name: formData.full_name,
            role_id: parseInt(formData.role_id),
            scope_branches: formData.scope_branches,
            scope_departments: formData.scope_departments,
            password: formData.password || undefined
        };

        if (editingUser) {
            await updateUserMutation.mutateAsync({ id: editingUser.id, data: payload });
        } else {
            if (!formData.password) return alert("Пароль обязателен");
            await createUserMutation.mutateAsync(payload);
        }
        setIsModalOpen(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Удалить пользователя?")) return;
        await deleteUserMutation.mutateAsync(id);
    };

    const toggleBranch = (id: number) => {
        const current = formData.scope_branches;
        if (current.includes(id)) {
            setFormData({ ...formData, scope_branches: current.filter(x => x !== id) });
        } else {
            setFormData({ ...formData, scope_branches: [...current, id] });
        }
    };

    const toggleDept = (id: number) => {
        const current = formData.scope_departments;
        if (current.includes(id)) {
            setFormData({ ...formData, scope_departments: current.filter(x => x !== id) });
        } else {
            setFormData({ ...formData, scope_departments: [...current, id] });
        }
    };

    return (
        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 animate-in fade-in duration-500">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-900 tracking-tight">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <Users className="w-6 h-6 text-slate-900" />
                        </div>
                        Пользователи
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 ml-14">Управление учетными записями</p>
                </div>
                <button
                    disabled={isUsersLoading || isRolesLoading || isStructureLoading}
                    onClick={openCreateModal}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] disabled:opacity-50"
                >
                    + Добавить пользователя
                </button>
            </div>

            {isUsersLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/80 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Пользователь</th>
                                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider hidden sm:table-cell">Email</th>
                                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Роль</th>
                                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Доступ</th>
                                <th className="px-6 py-4 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/10">
                                                <UserIcon className="w-5 h-5" />
                                            </div>
                                            <span className="font-bold text-slate-900">{u.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 hidden sm:table-cell font-medium">{u.email}</td>
                                    <td className="px-6 py-4">
                                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">{u.role_name}</span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 text-xs font-medium max-w-xs truncate" title={u.scope_unit_name}>
                                        {u.scope_unit_name}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => openEditModal(u)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(u.id)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {users.length === 0 && <p className="text-center text-slate-400 py-10 font-medium">Нет пользователей</p>}
                </div>
            )}

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingUser ? 'Редактирование пользователя' : 'Новый пользователь'}
            >
                <form onSubmit={handleSave} className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">ФИО</label>
                        <input
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:outline-none transition-all placeholder:text-slate-300"
                            required
                            placeholder="Иванов Иван Иванович"
                            value={formData.full_name}
                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Email (Логин)</label>
                        <input
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:outline-none transition-all placeholder:text-slate-300"
                            required
                            placeholder="user@example.com"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            {editingUser ? 'Пароль (оставьте пустым, чтобы не менять)' : 'Пароль'}
                        </label>
                        <input
                            type="password"
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:outline-none transition-all placeholder:text-slate-300"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            placeholder="••••••••"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Роль</label>
                        <div className="relative">
                            <select
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:outline-none bg-white appearance-none"
                                value={formData.role_id}
                                onChange={e => setFormData({ ...formData, role_id: e.target.value })}
                                required
                            >
                                <option value="">Выберите роль...</option>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Scope Config */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Доступ к подразделениям</label>
                            <p className="text-xs text-slate-400 mb-3">Выберите головной офис, филиалы или отделы</p>
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {structure
                                    .filter(u => u.type === 'head_office' || u.type === 'branch')
                                    .map(topUnit => (
                                        <div key={topUnit.id} className="space-y-1">
                                            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-2 rounded-lg transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.scope_branches.includes(topUnit.id)}
                                                    onChange={() => toggleBranch(topUnit.id)}
                                                    className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900"
                                                />
                                                <span className={`text-sm font-medium ${topUnit.type === 'head_office' ? 'text-purple-700' : 'text-slate-700'}`}>
                                                    {topUnit.type === 'head_office' ? '🏢' : '🏢'} {topUnit.name}
                                                </span>
                                            </label>

                                            {/* Show child departments/branches */}
                                            {formData.scope_branches.includes(topUnit.id) && (
                                                <div className="pl-6 space-y-1 border-l-2 border-slate-200 ml-3">
                                                    {structure
                                                        .filter(u => u.parent_id === topUnit.id)
                                                        .map(child => (
                                                            <label key={child.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.scope_departments.includes(child.id)}
                                                                    onChange={() => toggleDept(child.id)}
                                                                    className="w-3.5 h-3.5 rounded text-slate-900 focus:ring-slate-900"
                                                                />
                                                                <span className="text-sm text-slate-600">
                                                                    {child.type === 'branch' ? '🏢' : '📁'} {child.name}
                                                                </span>
                                                            </label>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                            <p className="text-xs text-slate-400 mt-2 italic">Если ничего не выбрано в дочерних подразделениях, доступен весь выбранный уровень.</p>
                        </div>
                    </div>

                    <button disabled={isSubmitting} className="w-full mt-6 bg-slate-900 text-white py-3.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Сохранение...' : (editingUser ? 'Сохранить изменения' : 'Создать пользователя')}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
