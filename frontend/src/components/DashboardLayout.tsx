import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteAllNotifications } from '../hooks/useAdmin';
import { Trash2, CheckCircle, Bell, Briefcase, Settings, LogOut, Key, Eye, EyeOff, User as UserIcon, Shield } from 'lucide-react';
import Modal from './Modal';
import { Button, Input } from './ui-mocks';
import { api } from '../lib/api';

type User = {
    full_name: string;
    role: string;
    permissions: Record<string, boolean>;
};

const PasswordInput = ({ value, onChange, label, error, minLength }: any) => {
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

export default function DashboardLayout({ user, onLogout }: { user: User; onLogout: () => void }) {
    const navigate = useNavigate();
    const hasAdminAccess = user.role === 'Administrator' || user.permissions?.admin_access;
    const canViewMarket = hasAdminAccess || user.permissions?.view_market;

    const hasSettingsAccess = hasAdminAccess ||
        user.permissions?.view_structure ||
        user.permissions?.edit_structure ||
        user.permissions?.view_positions ||
        user.permissions?.edit_positions;

    const [isPassOpen, setIsPassOpen] = useState(false);
    const [passData, setPassData] = useState({ old: '', new: '', confirm: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const openModal = () => {
        setIsPassOpen(true);
        setError('');
        setSuccess('');
        setPassData({ old: '', new: '', confirm: '' });
    };

    // Notifications
    const { data: notifications = [] } = useNotifications();
    const markRead = useMarkNotificationRead();
    const markAllRead = useMarkAllNotificationsRead();
    const deleteAll = useDeleteAllNotifications();
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    const unreadCount = notifications.filter((n: any) => !n.is_read).length;

    const handleNotifClick = (n: any) => {
        if (!n.is_read) markRead.mutate(n.id);
        if (n.link) navigate(n.link);
        setIsNotifOpen(false);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (passData.new.length < 8) {
            setError('Пароль должен содержать минимум 8 символов');
            return;
        }

        if (passData.new !== passData.confirm) {
            setError('Новые пароли не совпадают');
            return;
        }

        try {
            await api.post('/auth/change-password', {
                old_password: passData.old,
                new_password: passData.new
            });
            setSuccess('Пароль успешно изменен');
            setTimeout(() => setIsPassOpen(false), 1500);
        } catch (e: any) {
            console.error(e);
            let msg = e.message;
            try {
                // Try to parse if the error message is a JSON string (from api.ts)
                const parsed = JSON.parse(msg);
                if (parsed.detail) {
                    msg = parsed.detail;
                }
            } catch {
                // Not JSON, keep original message
            }
            setError(msg);
        }
    };

    return (
        <div className="min-h-screen font-sans text-slate-900 bg-slate-100/80 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-200/50 to-slate-200/80">
            {/* Header */}
            <header className="sticky top-0 z-30 w-full bg-white/80 border-b border-slate-200 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

                    {/* Left: Logo & Nav */}
                    <div className="flex items-center gap-10">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                            <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
                                <Briefcase className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-900 text-sm leading-none tracking-tight">УПРАВЛЕНИЕ</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Система ФОТ</span>
                            </div>
                        </Link>

                        {/* Divider */}
                        <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

                        {/* Navigation */}
                        <nav className="hidden md:flex items-center gap-1">
                            <NavLink
                                to="/analytics"
                                className={({ isActive }) => `px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${isActive ? 'text-slate-900 bg-slate-200/50 shadow-inner' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                            >
                                Аналитика
                            </NavLink>
                            <NavLink
                                to="/payroll"
                                className={({ isActive }) => `px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${isActive ? 'text-slate-900 bg-slate-200/50 shadow-inner' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                            >
                                ФОТ
                            </NavLink>
                            <NavLink
                                to="/employees"
                                className={({ isActive }) => `px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${isActive ? 'text-slate-900 bg-slate-200/50 shadow-inner' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                            >
                                Сотрудники
                            </NavLink>
                            <NavLink
                                to="/requests"
                                className={({ isActive }) => `px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${isActive ? 'text-slate-900 bg-slate-200/50 shadow-inner' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                            >
                                Заявки
                            </NavLink>
                            {canViewMarket && (
                                <NavLink
                                    to="/market"
                                    className={({ isActive }) => `px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${isActive ? 'text-slate-900 bg-slate-200/50 shadow-inner' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                                >
                                    Рынок
                                </NavLink>
                            )}
                        </nav>
                    </div>

                    {/* Right: User Profile */}
                    <div className="flex items-center gap-4">

                        {/* Notify Bell */}
                        <div className="relative">
                            <button
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                className="p-2 text-slate-400 hover:text-slate-900 rounded-lg relative"
                            >
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
                                )}
                            </button>

                            {isNotifOpen && (
                                <div
                                    className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200"
                                    onMouseLeave={() => setIsNotifOpen(false)}
                                >
                                    <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-slate-700">Уведомления</span>
                                            {unreadCount > 0 && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-bold">{unreadCount}</span>}
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => markAllRead.mutate()}
                                                className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-emerald-50"
                                                title="Прочитать все"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => deleteAll.mutate()}
                                                className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                                                title="Удалить все"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-8 text-center text-slate-400 text-sm">Нет уведомлений</div>
                                        ) : (
                                            notifications.map((n: any) => (
                                                <div
                                                    key={n.id}
                                                    onClick={() => handleNotifClick(n)}
                                                    className={`p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${!n.is_read ? 'bg-blue-50/50' : ''}`}
                                                >
                                                    <div className="text-sm text-slate-800">{n.message}</div>
                                                    <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                                                        <span>{n.created_at}</span>
                                                        {!n.is_read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {hasSettingsAccess && (
                            <button
                                onClick={() => navigate('/settings')}
                                title="Настройки компании"
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        )}

                        {hasAdminAccess && (
                            <button
                                onClick={() => navigate('/admin')}
                                title="Панель администратора (Пользователи/Роли)"
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                                <Shield className="w-5 h-5" />
                            </button>
                        )}

                        <div className="h-6 w-px bg-slate-200 mx-1"></div>

                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <div className="text-sm font-bold text-slate-800 leading-tight">{user.full_name}</div>
                                <div className="text-xs text-slate-500 font-medium">{user.role}</div>
                            </div>
                            <div className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-900/10 cursor-default">
                                <UserIcon className="w-5 h-5" />
                            </div>

                            <button
                                onClick={openModal}
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
                                title="Сменить пароль"
                            >
                                <Key className="w-5 h-5" />
                            </button>

                            <button
                                onClick={onLogout}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                                title="Выйти"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                <Outlet context={{ user }} />
            </main>

            <Modal isOpen={isPassOpen} onClose={() => setIsPassOpen(false)} title="Смена пароля">
                <form onSubmit={handleChangePassword} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-lg border border-emerald-100">
                            {success}
                        </div>
                    )}

                    <PasswordInput
                        label="Старый пароль"
                        value={passData.old}
                        onChange={(e: any) => setPassData({ ...passData, old: e.target.value })}
                        error={error === 'Неверный старый пароль'}
                    />

                    <PasswordInput
                        label="Новый пароль"
                        value={passData.new}
                        onChange={(e: any) => setPassData({ ...passData, new: e.target.value })}
                        minLength={8}
                    />

                    <PasswordInput
                        label="Повторите новый пароль"
                        value={passData.confirm}
                        onChange={(e: any) => setPassData({ ...passData, confirm: e.target.value })}
                    />

                    <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98]">
                        Сменить пароль
                    </Button>
                </form>
            </Modal>
        </div>
    );
}
