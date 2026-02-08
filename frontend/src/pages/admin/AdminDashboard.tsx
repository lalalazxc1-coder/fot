import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Users, Building, Briefcase, Wallet } from 'lucide-react';

type Stats = {
    employees: number;
    users: number;
    branches: number;
    budget: number;
};

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const data = await api.get('/admin/stats');
            setStats(data.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-400">Загрузка статистики...</div>;
    if (!stats) return <div className="p-10 text-center text-red-400">Ошибка загрузки данных</div>;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Обзор системы</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Сотрудников"
                    value={stats.employees}
                    icon={<Users className="w-6 h-6 text-blue-600" />}
                    color="bg-blue-50"
                />
                <StatCard
                    title="Филиалов"
                    value={stats.branches}
                    icon={<Building className="w-6 h-6 text-purple-600" />}
                    color="bg-purple-50"
                />
                <StatCard
                    title="Пользователей"
                    value={stats.users}
                    icon={<Briefcase className="w-6 h-6 text-emerald-600" />}
                    color="bg-emerald-50"
                />
                <StatCard
                    title="Общий ФОТ"
                    value={stats.budget.toLocaleString() + ' ₸'}
                    icon={<Wallet className="w-6 h-6 text-amber-600" />}
                    color="bg-amber-50"
                    isMoney
                />
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-lg mb-4 text-slate-800">Быстрые действия</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <a href="/admin/users" className="block p-4 border border-slate-100 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all group">
                        <div className="font-semibold text-blue-600 mb-1 group-hover:underline">Добавить пользователя &rarr;</div>
                        <div className="text-xs text-slate-500">Создать нового администратора или менеджера</div>
                    </a>
                    <a href="/admin/structure" className="block p-4 border border-slate-100 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all group">
                        <div className="font-semibold text-purple-600 mb-1 group-hover:underline">Настроить структуру &rarr;</div>
                        <div className="text-xs text-slate-500">Добавить новый филиал или отдел</div>
                    </a>
                    <a href="/payroll" className="block p-4 border border-slate-100 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all group">
                        <div className="font-semibold text-emerald-600 mb-1 group-hover:underline">Перейти к ФОТ &rarr;</div>
                        <div className="text-xs text-slate-500">Просмотр и редактирование зарплат</div>
                    </a>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color, isMoney }: any) {
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${color}`}>
                    {icon}
                </div>
                {isMoney && <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">+0%</span>}
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
            <div className="text-sm text-slate-500 font-medium">{title}</div>
        </div>
    );
}
