import React, { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteAllNotifications } from '../hooks/useAdmin';
import { Trash2, CheckCircle, Bell, Settings, LogOut, Shield, Clock, Menu, X, Users, FileText, PieChart, ShoppingBag, Layout, Send, Briefcase, ChevronDown, Building } from 'lucide-react';
import { useSnapshot } from '../context/SnapshotContext';
import { Notification } from '../hooks/useAdmin';
import { useOnClickOutside } from 'usehooks-ts';
import { formatDateTime } from '../utils';
import type { AuthUser } from '../types';
import { resolveAvatarUrl } from '../utils/avatar';

type User = AuthUser;

// --- Main Layout ---
export default function DashboardLayout({ user, onLogout, onUserUpdate }: { user: User; onLogout: () => void; onUserUpdate: (nextUser: User) => void }) {
    const { snapshotDate } = useSnapshot();
    const navigate = useNavigate();
    const location = useLocation();

    const hasAdminAccess = user.role === 'Administrator' || user.permissions?.admin_access;
    const canViewMarket = hasAdminAccess || user.permissions?.view_market;

    const hasPermission = (key: string) => {
        if (!user) return false;
        if (user.role === 'Administrator') return true;
        if (user.permissions?.admin_access) return true;
        return user.permissions?.[key];
    };

    const hasSettingsAccess = hasAdminAccess ||
        user.permissions?.view_structure ||
        user.permissions?.edit_structure ||
        user.permissions?.view_positions ||
        user.permissions?.edit_positions;

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Accordion state
    const [isSettingsExpanded, setIsSettingsExpanded] = useState(location.pathname.startsWith('/settings'));
    const [isAdminExpanded, setIsAdminExpanded] = useState(location.pathname.startsWith('/admin'));


    const { data: notifications = [] } = useNotifications();
    const markRead = useMarkNotificationRead();
    const markAllRead = useMarkAllNotificationsRead();
    const deleteAll = useDeleteAllNotifications();
    const [activeTabIndex, setActiveTabIndex] = useState<number | null>(null);
    const tabsContainerRef = useRef(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const avatarSrc = resolveAvatarUrl(user.avatar_url);
    const displayRole = user.job_title || user.role;
    const initials = user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const [headerAvatarError, setHeaderAvatarError] = useState(false);

    useEffect(() => {
        setHeaderAvatarError(false);
    }, [avatarSrc]);

    useOnClickOutside(tabsContainerRef, () => {
        setActiveTabIndex(null);
    });

    const handleScroll = (e: React.UIEvent<HTMLElement>) => {
        setIsScrolled(e.currentTarget.scrollTop > 10);
    };

    const unreadCount = notifications.filter((n: Notification) => !n.is_read).length;

    const handleNotifClick = (n: Notification) => {
        if (!n.is_read) markRead.mutate(n.id);
        if (n.link) navigate(n.link);
        setActiveTabIndex(null);
    };



    const navGroups = React.useMemo(() => {
        const canViewAnalytics = hasAdminAccess || user.permissions?.view_analytics;
        const canViewPayroll = hasAdminAccess || user.permissions?.view_payroll;
        const canViewEmployees = hasAdminAccess || user.permissions?.view_employees;
        const canViewScenarios = hasAdminAccess || user.permissions?.view_scenarios;
        const canViewOffers = hasAdminAccess || user.permissions?.manage_planning || user.permissions?.manage_offers;

        const groups = [];

        // Без категории (Аналитика)
        if (canViewAnalytics) {
            groups.push({
                title: '',
                items: [
                    { name: 'Аналитика', url: '/analytics', icon: PieChart }
                ]
            });
        }

        // Руководитель
        groups.push({
            title: 'РУКОВОДИТЕЛЬ',
            items: [
                { name: 'Пересмотры', url: '/requests', icon: FileText },
                { name: 'Найм', url: '/job-requests', icon: FileText },
            ]
        });

        // HR / HRD
        const hrItems = [
            ...(canViewPayroll ? [{ name: 'Бюджет', url: '/payroll', icon: FileText }] : []),
            ...(canViewEmployees ? [{ name: 'Штат', url: '/employees', icon: Users }] : []),
            ...(canViewScenarios ? [{ name: 'Конструктор', url: '/scenarios', icon: Layout }] : []),
        ];
        if (hrItems.length > 0) {
            groups.push({
                title: 'УПРАВЛЕНИЕ',
                items: hrItems
            });
        }

        // Рекрутер
        const recruiterItems = [
            ...(canViewOffers ? [
                { name: 'Воронка', url: '/recruiting', icon: Briefcase },
                { name: 'Офферы', url: '/offers', icon: Send }
            ] : []),
            ...(canViewMarket ? [{ name: 'Рынок', url: '/market', icon: ShoppingBag }] : []),
        ];
        if (recruiterItems.length > 0) {
            groups.push({
                title: 'РЕКРУТИНГ',
                items: recruiterItems
            });
        }

        return groups;
    }, [hasAdminAccess, canViewMarket, user.permissions]);

    const settingsSubPages = [
        { name: 'Структура компании', url: '/settings/structure', permissionKey: 'view_structure', icon: Building },
        { name: 'Справочник должностей', url: '/settings/positions', permissionKey: 'view_positions', icon: Briefcase },
        { name: 'Шаблоны офферов', url: '/settings/offer-templates', permissionKey: 'admin_access', icon: Send },
        { name: 'Welcome Pages', url: '/settings/welcome-pages', permissionKey: 'admin_access', icon: Layout },
    ].filter(p => hasPermission(p.permissionKey));

    const adminSubPages = [
        { name: 'Главная', url: '/admin', icon: Shield },
        { name: 'Роли', url: '/admin/roles', icon: Users },
        { name: 'Пользователи', url: '/admin/users', icon: Users },
        { name: 'Цепочка согласования', url: '/admin/workflow', icon: Send },
        { name: 'Интеграции', url: '/admin/integrations', icon: Layout },
        { name: 'Аналитика', url: '/admin/analytics-config', icon: PieChart },
        { name: 'Логи аудита', url: '/admin/logs', icon: FileText },
    ];

    return (
        <div className="flex h-screen overflow-hidden font-sans text-slate-900 bg-slate-100/80 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-200/50 to-slate-200/80">
            <style>{`
                @keyframes dropdownIn {
                    from { opacity: 0; transform: translateY(8px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>

            {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
            )}

            <aside className={`fixed md:static inset-y-0 left-0 w-64 bg-white border-r border-slate-200/60 flex flex-col shrink-0 shadow-lg md:shadow-none z-50 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="px-5 h-[64px] flex items-center justify-between shrink-0 border-b border-slate-200/60">
                        <Link to="/" className="group flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <div className="flex items-center justify-center">
                                <svg className="w-6 h-6 text-slate-800 transition-transform group-hover:scale-110 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <span className="font-semibold text-slate-800 text-[15px] leading-tight tracking-tight">HR & Payroll Hub</span>
                        </Link>

                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="md:hidden p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto py-5 px-3 space-y-1 custom-scrollbar">
                        {navGroups.map((group, groupIndex) => (
                            <div key={group.title || `group-${groupIndex}`} className={groupIndex > 0 ? "mt-4 pt-4 border-t border-slate-200/60" : ""}>
                                {group.title && (
                                    <div className="px-3 mb-2">
                                        <h3 className="text-xs font-bold text-slate-400 tracking-wider font-sans">{group.title}</h3>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    {group.items.map(item => {
                                        const Icon = item.icon;
                                        let isActive = false;

                                        // Handling active states correctly avoiding overlap
                                        if (item.url === '/offers' || item.url === '/requests' || item.url === '/job-requests') {
                                            isActive = location.pathname.startsWith(item.url);
                                        } else {
                                            isActive = location.pathname.startsWith(item.url);
                                        }

                                        return (
                                            <Link
                                                key={item.name + item.url}
                                                to={item.url}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive ? 'bg-slate-900 border-slate-800 shadow-md shadow-slate-900/10' : 'hover:bg-slate-100'}`}
                                            >
                                                <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'}`} />
                                                <span className={`font-medium text-[13.5px] tracking-wide transition-colors ${isActive ? 'font-semibold text-white' : 'text-slate-600 group-hover:text-slate-900'}`}>{item.name}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {hasSettingsAccess && settingsSubPages.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-100/80">
                                <button
                                    onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors hover:bg-slate-100 group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Settings className="w-[18px] h-[18px] flex-shrink-0 text-slate-400 group-hover:text-slate-700 transition-colors" />
                                        <span className="font-medium text-[13.5px] tracking-wide text-slate-600 group-hover:text-slate-900 transition-colors">Настройки компании</span>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isSettingsExpanded ? 'rotate-180' : ''}`} />
                                </button>

                                {isSettingsExpanded && (
                                    <div className="mt-1 ml-4 border-l-2 border-slate-100 pl-2 space-y-1">
                                        {settingsSubPages.map(subPage => {
                                            const isSubActive = location.pathname === subPage.url;
                                            return (
                                                <Link
                                                    key={subPage.name}
                                                    to={subPage.url}
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors group ${isSubActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'}`}
                                                >
                                                    <span className="text-[13px]">{subPage.name}</span>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {hasAdminAccess && adminSubPages.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-100/80">
                                <button
                                    onClick={() => setIsAdminExpanded(!isAdminExpanded)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors hover:bg-slate-100 group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Shield className="w-[18px] h-[18px] flex-shrink-0 text-slate-400 group-hover:text-slate-700 transition-colors" />
                                        <span className="font-medium text-[13.5px] tracking-wide text-slate-600 group-hover:text-slate-900 transition-colors">Админ панель</span>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isAdminExpanded ? 'rotate-180' : ''}`} />
                                </button>

                                {isAdminExpanded && (
                                    <div className="mt-1 ml-4 border-l-2 border-slate-100 pl-2 space-y-1">
                                        {adminSubPages.map(subPage => {
                                            const isSubActive = subPage.url === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(subPage.url);
                                            return (
                                                <Link
                                                    key={subPage.name}
                                                    to={subPage.url}
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors group ${isSubActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'}`}
                                                >
                                                    <span className="text-[13px]">{subPage.name}</span>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 relative h-full">
                <div className="shrink-0 z-30 sticky top-0 flex flex-col">
                    {snapshotDate && (
                        <div className="bg-amber-500 text-white text-center py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 w-full">
                            <Clock className="w-3.5 h-3.5" />
                            Режим истории: {snapshotDate} — Только чтение
                        </div>
                    )}

                    <header className={`min-h-[64px] py-2 shrink-0 flex items-center justify-between px-3 md:px-5 transition-all duration-300 ${isScrolled ? 'bg-white/70 backdrop-blur-md shadow-sm' : 'bg-white'} border-b border-slate-200/60`}>
                        <div className="flex items-center gap-3 w-full flex-1 min-w-0 pr-4">
                            <button
                                onClick={() => setIsMobileMenuOpen(true)}
                                className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                            <div id="page-header-portal" className="flex-1 min-w-0 flex items-center pl-1 md:pl-0"></div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4 relative" ref={tabsContainerRef}>

                            <div className="relative">
                                <button
                                    onClick={() => setActiveTabIndex(activeTabIndex === 0 ? null : 0)}
                                    className={`p-2 rounded-xl transition-all relative flex items-center justify-center ${activeTabIndex === 0 ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-transparent hover:border-slate-200/50'}`}
                                >
                                    <Bell className="w-5 h-5" />
                                    {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-[1.5px] border-white shadow-sm" />}
                                </button>

                                {activeTabIndex === 0 && (
                                    <div className="absolute right-[-40px] sm:right-0 top-[calc(100%+8px)] w-80 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 overflow-hidden z-[60] origin-top-right" style={{ animation: 'dropdownIn 0.15s ease-out' }}>
                                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center backdrop-blur-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-[14px] text-slate-800">Уведомления</span>
                                                {unreadCount > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-bold">{unreadCount}</span>}
                                            </div>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => markAllRead.mutate()}
                                                    className="p-1 text-slate-400 hover:text-emerald-600 rounded-md hover:bg-emerald-50 transition-colors"
                                                    title="Прочитать все"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteAll.mutate()}
                                                    className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                                                    title="Удалить все"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                            {notifications.length === 0 ? (
                                                <div className="py-10 px-6 text-center text-slate-400 text-[13px] flex flex-col items-center gap-2">
                                                    <Bell className="w-8 h-8 text-slate-200" />
                                                    Нет новых уведомлений
                                                </div>
                                            ) : (
                                                notifications.map((n: Notification) => (
                                                    <div
                                                        key={n.id}
                                                        onClick={() => handleNotifClick(n)}
                                                        className={`p-4 border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors ${!n.is_read ? 'bg-blue-50/30 font-medium' : ''}`}
                                                    >
                                                        <div className="text-[13px] text-slate-700 leading-snug">{n.message}</div>
                                                        <div className="text-[11px] text-slate-400 mt-2 flex justify-between items-center">
                                                            <span>{formatDateTime(n.created_at)}</span>
                                                            {!n.is_read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-sm shadow-blue-500/40"></span>}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-1 sm:gap-2">
                                <Link
                                    to="/profile"
                                    className="flex items-center gap-2 p-1 pl-1 pr-2 sm:pr-3 rounded-xl transition-all border border-transparent hover:bg-slate-50 hover:border-slate-200/50"
                                    title="Мой профиль"
                                >
                                    {avatarSrc && !headerAvatarError ? (
                                        <img
                                            src={avatarSrc}
                                            alt={user.full_name}
                                            onError={() => setHeaderAvatarError(true)}
                                            className="w-8 h-8 shrink-0 rounded-lg object-cover shadow-md shadow-slate-900/20 ring-2 ring-white"
                                        />
                                    ) : null}
                                    <div className={`w-8 h-8 shrink-0 bg-gradient-to-br from-slate-700 to-slate-900 text-white rounded-lg flex items-center justify-center text-[11px] font-bold shadow-md shadow-slate-900/20 ring-2 ring-white ${avatarSrc && !headerAvatarError ? 'hidden' : ''}`}>
                                        {initials}
                                    </div>
                                    <div className="hidden sm:block text-left min-w-0 pr-1">
                                        <div className="font-semibold text-[13px] text-slate-800 truncate leading-tight">{user.full_name}</div>
                                        <div className="text-[11px] text-slate-500 truncate leading-tight">{displayRole}</div>
                                    </div>
                                </Link>

                                <button
                                    onClick={onLogout}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    title="Выйти из системы"
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>

                        </div>
                    </header>
                </div>

                <main onScroll={handleScroll} className="flex-1 overflow-y-auto w-full bg-slate-50 transition-colors">
                    <div className="w-full px-4 md:px-5 py-4 md:py-5 max-w-none mr-auto">
                        <Outlet context={{ user, onUserUpdate }} />
                    </div>
                </main>
            </div>


        </div>
    );
}
