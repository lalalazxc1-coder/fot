import React, { useState } from 'react';
import { Users, Edit2, Loader2, Ban, CheckCircle2, UploadCloud, Trash2 } from 'lucide-react';
import Modal from '../../components/Modal';
import { useUsers, useRoles, useCreateUser, useUpdateUser, useToggleBlockUser, User } from '../../hooks/useAdmin';
import { useFlatStructure } from '../../hooks/useStructure';
import { useEmployees } from '../../hooks/useEmployees';
import { formatPhone, isValidEmail, isValidPhone, normalizePhone, validatePassword } from '../../utils/validators';
import { api } from '../../lib/api';
import { resolveAvatarUrl } from '../../utils/avatar';
import { getErrorMessage } from '../../utils/api-helpers';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useDebounceValue } from 'usehooks-ts';

export default function UsersPage() {
    const queryClient = useQueryClient();
    const { data: users = [], isLoading: isUsersLoading } = useUsers();
    const { data: roles = [], isLoading: isRolesLoading } = useRoles();
    const { data: structure = [], isLoading: isStructureLoading } = useFlatStructure();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [debouncedEmployeeSearch] = useDebounceValue(employeeSearch, 300);

    // Fetch only when modal is open and search string is > 1 char
    const { data: employees = [], isLoading: isEmployeesLoading } = useEmployees(
        debouncedEmployeeSearch,
        { enabled: isModalOpen && debouncedEmployeeSearch.trim().length >= 2 }
    );

    // Only display search results if user actually typed something
    const displayEmployees = debouncedEmployeeSearch.trim().length >= 2 ? employees : [];

    const createUserMutation = useCreateUser();
    const updateUserMutation = useUpdateUser();
    const toggleBlockMutation = useToggleBlockUser();

    const isSubmitting = createUserMutation.isPending || updateUserMutation.isPending || toggleBlockMutation.isPending;

    // Modal State
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isAvatarUploading, setIsAvatarUploading] = useState(false);
    const [isAvatarDeleting, setIsAvatarDeleting] = useState(false);
    const [avatarVersion, setAvatarVersion] = useState(0);

    // Form State
    const [formData, setFormData] = useState({
        email: '',
        contact_email: '',
        phone: '',
        full_name: '',
        job_title: '',
        password: '',
        role_id: '',
        employee_id: '' as string | number,
        scope_branches: [] as number[],
        scope_departments: [] as number[],
        is_active: true
    });
    const [formError, setFormError] = useState('');

    const openCreateModal = () => {
        setEditingUser(null);
        setFormError('');
        setAvatarVersion(0);
        setFormData({ email: '', contact_email: '', phone: '', full_name: '', job_title: '', password: '', role_id: '', employee_id: '', scope_branches: [], scope_departments: [], is_active: true });
        setEmployeeSearch('');
        setIsModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEmployeeSearch(user.employee_name || '');
        setEditingUser(user);
        setFormError('');
        setAvatarVersion(0);
        setFormData({
            email: user.email,
            contact_email: user.contact_email || '',
            phone: user.phone || '',
            full_name: user.full_name,
            job_title: user.job_title || '',
            password: '',
            role_id: user.role_id.toString(),
            employee_id: user.employee_id || '',
            scope_branches: user.scope_branches || [],
            scope_departments: user.scope_departments || [],
            is_active: user.is_active
        });
        setIsModalOpen(true);
    };

    const editableAvatarSrc = editingUser?.avatar_url
        ? `${resolveAvatarUrl(editingUser.avatar_url)}${resolveAvatarUrl(editingUser.avatar_url).includes('?') ? '&' : '?'}v=${avatarVersion}`
        : '';

    const initials = (name: string): string =>
        name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

    const handleAdminAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!editingUser) return;
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setIsAvatarUploading(true);
        try {
            const res = await api.post(`/users/${editingUser.id}/avatar`, formData);
            setEditingUser({ ...editingUser, avatar_url: res.data.avatar_url });
            setAvatarVersion((prev) => prev + 1);
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Фото профиля обновлено');
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsAvatarUploading(false);
            event.target.value = '';
        }
    };

    const handleAdminAvatarDelete = async () => {
        if (!editingUser) return;
        setIsAvatarDeleting(true);
        try {
            await api.delete(`/users/${editingUser.id}/avatar`);
            setEditingUser({ ...editingUser, avatar_url: null });
            setAvatarVersion((prev) => prev + 1);
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Фото профиля удалено');
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsAvatarDeleting(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (!editingUser && !formData.password) {
            setFormError('Пароль обязателен');
            return;
        }

        if (formData.password) {
            const passwordValidation = validatePassword(formData.password);
            if (!passwordValidation.isValid) {
                setFormError(passwordValidation.message);
                return;
            }
        }

        const contactEmail = formData.contact_email.trim();
        const normalizedPhone = normalizePhone(formData.phone);

        if (contactEmail && !isValidEmail(contactEmail)) {
            setFormError('Некорректный формат email');
            return;
        }

        if (normalizedPhone && !isValidPhone(normalizedPhone)) {
            setFormError('Некорректный формат телефона');
            return;
        }

        const payload = {
            email: formData.email,
            contact_email: contactEmail || undefined,
            phone: normalizedPhone || undefined,
            full_name: formData.full_name,
            job_title: formData.job_title || undefined,
            role_id: parseInt(formData.role_id),
            employee_id: formData.employee_id ? Number(formData.employee_id) : null,
            scope_branches: formData.scope_branches,
            scope_departments: formData.scope_departments,
            is_active: formData.is_active,
            password: formData.password || undefined
        };

        if (editingUser) {
            await updateUserMutation.mutateAsync({ id: editingUser.id, data: payload });
        } else {
            await createUserMutation.mutateAsync(payload);
        }
        setIsModalOpen(false);
    };

    const handleToggleBlock = async (user: User) => {
        if (!confirm(user.is_active ? `Заблокировать пользователя ${user.full_name}?` : `Разблокировать пользователя ${user.full_name}?`)) return;
        await toggleBlockMutation.mutateAsync(user.id);
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
            <div className="mb-8 flex flex-col md:flex-row gap-4 justify-between md:items-center">
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
                    disabled={isUsersLoading || isRolesLoading || isStructureLoading || isEmployeesLoading}
                    onClick={openCreateModal}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] disabled:opacity-50 w-full md:w-auto text-center"
                >
                    + Добавить пользователя
                </button>
            </div>

            {isUsersLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/60 shadow-sm custom-scrollbar">
                    <table className="w-full text-left text-sm min-w-[700px]">
                        <thead className="sticky top-0 z-20 backdrop-blur-md bg-white/85 text-slate-500 font-bold uppercase text-[10px] tracking-wider after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-slate-200/80 shadow-sm">
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
                                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/10 overflow-hidden">
                                                {u.avatar_url ? (
                                                    <img src={resolveAvatarUrl(u.avatar_url)} alt={u.full_name} className="w-10 h-10 object-cover" />
                                                ) : (
                                                    <span className="text-xs font-bold">{initials(u.full_name)}</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900">{u.full_name}</div>
                                                {(u.contact_email || u.phone || u.job_title || u.employee_name) && (
                                                    <div className="text-xs text-slate-500 mt-0.5">
                                                        {u.job_title || 'Без должности'}
                                                        {u.phone ? ` · ${u.phone}` : ''}
                                                        {u.employee_name ? ` · 🔗 ${u.employee_name}` : ''}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 hidden sm:table-cell font-medium">{u.email}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">{u.role_name}</span>
                                            {!u.is_active && <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold border border-red-200 flex items-center gap-1"><Ban className="w-3 h-3" /> Заблокирован</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 text-xs font-medium max-w-xs truncate" title={u.scope_unit_name}>
                                        {u.scope_unit_name}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => openEditModal(u)} title="Редактировать" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                                            <button
                                                onClick={() => handleToggleBlock(u)}
                                                title={u.is_active ? "Заблокировать" : "Разблокировать"}
                                                className={`p-2 rounded-lg transition-all ${u.is_active ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-red-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
                                            >
                                                {u.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                            </button>
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
                    {formError && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {formError}
                        </div>
                    )}
                    {editingUser && (
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                            <div className="flex items-center gap-4">
                                {editableAvatarSrc ? (
                                    <img
                                        src={editableAvatarSrc}
                                        alt={editingUser.full_name}
                                        className="w-14 h-14 rounded-xl object-cover border border-slate-200"
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                                        {initials(editingUser.full_name)}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm cursor-pointer hover:bg-slate-50">
                                        <UploadCloud className="w-4 h-4" />
                                        {isAvatarUploading ? 'Загрузка...' : 'Заменить фото'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            disabled={isAvatarUploading}
                                            onChange={handleAdminAvatarUpload}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAdminAvatarDelete}
                                        disabled={!editingUser.avatar_url || isAvatarDeleting}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm disabled:opacity-60"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        {isAvatarDeleting ? 'Удаление...' : 'Удалить фото'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

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
                        <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                        <input
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:outline-none transition-all placeholder:text-slate-300"
                            placeholder="user@company.com"
                            value={formData.contact_email}
                            onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Телефон</label>
                        <input
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:outline-none transition-all placeholder:text-slate-300"
                            placeholder="+7 700 000 00 00"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Системная должность</label>
                        <input
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:outline-none transition-all placeholder:text-slate-300"
                            placeholder="HR Business Partner"
                            value={formData.job_title}
                            onChange={e => setFormData({ ...formData, job_title: e.target.value })}
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

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Привязка к сотруднику (Опционально)</label>
                        <div className="relative border border-slate-200 rounded-xl bg-slate-50 p-3">
                            <input
                                type="text"
                                placeholder="Поиск по ФИО или должности..."
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:outline-none mb-3 bg-white"
                                value={employeeSearch}
                                onChange={e => setEmployeeSearch(e.target.value)}
                            />
                            {isEmployeesLoading ? (
                                <div className="text-xs text-slate-400">Поиск...</div>
                            ) : (
                                <select
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:outline-none bg-white appearance-none"
                                    value={formData.employee_id || ''}
                                    onChange={e => setFormData({ ...formData, employee_id: e.target.value })}
                                >
                                    <option value="">Не привязывать</option>

                                    {displayEmployees.map(e => (
                                        <option key={e.id} value={e.id}>{e.full_name} ({e.position || 'Без должности'})</option>
                                    ))}

                                    {/* Show the currently selected employee in form data if it's not in the search results */}
                                    {formData.employee_id && !displayEmployees.some(e => e.id === Number(formData.employee_id)) && (
                                        <option value={formData.employee_id}>
                                            {editingUser?.employee_id === Number(formData.employee_id)
                                                ? `${editingUser.employee_name} (Текущий)`
                                                : `Выбранный сотрудник (ID: ${formData.employee_id})`}
                                        </option>
                                    )}

                                    {debouncedEmployeeSearch.trim().length > 0 && debouncedEmployeeSearch.trim().length < 2 && (
                                        <option disabled value="prompt">Введите минимум 2 символа для поиска...</option>
                                    )}

                                    {debouncedEmployeeSearch.trim().length >= 2 && displayEmployees.length === 0 && !isEmployeesLoading && (
                                        <option disabled value="not_found">Сотрудники не найдены</option>
                                    )}
                                </select>
                            )}
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

                    {editingUser && (
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900"
                                />
                                Активен
                            </label>
                            {!formData.is_active && <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-md">Пользователь заблокирован</span>}
                        </div>
                    )}

                    <button disabled={isSubmitting} className="w-full mt-6 bg-slate-900 text-white py-3.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Сохранение...' : (editingUser ? 'Сохранить изменения' : 'Создать пользователя')}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
