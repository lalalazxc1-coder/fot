import React, { useState } from 'react';
import { Shield, Trash2, Edit2, Loader2 } from 'lucide-react';
import Modal from '../../components/Modal';
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole, Role } from '../../hooks/useAdmin';

const PERMISSION_GROUPS = [
    {
        title: 'Система, Аналитика и Песочница',
        permissions: [
            { key: 'admin_access', label: 'Полные административные права (Доступ ко всем разделам)' },
            { key: 'view_analytics', label: 'Просмотр страницы Аналитика' },
            { key: 'view_scenarios', label: 'Доступ к разделу Песочница' },
        ]
    },
    {
        title: 'ФОТ и Планирование',
        permissions: [
            { key: 'view_payroll', label: 'Просмотр главной страницы ФОТ' },
            { key: 'manage_planning', label: 'Управление ФОТ (Добавление/Редактирование/Удаление позиций)' },
            { key: 'edit_financials', label: 'Управление финансами (Редактирование ЗП/KPI/Бонусов)' },
            { key: 'view_financial_reports', label: 'Просмотр финансовых данных (Суммарные ЗП, ЗП руководителей)' },
        ]
    },
    {
        title: 'Сотрудники',
        permissions: [
            { key: 'view_employees', label: 'Просмотр базы сотрудников' },
            { key: 'add_employees', label: 'Управление сотрудниками (Добавление/Удаление/Редактирование)' },
            { key: 'manage_offers', label: 'Просмотр и редактирование Job офферов' },
        ]
    },
    {
        title: 'Аналитика Рынка (HeadHunter)',
        permissions: [
            { key: 'view_market', label: 'Просмотр раздела "Рынок"' },
            { key: 'edit_market', label: 'Управление данными рынка (Импорт загрузка/удаление)' },
        ]
    },
    {
        title: 'Структура и Справочники',
        permissions: [
            { key: 'view_structure', label: 'Просмотр орг. структуры' },
            { key: 'edit_structure', label: 'Редактирование орг. структуры (создание/перемещение отделов)' },
            { key: 'view_positions', label: 'Просмотр справочника должностей' },
            { key: 'edit_positions', label: 'Управление справочником должностей' },
        ]
    }
];

// Flat list for easy lookup
const PERMISSIONS_LIST = PERMISSION_GROUPS.flatMap(g => g.permissions);

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
        <div className="space-y-6 pb-20 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center w-full bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-slate-400" />
                        Роли и Доступы
                    </h2>
                    <p className="text-slate-500 font-medium text-[13px] mt-0.5">Настройка уровней доступа сотрудников</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 shrink-0 w-full md:w-auto"
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
                    <div key={role.id} className="bg-white border border-slate-200 p-5 rounded-2xl hover:shadow-xl hover:shadow-slate-200/40 transition-all flex flex-col group relative">
                        <div className="flex justify-between items-start mb-4">
                            <span className="font-bold text-slate-900 text-lg">{role.name}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEditModal(role)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(role.id)} className="p-2 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-auto">
                            {Object.entries(role.permissions).filter(([_, v]) => v).map(([key]) => {
                                const label = PERMISSIONS_LIST.find(p => p.key === key)?.label || key;
                                return <span key={key} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-1 rounded-lg font-bold">{label}</span>
                            })}
                            {Object.keys(role.permissions).length === 0 && <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded-lg font-bold">Нет прав</span>}
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
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-2">Название</label>
                        <input
                            className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder:text-slate-400 text-sm font-medium shadow-sm"
                            placeholder="Например: Менеджер по персоналу"
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-3">Разрешения по категориям</label>
                        <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-3 custom-scrollbar">
                            {PERMISSION_GROUPS.map((group, idx) => (
                                <div key={idx} className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">{group.title}</h4>
                                    <div className="space-y-2">
                                        {group.permissions.map(perm => (
                                            <label
                                                key={perm.key}
                                                className={`flex items-center gap-3.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${formPerms[perm.key]
                                                    ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                                                    : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className={`flex shrink-0 items-center justify-center w-5 h-5 rounded-[6px] border transition-colors ${formPerms[perm.key]
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                                                    : 'bg-white border-slate-300'
                                                    }`}>
                                                    {formPerms[perm.key] && (
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={!!formPerms[perm.key]}
                                                    onChange={() => togglePerm(perm.key)}
                                                    className="hidden" // Hiding the native checkbox
                                                />
                                                <span className={`text-[13px] leading-tight block w-full transition-colors ${formPerms[perm.key] ? 'font-semibold text-indigo-950' : 'font-medium text-slate-600'
                                                    }`}>
                                                    {perm.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        disabled={isSubmitting}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-xl shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Сохранение...
                            </>
                        ) : (
                            editingRole ? 'Сохранить изменения' : 'Создать роль'
                        )}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
