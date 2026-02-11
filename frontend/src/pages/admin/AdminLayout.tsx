import { Outlet, NavLink } from 'react-router-dom';

export default function AdminLayout() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Административная панель</h1>
                    <p className="text-slate-500">Настройки системы и доступов</p>
                </div>

                {/* Tabs */}
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
                        to="/admin/structure"
                        className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Структура / Филиалы
                    </NavLink>
                    <NavLink
                        to="/admin/users"
                        className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Пользователи
                    </NavLink>
                </div>
            </div>

            <div className="mt-6">
                <Outlet />
            </div>
        </div>
    );
}
