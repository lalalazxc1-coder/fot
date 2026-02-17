import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteAllNotifications } from '../hooks/useAdmin';
import { Trash2, CheckCircle, Bell, Settings, LogOut, Key, Eye, EyeOff, Shield, Clock, Menu, X, Users, FileText, PieChart, ShoppingBag, Layout } from 'lucide-react';
import { useSnapshot } from '../context/SnapshotContext';
import Modal from './Modal';
import { Button, Input } from './ui-mocks';
import { api } from '../lib/api';
import { NavBar } from './ui/tubelight-navbar';
import { ExpandableTabs } from './ui/expandable-tabs';
import { useOnClickOutside } from 'usehooks-ts';

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

// --- User Dropdown Content (Refactored to be just content) ---
function UserDropdownContent({ user, hasSettingsAccess, hasAdminAccess, onChangePassword, onLogout }: {
    user: User;
    hasSettingsAccess: boolean;
    hasAdminAccess: boolean;
    onChangePassword: () => void;
    onLogout: () => void;
}) {
    const navigate = useNavigate();
    const initials = user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div className="w-64 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            {/* User Info Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-slate-800 to-slate-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-md shadow-slate-900/10">
                    {initials}
                </div>
                <div>
                    <div className="font-semibold text-sm text-slate-800">{user.full_name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{user.role}</div>
                </div>
            </div>

            {/* Management Section */}
            {(hasSettingsAccess || hasAdminAccess) && (
                <div className="py-1 border-b border-slate-100">
                    <div className="px-3 pt-2 pb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Управление</span>
                    </div>
                    {hasSettingsAccess && (
                        <button
                            onClick={() => { navigate('/settings'); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                            <Settings className="w-4 h-4 text-slate-400" />
                            Настройки компании
                        </button>
                    )}
                    {hasAdminAccess && (
                        <button
                            onClick={() => { navigate('/admin'); }}
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
                    onClick={onChangePassword}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                    <Key className="w-4 h-4 text-slate-400" />
                    Сменить пароль
                </button>
            </div>

            {/* Logout */}
            <div className="py-1">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Выйти из системы
                </button>
            </div>
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
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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
    const [activeTabIndex, setActiveTabIndex] = useState<number | null>(null);
    const tabsContainerRef = useRef(null);

    useOnClickOutside(tabsContainerRef, () => {
        setActiveTabIndex(null);
    });

    const unreadCount = notifications.filter((n: any) => !n.is_read).length;

    const handleNotifClick = (n: any) => {
        if (!n.is_read) markRead.mutate(n.id);
        if (n.link) navigate(n.link);
        setActiveTabIndex(null);
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
    // Nav items config for new NavBar
    const tubeNavItems = React.useMemo(() => [
        { name: 'Аналитика', url: '/analytics', icon: PieChart },
        { name: 'ФОТ', url: '/payroll', icon: FileText },
        { name: 'Сотрудники', url: '/employees', icon: Users },
        { name: 'Заявки', url: '/requests', icon: FileText },
        ...(canViewMarket ? [{ name: 'Рынок', url: '/market', icon: ShoppingBag }] : []),
        { name: 'Песочница', url: '/scenarios', icon: Layout },
    ], [canViewMarket]);

    return (
        <div className="min-h-screen font-sans text-slate-900 bg-slate-100/80 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-200/50 to-slate-200/80">

            {/* Dropdown animation keyframes */}
            <style>{`
                @keyframes dropdownIn {
                    from { opacity: 0; transform: translateY(-4px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>

            {/* Header - Airy Style with Scroll Effect */}
            <header className={`sticky top-0 z-30 w-full transition-all duration-300 ${scrolled ? 'bg-white/50 backdrop-blur-md shadow-sm border-b border-white/20' : 'bg-transparent border-b border-transparent'}`}>
                <div className={`max-w-7xl mx-auto px-6 flex items-center justify-between transition-all duration-300 ${scrolled ? 'h-14' : 'h-16'}`}>

                    {/* Left: Logo + Nav */}
                    <div className="flex items-center gap-6">
                        {/* Logo - Airy Style */}
                        <Link to="/" className="group flex items-center gap-3 hover:opacity-80 transition-opacity shrink-0">
                            <div className="flex items-center justify-center">
                                <svg className="w-6 h-6 text-slate-800 transition-transform group-hover:scale-110 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-semibold text-slate-800 text-[15px] leading-tight tracking-tight">HR & Payroll Hub</span>
                            </div>
                        </Link>

                        {/* Divider */}
                        <div className="h-5 w-px bg-slate-200 hidden md:block"></div>

                        {/* TubeLight NavBar Integrated */}
                        <div className="hidden md:block">
                            <NavBar items={tubeNavItems} className="relative !top-0 !left-0 !translate-x-0 !mb-0 !pt-0" />
                        </div>
                    </div>

                    {/* Right: Expandable Tabs for Actions */}
                    <div className="flex items-center relative" ref={tabsContainerRef}>
                        <ExpandableTabs
                            tabs={[
                                { title: "Уведомления", icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
                                { title: "Профиль", icon: Users }, // Using Users icon as generic profile placeholder
                            ]}
                            onChange={(index) => setActiveTabIndex(index)}
                            selectedIndex={activeTabIndex}
                            disableOutsideClick={true}
                        />

                        {/* Notification Dropdown (Index 0) */}
                        {activeTabIndex === 0 && (
                            <div
                                className="absolute right-0 top-full mt-4 w-80 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden z-50 transform"
                                style={{ animation: 'dropdownIn 0.15s ease-out' }}
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

                        {/* User Dropdown (Index 1) */}
                        {activeTabIndex === 1 && (
                            <div className="absolute right-0 top-full mt-4 z-50 transform" style={{ animation: 'dropdownIn 0.15s ease-out' }}>
                                <UserDropdownContent
                                    user={user}
                                    hasSettingsAccess={hasSettingsAccess}
                                    hasAdminAccess={hasAdminAccess}
                                    onChangePassword={() => {
                                        openModal();
                                        setActiveTabIndex(null);
                                    }}
                                    onLogout={() => {
                                        onLogout();
                                        setActiveTabIndex(null);
                                    }}
                                />
                            </div>
                        )}

                        {/* Mobile Hamburger (Keep separate or integrate? Keeping separate for now) */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all ml-1"
                        >
                            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* TubeLight NavBar for Mobile */}
                <div className="md:hidden">
                    <NavBar items={tubeNavItems} />
                </div>
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
