import { useAdminStats } from '../../hooks/useAdmin';
import { Users, Building, Briefcase, FileText, Loader2, Activity } from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

export default function AdminDashboard() {
    const { data: stats, isLoading, error } = useAdminStats();

    if (isLoading) return (
        <div className="h-64 flex justify-center items-center">
            <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
        </div>
    );

    if (error || !stats) return <div className="p-10 text-center text-red-400">Ошибка загрузки данных</div>;

    const barOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: false,
                text: 'Статус заявок',
            },
        },
    };

    const requestsData = {
        labels: stats.charts.requests.labels,
        datasets: [
            {
                label: 'Заявки',
                data: stats.charts.requests.data,
                backgroundColor: ['rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)'],
                borderColor: ['rgba(255, 206, 86, 1)', 'rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
                borderWidth: 1,
            },
        ],
    };

    const rolesData = {
        labels: stats.charts.roles.labels,
        datasets: [
            {
                label: 'Пользователи',
                data: stats.charts.roles.data,
                backgroundColor: [
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(153, 102, 255, 0.6)',
                    'rgba(201, 203, 207, 0.6)',
                    'rgba(75, 192, 192, 0.6)'
                ],
                borderWidth: 1,
            },
        ],
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Обзор системы</h2>

            {/* 1. Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Сотрудников"
                    value={stats.counts.employees}
                    icon={<Users className="w-6 h-6 text-blue-600" />}
                    color="bg-blue-50"
                />
                <StatCard
                    title="Филиалов"
                    value={stats.counts.branches}
                    icon={<Building className="w-6 h-6 text-purple-600" />}
                    color="bg-purple-50"
                />
                <StatCard
                    title="Пользователей"
                    value={stats.counts.users}
                    icon={<Briefcase className="w-6 h-6 text-emerald-600" />}
                    color="bg-emerald-50"
                />
                <StatCard
                    title="Заявок (Ожидает)"
                    value={stats.counts.pending_requests}
                    icon={<FileText className="w-6 h-6 text-amber-600" />}
                    color="bg-amber-50"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 2. Charts */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-lg mb-4 text-slate-800">Статистика заявок</h3>
                    <div className="h-[300px] flex justify-center">
                        <Bar options={barOptions} data={requestsData} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-lg mb-4 text-slate-800">Роли пользователей</h3>
                    <div className="h-[300px] flex justify-center">
                        <Doughnut data={rolesData} options={{ maintainAspectRatio: false }} />
                    </div>
                </div>
            </div>

            {/* 3. Recent Activity */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-slate-500" />
                    <h3 className="font-bold text-lg text-slate-800">Последняя активность</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Время</th>
                                <th className="px-4 py-3">Пользователь</th>
                                <th className="px-4 py-3">Действие</th>
                                <th className="px-4 py-3 rounded-r-lg">Сущность</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.activity.map((log) => (
                                <tr key={log.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                                    <td className="px-4 py-3 font-mono text-slate-500">{log.time}</td>
                                    <td className="px-4 py-3 font-medium text-slate-900">{log.user}</td>
                                    <td className="px-4 py-3 text-slate-700">{log.action}</td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-500">
                                            {log.entity}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {stats.activity.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-4 text-center text-slate-400 italic">История пуста</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>


        </div>
    );
}

function StatCard({ title, value, icon, color }: any) {
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${color}`}>
                    {icon}
                </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
            <div className="text-sm text-slate-500 font-medium">{title}</div>
        </div>
    );
}
