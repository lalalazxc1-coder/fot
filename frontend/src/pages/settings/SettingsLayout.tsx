import { useOutletContext, NavLink, Outlet } from 'react-router-dom';
import { Building, Briefcase, ChevronRight } from 'lucide-react';

export default function SettingsLayout() {
    const { user } = useOutletContext<{ user: any }>();

    const hasPermission = (key: string) => {
        if (!user) return false;
        if (user.role === 'Administrator') return true;
        if (user.permissions?.admin_access) return true;
        return user.permissions?.[key];
    };

    const tabs = [
        { path: 'structure', label: 'Структура компании', icon: Building, key: 'view_structure' },
        { path: 'positions', label: 'Справочник должностей', icon: Briefcase, key: 'view_positions' },
    ].filter(t => hasPermission(t.key));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Настройки компании</h1>
                <p className="text-slate-500 mt-2 text-lg">Управление структурой, должностями и справочниками.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Navigation */}
                <aside className="w-full md:w-64 flex-shrink-0">
                    <nav className="flex flex-col gap-1 sticky top-24">
                        {tabs.map(tab => (
                            <NavLink
                                key={tab.path}
                                to={tab.path}
                                className={({ isActive }: { isActive: boolean }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <tab.icon className="w-4 h-4" />
                                        {tab.label}
                                        {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>
                </aside>

                {/* Content Area */}
                <main className="flex-1 min-w-0">
                    <Outlet context={{ user }} />
                </main>
            </div>
        </div>
    );
}
