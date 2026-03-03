import { useOutletContext, Outlet } from 'react-router-dom';
import type { AuthUser } from '../../types';
import { PageHeader } from '../../components/shared/PageHeader';

export default function SettingsLayout() {
    const { user } = useOutletContext<{ user: AuthUser }>();

    return (
        <div className="flex flex-col">
            <PageHeader
                title="Настройки компании"
            //subtitle="Управление структурой, должностями и справочниками."
            />

            {/* Content Area */}
            <main className="flex-1 min-w-0">
                <Outlet context={{ user }} />
            </main>
        </div>
    );
}
