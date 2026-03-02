import { Outlet } from 'react-router-dom';
import { PageHeader } from '../../components/shared';

export default function AdminLayout() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Административная панель"
                subtitle="Настройки системы и доступов"
            />

            <div className="mt-6">
                <Outlet />
            </div>
        </div>
    );
}
