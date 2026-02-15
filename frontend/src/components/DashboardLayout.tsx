import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteAllNotifications } from '../hooks/useAdmin';
import { Trash2, CheckCircle, Bell, Briefcase, Settings, LogOut, Key, Eye, EyeOff, Shield, Clock, ChevronDown, Menu, X } from 'lucide-react';
import { useSnapshot } from '../context/SnapshotContext';
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

// --- User Dropdown Menu ---
function UserDropdown({ user, hasSettingsAccess, hasAdminAccess, onChangePassword, onLogout }: {
    user: User;
    hasSettingsAccess: boolean;
    hasAdminAccess: boolean;
    onChangePassword: () => void;
    onLogout: () => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const initials = user.full_name
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 transition-all duration-200 group"
            >
                <div className="w-8 h-8 bg-gradient-to-br from-slate-800 to-slate-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-md shadow-slate-900/10">
                    {initials}
                </div>
                <div className="text-left hidden sm:block">
                    <div className="text-sm font-semibold text-slate-800 leading-tight">{user.full_name}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{user.role}</div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Panel */}
            {open && (
                <div
                    className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden z-50"
                    style={{ animation: 'dropdownIn 0.15s ease-out' }}
                >
                    {/* User Info Header */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <div className="font-semibold text-sm text-slate-800">{user.full_name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{user.role}</div>
                    </div>

                    {/* Management Section */}
                    {(hasSettingsAccess || hasAdminAccess) && (
                        <div className="py-1 border-b border-slate-100">
                            <div className="px-3 pt-2 pb-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Управление</span>
                            </div>
                            {hasSettingsAccess && (
                                <button
                                    onClick={() => { navigate('/settings'); setOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                >
                                    <Settings className="w-4 h-4 text-slate-400" />
                                    Настройки компании
                                </button>
                            )}
                            {hasAdminAccess && (
                                <button
                                    onClick={() => { navigate('/admin'); setOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                >
                                    <Shield className="w-4 h-4 text-slate-400" />
                                    Панель администратора
                                </button>
                            )}
                        </div>
                    )}

                    {/* Account Section */}
                    <div className="py-1 border-b border-slate-100">
                        <div className="px-3 pt-2 pb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Аккаунт</span>
                        </div>
                        <button
                            onClick={() => { onChangePassword(); setOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                            <Key className="w-4 h-4 text-slate-400" />
                            Сменить пароль
                        </button>
                    </div>

                    {/* Logout */}
                    <div className="py-1">
                        <button
                            onClick={() => { onLogout(); setOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Выйти из системы
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Main Layout ---
export default function DashboardLayout({ user, onLogout }: { user: User; onLogout: () => void }) {
    const { snapshotDate } = useSnapshot();
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

    // Nav items config
    const navItems = [
        { to: '/analytics', label: 'Аналитика' },
        { to: '/payroll', label: 'ФОТ' },
        { to: '/employees', label: 'Сотрудники' },
        { to: '/requests', label: 'Заявки' },
        ...(canViewMarket ? [{ to: '/market', label: 'Рынок' }] : []),
        { to: '/scenarios', label: 'Песочница' },
    ];

    return (
        <div className="min-h-screen font-sans text-slate-900 bg-slate-100/80 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-200/50 to-slate-200/80">

            {/* Dropdown animation keyframes */}
            <style>{`
                @keyframes dropdownIn {
                    from { opacity: 0; transform: translateY(-4px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>

            {/* Header */}
            <header className="sticky top-0 z-30 w-full bg-white/70 border-b border-slate-200/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">

                    {/* Left: Logo + Nav */}
                    <div className="flex items-center gap-6">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
                            <div className="w-8 h-8 bg-gradient-to-br from-slate-900 to-slate-700 rounded-lg flex items-center justify-center text-white shadow-md shadow-slate-900/20">
                                <Briefcase className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-900 text-[13px] leading-none tracking-tight">УПРАВЛЕНИЕ</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Система ФОТ</span>
                            </div>
                        </Link>

                        {/* Divider */}
                        <div className="h-5 w-px bg-slate-200 hidden md:block"></div>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-0.5">
                            {navItems.map(item => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) =>
                                        `relative px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${isActive
                                            ? 'text-slate-900 bg-slate-900/[0.06]'
                                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            {item.label}
                                            {isActive && (
                                                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-slate-900 rounded-full"></span>
                                            )}
                                        </>
                                    )}
                                </NavLink>
                            ))}
                        </nav>
                    </div>

                    {/* Right: Bell + Divider + User Dropdown */}
                    <div className="flex items-center gap-2">

                        {/* Notification Bell */}
                        <div className="relative">
                            <button
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                className="relative p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                            >
                                <Bell className="w-[18px] h-[18px]" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[14px] h-[14px] text-[9px] font-bold bg-red-500 text-white rounded-full px-0.5 ring-2 ring-white">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {isNotifOpen && (
                                <div
                                    className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden z-50"
                                    style={{ animation: 'dropdownIn 0.15s ease-out' }}
                                    onMouseLeave={() => setIsNotifOpen(false)}
                                >
                                    <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-slate-700">Уведомления</span>
                                            {unreadCount > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-bold">{unreadCount}</span>}
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => markAllRead.mutate()}
                                                className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-emerald-50"
                                                title="Прочитать все"
                                            >
                                                <CheckCircle className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => deleteAll.mutate()}
                                                className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                                                title="Удалить все"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="max-h-[280px] overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-6 text-center text-slate-400 text-sm">Нет уведомлений</div>
                                        ) : (
                                            notifications.map((n: any) => (
                                                <div
                                                    key={n.id}
                                                    onClick={() => handleNotifClick(n)}
                                                    className={`p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${!n.is_read ? 'bg-blue-50/40' : ''}`}
                                                >
                                                    <div className="text-sm text-slate-700">{n.message}</div>
                                                    <div className="text-[10px] text-slate-400 mt-1 flex justify-between items-center">
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

                        {/* Separator */}
                        <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                        {/* User Dropdown */}
                        <UserDropdown
                            user={user}
                            hasSettingsAccess={hasSettingsAccess}
                            hasAdminAccess={hasAdminAccess}
                            onChangePassword={openModal}
                            onLogout={onLogout}
                        />

                        {/* Mobile Hamburger */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all ml-1"
                        >
                            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {isMobileMenuOpen && (
                    <div
                        className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-lg"
                        style={{ animation: 'dropdownIn 0.15s ease-out' }}
                    >
                        <nav className="max-w-7xl mx-auto px-4 py-2 flex flex-col gap-0.5">
                            {navItems.map(item => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={({ isActive }) =>
                                        `px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                                            ? 'text-slate-900 bg-slate-100'
                                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                        }`
                                    }
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </nav>
                    </div>
                )}
            </header>

            {/* Snapshot Warning Banner */}
            {snapshotDate && (
                <div className="bg-amber-500 text-white text-center py-1 text-[11px] font-bold uppercase tracking-wider sticky top-14 z-20 shadow-sm flex items-center justify-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    Режим истории: {snapshotDate} — Только чтение
                </div>
            )}

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                <Outlet context={{ user }} />
            </main>

            {/* Change Password Modal */}
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
