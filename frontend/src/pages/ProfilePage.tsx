import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UserRound, UploadCloud, Mail, Briefcase, Save, Loader2, Phone, Trash2, Edit, Key, EyeOff, Eye, Building, Calendar, ShieldAlert, Cake, TrendingUp, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '../lib/api';
import type { AuthUser } from '../types';
import { PageHeader } from '../components/shared/PageHeader';
import { resolveAvatarUrl } from '../utils/avatar';
import { getErrorMessage } from '../utils/api-helpers';
import { formatPhone, isValidEmail, isValidPhone, normalizePhone, validatePassword } from '../utils/validators';
import Modal from '../components/Modal';
import { useEmployees } from '../hooks/useEmployees';
import { useFlatStructure } from '../hooks/useStructure';
import { Button, Input } from '../components/ui-mocks';

type LayoutContext = {
    user: AuthUser;
    onUserUpdate: (nextUser: AuthUser) => void;
};

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

type PasswordInputProps = {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    label: string;
    error?: boolean;
    minLength?: number;
};

const PasswordInput = ({ value, onChange, label, error, minLength }: PasswordInputProps) => {
    const [show, setShow] = useState(false);
    return (
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>
            <div className="relative">
                <Input
                    type={show ? "text" : "password"}
                    required
                    value={value}
                    onChange={onChange}
                    className={`pr-10 ${error ? 'border-red-300 ring-red-200' : ''}`}
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
            {minLength && <p className="text-[10px] text-slate-400 mt-1 pl-1">Минимум {minLength} символов</p>}
        </div>
    );
};

