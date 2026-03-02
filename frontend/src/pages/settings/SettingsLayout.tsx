import { useOutletContext, Outlet } from 'react-router-dom';
import type { AuthUser } from '../../types';

export default function SettingsLayout() {
    const { user } = useOutletContext<{ user: AuthUser }>();

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col">
            <div className="mb-6 shrink-0">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Настройки компании</h1>
                <p className="text-slate-500 mt-2 text-lg">Управление структурой, должностями и справочниками.</p>
            </div>

            {/* Content Area */}
            <main className="flex-1 min-w-0 h-full overflow-y-auto">
                <Outlet context={{ user }} />
            </main>
        </div>
    );
}
