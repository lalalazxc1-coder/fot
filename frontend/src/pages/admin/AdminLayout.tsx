import { Outlet, NavLink } from 'react-router-dom';
import { PageHeader } from '../../components/shared';

export default function AdminLayout() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Административная панель"
                subtitle="Настройки системы и доступов"
            >
                <div className="flex p-1 bg-slate-200/50 rounded-xl overflow-x-auto">
                    <NavLink
                        to="/admin"
                        end
                        className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${isActive ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Главная
                    </NavLink>
                    <NavLink
                        to="/admin/roles"
                        className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Роли
                    </NavLink>
                    <NavLink
                        to="/admin/users"
                        className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Пользователи
                    </NavLink>
                    <NavLink
                        to="/admin/workflow"
                        className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Цепочка согласования
                    </NavLink>
                </div>
            </PageHeader>

            <div className="mt-6">
                <Outlet />
            </div>
        </div>
    );
}