export default function ProfilePage() {
    const { user, onUserUpdate } = useOutletContext<LayoutContext>();

    const [fullName, setFullName] = useState(user.full_name || '');
    const [jobTitle, setJobTitle] = useState(user.job_title || '');
    const [contactEmail, setContactEmail] = useState(user.contact_email || '');
    const [phone, setPhone] = useState(user.phone || '');

    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [avatarVersion, setAvatarVersion] = useState(0);

    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

    const [isPassOpen, setIsPassOpen] = useState(false);
    const [passData, setPassData] = useState({ old: '', new: '', confirm: '' });
    const [passError, setPassError] = useState('');
    const [passSuccess, setPassSuccess] = useState('');

    const { data: employees = [], isLoading: isEmployeesLoading } = useEmployees();
    const { data: structure = [] } = useFlatStructure();

    const employee = useMemo(() => {
        if (!user.employee_id) return null;
        return employees.find((e: any) => Number(e.id) === Number(user.employee_id)) || null;
    }, [user.employee_id, employees]);

    const unit = useMemo(() => {
        if (!employee) return null;
        return structure.find((u: any) => u.id === (employee.department_id || employee.branch_id || employee.org_unit_id));
    }, [employee, structure]);

    const managerName = unit?.head?.full_name || 'Не назначен';

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(val);
    };

    const initials = useMemo(() => {
        return (user.full_name || '')
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
    }, [user.full_name]);

    const avatarSrc = useMemo(() => {
        const resolved = resolveAvatarUrl(user.avatar_url);
        if (!resolved) return '';
        const separator = resolved.includes('?') ? '&' : '?';
        return `${resolved}${separator}v=${avatarVersion}`;
    }, [user.avatar_url, avatarVersion]);

    React.useEffect(() => {
        setAvatarFailed(false);
    }, [avatarSrc]);

    React.useEffect(() => {
        if (!isEditProfileOpen) {
            setFullName(user.full_name || '');
            setJobTitle(user.job_title || '');
            setContactEmail(user.contact_email || '');
            setPhone(user.phone || '');
        }
    }, [user, isEditProfileOpen]);

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = fullName.trim();
        if (!trimmedName) {
            toast.error('Имя не может быть пустым');
            return;
        }

        const emailValue = contactEmail.trim();
        const normalizedPhone = normalizePhone(phone);

        if (emailValue && !isValidEmail(emailValue)) {
            toast.error('Некорректный формат email');
            return;
        }

        if (normalizedPhone && !isValidPhone(normalizedPhone)) {
            toast.error('Некорректный формат телефона');
            return;
        }

        setIsSavingProfile(true);
        try {
            const res = await api.put('/users/me/profile', {
                full_name: trimmedName,
                job_title: jobTitle.trim() || null,
                contact_email: emailValue || null,
                phone: normalizedPhone || null,
            });
            onUserUpdate(res.data as AuthUser);
            toast.success('Профиль обновлен');
            setIsEditProfileOpen(false);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPassError('');
        setPassSuccess('');

        const passwordValidation = validatePassword(passData.new);
        if (!passwordValidation.isValid) {
            setPassError(passwordValidation.message);
            return;
        }

        if (passData.new !== passData.confirm) {
            setPassError('Новые пароли не совпадают');
            return;
        }

        try {
            await api.post('/auth/change-password', {
                old_password: passData.old,
                new_password: passData.new
            });
            setPassSuccess('Пароль успешно изменен');
            toast.success('Пароль успешно изменен');
            setTimeout(() => {
                setIsPassOpen(false);
                setPassData({ old: '', new: '', confirm: '' });
                setPassSuccess('');
            }, 1500);
        } catch (e: unknown) {
            console.error(e);
            setPassError(getErrorMessage(e));
        }
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Можно загружать только изображения');
            event.target.value = '';
            return;
        }

        if (file.size > MAX_UPLOAD_SIZE) {
            toast.error('Максимальный размер файла: 5MB');
            event.target.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setIsUploadingAvatar(true);
        try {
            const res = await api.post('/users/me/avatar', formData);
            onUserUpdate(res.data as AuthUser);
            setAvatarVersion((prev) => prev + 1);
            toast.success('Фото профиля обновлено');
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsUploadingAvatar(false);
            event.target.value = '';
        }
    };

    const handleAvatarDelete = async () => {
        if (!user.avatar_url) {
            toast.error('Фото профиля уже удалено');
            return;
        }

        setIsDeletingAvatar(true);
        try {
            const res = await api.delete('/users/me/avatar');
            onUserUpdate(res.data as AuthUser);
            setAvatarVersion((prev) => prev + 1);
            toast.success('Фото профиля удалено');
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsDeletingAvatar(false);
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <PageHeader title="Мой профиль" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                {/* ЛЕВАЯ КОЛОНКА (Профиль и Контакты) */}
                <div className="lg:col-span-1 h-full">
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 h-full flex flex-col">
                        <div className="flex flex-col items-center text-center">
                            {avatarSrc && !avatarFailed ? (
                                <img
                                    src={avatarSrc || undefined}
                                    alt={user.full_name}
                                    onError={() => setAvatarFailed(true)}
                                    className="w-24 h-24 rounded-2xl bg-white object-cover shadow-sm ring-1 ring-slate-900/5 mb-4"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-600 flex items-center justify-center text-2xl font-bold mb-4 shadow-sm ring-1 ring-slate-900/5">
                                    {initials || <UserRound className="h-8 w-8" />}
                                </div>
                            )}
                            <h1 className="text-xl font-bold text-slate-900 leading-tight">{user.full_name}</h1>
                            <p className="text-sm font-medium text-slate-500 mt-1">{user.job_title || user.role || 'Должность не указана'}</p>

                            <div className="mt-4">
                                {user.is_active !== false ?
                                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Активен</span> :
                                    <span className="text-red-700 bg-red-50 border border-red-100 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">Заблокирован</span>}
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <div className="text-sm overflow-hidden w-full">
                                    <div className="text-slate-400 text-xs uppercase tracking-wide">Корпоративный Email</div>
                                    <div className="font-medium text-slate-700 truncate">{user.contact_email || '—'}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                    <Phone className="w-4 h-4" />
                                </div>
                                <div className="text-sm overflow-hidden w-full">
                                    <div className="text-slate-400 text-xs uppercase tracking-wide">Контактный телефон</div>
                                    <div className="font-medium text-slate-700 truncate">{user.phone || '—'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-8 space-y-3 w-full">
                            <button
                                onClick={() => {
                                    setFullName(user.full_name || '');
                                    setJobTitle(user.job_title || '');
                                    setContactEmail(user.contact_email || '');
                                    setPhone(user.phone || '');
                                    setIsEditProfileOpen(true);
                                }}
                                className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                            >
                                <Edit className="h-4 w-4" /> Настройки профиля
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditProfileOpen(false);
                                    setPassData({ old: '', new: '', confirm: '' });
                                    setPassError('');
                                    setPassSuccess('');
                                    setIsPassOpen(true);
                                }}
                                className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300"
                            >
                                <Key className="h-4 w-4" /> Сменить пароль
                            </button>
                        </div>
                    </div>
                </div>

                {/* ПРАВАЯ КОЛОНКА (Орг. инфа и ЗП) */}
                <div className="lg:col-span-2 flex flex-col space-y-6 h-full">
                    {user.employee_id ? (
                        employee ? (
                            <>
                                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                                    <h2 className="text-base font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100">Рабочая информация</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                                        <div className="flex gap-3">
                                            <Building className="w-5 h-5 text-slate-400 shrink-0" />
                                            <div>
                                                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Подразделение</div>
                                                <div className="text-sm font-semibold text-slate-900 mt-0.5">{employee.branch || '-'}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <Briefcase className="w-5 h-5 text-slate-400 shrink-0" />
                                            <div>
                                                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Отдел</div>
                                                <div className="text-sm font-semibold text-slate-900 mt-0.5">{employee.department || '-'}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <UserCheck className="w-5 h-5 text-slate-400 shrink-0" />
                                            <div>
                                                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Руководитель</div>
                                                <div className="text-sm font-semibold text-slate-900 mt-0.5">{managerName}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <Calendar className="w-5 h-5 text-slate-400 shrink-0" />
                                            <div>
                                                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Дата найма</div>
                                                <div className="text-sm font-semibold text-slate-900 mt-0.5">{employee.hire_date || '-'}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <Cake className="w-5 h-5 text-slate-400 shrink-0" />
                                            <div>
                                                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Дата рождения</div>
                                                <div className="text-sm font-semibold text-slate-900 mt-0.5">{employee.dob || '-'}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <TrendingUp className="w-5 h-5 text-slate-400 shrink-0" />
                                            <div>
                                                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Посл. повышение ЗП</div>
                                                <div className="text-sm font-semibold text-slate-900 mt-0.5">{employee.last_raise_date || '-'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                                    <h2 className="text-base font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100 flex items-center justify-between">
                                        Моя компенсация
                                        <span className="text-[10px] font-normal text-slate-400 bg-slate-50 px-2 py-1 rounded-md">Строго конфиденциально</span>
                                    </h2>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Оклад</div>
                                            <div className="text-lg font-bold text-slate-900">{formatCurrency(employee.base?.net || 0)}</div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">KPI</div>
                                            <div className="text-lg font-bold text-slate-900">{formatCurrency(employee.kpi?.net || 0)}</div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Доплаты</div>
                                            <div className="text-lg font-bold text-slate-900">{formatCurrency(employee.bonus?.net || 0)}</div>
                                        </div>
                                        <div className="bg-slate-900 p-4 rounded-2xl shadow-md">
                                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Итого (на руки)</div>
                                            <div className="text-xl font-bold text-white">{formatCurrency(employee.total?.net || 0)}</div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="bg-white rounded-3xl p-5 md:p-12 flex flex-col items-center justify-center text-center shadow-sm border border-slate-200 flex-1 min-h-[300px]">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-3" />
                                <p className="text-sm text-slate-500">Синхронизация профиля сотрудника...</p>
                            </div>
                        )
                    ) : (
                        <div className="bg-white rounded-3xl p-5 md:p-6 flex flex-col items-center justify-center text-center space-y-4 shadow-sm border border-slate-200 flex-1 min-h-[300px]">
                            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-2">
                                <ShieldAlert className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Профиль не привязан к сотруднику</h3>
                            <p className="text-sm text-slate-500 max-w-sm">
                                Ваш аккаунт не связан с карточкой сотрудника, поэтому здесь не отображается рабочая информация и компенсация.
                            </p>
                            <p className="text-sm font-medium text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg">
                                Пожалуйста, обратитесь к администратору (HR) для привязки.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={isEditProfileOpen} onClose={() => !isSavingProfile && setIsEditProfileOpen(false)} title="Настройки профиля">
                <div className="space-y-6">
                    {/* Фотография */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Фото профиля</h3>
                        <div className="flex items-center gap-4">
                            {avatarSrc && !avatarFailed ? (
                                <img
                                    src={avatarSrc || undefined}
                                    className="w-16 h-16 rounded-xl object-cover shadow-sm border border-slate-200 shrink-0"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-xl bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center shadow-sm border border-slate-200 shrink-0">
                                    <UserRound className="w-8 h-8" />
                                </div>
                            )}
                            <div className="flex flex-col sm:flex-row gap-2 w-full">
                                <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 py-2.5 text-center text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white flex items-center justify-center gap-2" title="Загрузить фото">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleAvatarUpload}
                                        disabled={isUploadingAvatar}
                                    />
                                    {isUploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                                    <span className="hidden sm:inline">{isUploadingAvatar ? 'Загрузка...' : 'Выбрать новое фото'}</span>
                                </label>

                                <button
                                    type="button"
                                    onClick={handleAvatarDelete}
                                    disabled={(!user.avatar_url && !avatarSrc) || isDeletingAvatar}
                                    className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {isDeletingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    <span className="hidden sm:inline">Удалить</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-5">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">Данные профиля</h3>
                        <form onSubmit={handleProfileSave} className="space-y-4">
                            <label className="block space-y-1.5">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Отображаемое имя</span>
                                <div className="relative">
                                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                                        placeholder="Ваше имя"
                                        required
                                    />
                                </div>
                            </label>

                            <label className="block space-y-1.5">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Системная должность</span>
                                <div className="relative">
                                    <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={jobTitle}
                                        onChange={(e) => setJobTitle(e.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                                        placeholder="Например: Analyst"
                                    />
                                </div>
                            </label>

                            <label className="block space-y-1.5">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Контактный телефон</span>
                                <div className="relative">
                                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={phone}
                                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                                        placeholder="+7 700 000 00 00"
                                    />
                                </div>
                            </label>

                            <label className="block space-y-1.5">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Корпоративный Email</span>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={contactEmail}
                                        onChange={(e) => setContactEmail(e.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                                        placeholder="user@company.com"
                                    />
                                </div>
                            </label>

                            <div className="mt-6 flex justify-end pt-4 border-t border-slate-100">
                                <Button
                                    type="submit"
                                    disabled={isSavingProfile}
                                    className="bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] h-11 w-full sm:w-auto px-6"
                                >
                                    {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline-block" /> : <Save className="h-4 w-4 mr-2 inline-block" />}
                                    {isSavingProfile ? 'Сохранение...' : 'Сохранить изменения'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isPassOpen} onClose={() => setIsPassOpen(false)} title="Смена пароля">
                <form onSubmit={handleChangePassword} className="space-y-4">
                    {passError && (
                        <div className="p-3 bg-red-50 text-red-600 text-[13px] rounded-lg border border-red-100">
                            {passError}
                        </div>
                    )}
                    {passSuccess && (
                        <div className="p-3 bg-emerald-50 text-emerald-600 text-[13px] rounded-lg border border-emerald-100">
                            {passSuccess}
                        </div>
                    )}

                    <PasswordInput
                        label="Старый пароль"
                        value={passData.old}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassData({ ...passData, old: e.target.value })}
                        error={passError === 'Неверный старый пароль'}
                    />

                    <PasswordInput
                        label="Новый пароль"
                        value={passData.new}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassData({ ...passData, new: e.target.value })}
                        minLength={8}
                    />

                    <PasswordInput
                        label="Повторите новый пароль"
                        value={passData.confirm}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassData({ ...passData, confirm: e.target.value })}
                    />

                    <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] h-11 mt-2">
                        Сменить пароль
                    </Button>
                </form>
            </Modal>
        </div >
    );
}
