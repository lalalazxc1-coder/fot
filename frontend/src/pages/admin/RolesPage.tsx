import React, { useState } from 'react';
import { Shield, Trash2, Edit2, Loader2 } from 'lucide-react';
import Modal from '../../components/Modal';
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole, Role } from '../../hooks/useAdmin';

const PERMISSIONS_LIST = [
    { key: 'add_employees', label: 'Добавление и редактирование сотрудников' },
    { key: 'manage_planning', label: 'Управление ФОТ (Планирование)' },
    { key: 'edit_financials', label: 'Редактирование финансовых данных (ЗП/KPI)' },
    { key: 'admin_access', label: 'Полные административные права' },
];

export default function RolesPage() {
    const { data: roles = [], isLoading } = useRoles();

    const createRoleMutation = useCreateRole();
    const updateRoleMutation = useUpdateRole();
    const deleteRoleMutation = useDeleteRole();

    const isSubmitting = createRoleMutation.isPending || updateRoleMutation.isPending || deleteRoleMutation.isPending;

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null); // If null, we are creating

    // Form State
    const [formName, setFormName] = useState('');
    const [formPerms, setFormPerms] = useState<Record<string, boolean>>({});

    const openCreateModal = () => {
        setEditingRole(null);
        setFormName('');
        setFormPerms({});
        setIsModalOpen(true);
    };

    const openEditModal = (role: Role) => {
        setEditingRole(role);
        setFormName(role.name);
        setFormPerms({ ...role.permissions });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (editingRole) {
            // Update
            await updateRoleMutation.mutateAsync({ id: editingRole.id, data: { name: formName, permissions: formPerms } });
        } else {
            // Create
            await createRoleMutation.mutateAsync({ name: formName, permissions: formPerms });
        }
        setIsModalOpen(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Вы уверены? Это действие необратимо.")) return;
        await deleteRoleMutation.mutateAsync(id);
    };

    const togglePerm = (key: string) => {
        setFormPerms(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Shield className="w-6 h-6 text-slate-900" /> Роли и Доступы</h2>
                    <p className="text-slate-500 text-sm mt-1">Настройка уровней доступа сотрудников</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
                >
                    + Создать роль
                </button>
            </div>

            {/* List */}
            <div className="grid gap-4 md:grid-cols-2">
                {isLoading && (
                    <div className="col-span-2 flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                    </div>
                )}
                {!isLoading && roles.length === 0 && <p className="text-sm text-slate-400 col-span-2 text-center py-10">Ролей пока нет. Создайте первую.</p>}
                {!isLoading && roles.map(role => (
                    <div key={role.id} className="border border-slate-200 p-4 rounded-xl hover:shadow-md transition-shadow group relative bg-white">
                        <div className="flex justify-between items-start mb-3">
                            <span className="font-bold text-slate-800 text-lg group-hover:text-slate-900 transition-colors">{role.name}</span>
                            <div className="flex gap-2">
                                <button onClick={() => openEditModal(role)} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(role.id)} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(role.permissions).filter(([_, v]) => v).map(([key]) => {
                                const label = PERMISSIONS_LIST.find(p => p.key === key)?.label || key;
                                return <span key={key} className="text-[11px] bg-slate-50 text-slate-700 px-2 py-1 rounded-md border border-slate-200 font-medium">{label}</span>
                            })}
                            {Object.keys(role.permissions).length === 0 && <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-1 rounded">Нет прав</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingRole ? `Редактирование: ${editingRole.name}` : 'Новая роль'}
            >
                <form onSubmit={handleSave} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Название</label>
                        <input
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                            placeholder="Например: Бухгалтер"
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">Разрешения</label>
                        <div className="space-y-2">
                            {PERMISSIONS_LIST.map(perm => (
                                <label key={perm.key} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-all">
                                    <input
                                        type="checkbox"
                                        checked={!!formPerms[perm.key]}
                                        onChange={() => togglePerm(perm.key)}
                                        className="w-4 h-4 text-slate-900 rounded focus:ring-slate-500 accent-slate-900"
                                    />
                                    <span className="text-sm text-slate-700">{perm.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <button disabled={isSubmitting} className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 disabled:opacity-50">
                        {isSubmitting ? 'Сохранение...' : (editingRole ? 'Сохранить изменения' : 'Создать роль')}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
