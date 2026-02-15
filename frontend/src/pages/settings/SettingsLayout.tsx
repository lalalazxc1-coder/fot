import { useOutletContext, NavLink, Outlet } from 'react-router-dom';
import { Building, Briefcase } from 'lucide-react';

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
        <div className="h-[calc(100vh-6rem)] flex flex-col">
            <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Настройки компании</h1>
                <p className="text-slate-500 mt-2 text-lg">Управление структурой, должностями и справочниками.</p>
            </div>

            {/* Top Navigation Bar */}
            <div className="flex-shrink-0 mb-6">
                <nav className="flex p-1 bg-slate-200/50 rounded-xl overflow-x-auto inline-flex max-w-full">
                    {tabs.map(tab => (
                        <NavLink
                            key={tab.path}
                            to={tab.path}
                            className={({ isActive }: { isActive: boolean }) =>
                                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${isActive
                                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <tab.icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                                    {tab.label}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>
            </div>

            {/* Content Area */}
            <main className="flex-1 min-w-0 h-full overflow-y-auto">
                <Outlet context={{ user }} />
            </main>
        </div>
    );
}
