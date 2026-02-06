import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, Search, TrendingUp, BarChart2, Globe } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

type MarketRow = {
    id: number;
    position_title: string;
    min_salary: number;
    max_salary: number;
    median_salary: number;
    source: string;
    updated_at: string;
};

const formatMoney = (val: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(val);

export default function MarketPage() {
    const { user } = useOutletContext<{ user: any }>();
    const [data, setData] = useState<MarketRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [search, setSearch] = useState('');

    const [form, setForm] = useState({
        position_title: '',
        min_salary: '',
        max_salary: '',
        median_salary: '',
        source: ''
    });

    const loadData = async () => {
        try {
            const res = await api.get('/market');
            setData(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/market', form);
            setIsAddOpen(false);
            setForm({ position_title: '', min_salary: '', max_salary: '', median_salary: '', source: '' });
            loadData();
        } catch (e) {
            alert('Error saving data');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить запись?')) return;
        try {
            await api.delete(`/market/${id}`);
            loadData();
        } catch (e) {
            alert('Error deleting');
        }
    };

    const filteredData = data.filter(i => i.position_title.toLowerCase().includes(search.toLowerCase()));

    const canEdit = user?.role === 'Administrator' || user?.permissions?.admin_access || user?.permissions?.edit_market;
    const canView = user?.role === 'Administrator' || user?.permissions?.admin_access || user?.permissions?.view_market || user?.permissions?.edit_market || user?.permissions?.manage_planning;

    if (loading) return <div className="p-10">Загрузка...</div>;
    if (!canView) return <div className="p-10 text-center text-slate-500">У вас нет прав для просмотра этой страницы.</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Анализ рынка</h1>
                <p className="text-slate-500 mt-2 text-lg">Сравнение зарплатных предложений с рыночными показателями</p>
            </div>

            {/* Stats / Intro */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <Globe className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 font-medium uppercase">Всего позиций</div>
                        <div className="text-2xl font-bold text-slate-900">{data.length}</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 font-medium uppercase">Источники</div>
                        <div className="text-2xl font-bold text-slate-900">hh.kz, LinkedIn</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <BarChart2 className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 font-medium uppercase">Обновлено</div>
                        <div className="text-2xl font-bold text-slate-900">Сегодня</div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            className="w-full h-10 rounded-lg border border-slate-200 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                            placeholder="Поиск по должности..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    {canEdit && (
                        <button
                            onClick={() => setIsAddOpen(true)}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-lg shadow-slate-900/10"
                        >
                            <Plus className="w-4 h-4" /> Добавить данные
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                                <th className="px-6 py-4">Должность</th>
                                <th className="px-6 py-4 text-right text-slate-400">Мин.</th>
                                <th className="px-6 py-4 text-right text-emerald-600 font-bold bg-emerald-50/30">Медиана</th>
                                <th className="px-6 py-4 text-right text-slate-400">Макс.</th>
                                <th className="px-6 py-4">Источник</th>
                                <th className="px-6 py-4 text-right">Дата</th>
                                {canEdit && <th className="px-6 py-4 w-10"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.map(row => (
                                <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 font-medium text-slate-900">{row.position_title}</td>
                                    <td className="px-6 py-4 text-right text-slate-500 font-mono text-sm">{formatMoney(row.min_salary)}</td>
                                    <td className="px-6 py-4 text-right text-emerald-700 font-mono font-bold bg-emerald-50/10 text-sm">{formatMoney(row.median_salary)}</td>
                                    <td className="px-6 py-4 text-right text-slate-500 font-mono text-sm">{formatMoney(row.max_salary)}</td>
                                    <td className="px-6 py-4 text-sm text-blue-600 hover:underline cursor-pointer truncate max-w-[150px]">{row.source || '-'}</td>
                                    <td className="px-6 py-4 text-right text-slate-400 text-xs">{row.updated_at}</td>
                                    {canEdit && (
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDelete(row.id)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-slate-400">Данные не найдены</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900">Новая запись</h2>
                            <button onClick={() => setIsAddOpen(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors">
                                <Plus className="w-5 h-5 text-slate-500 rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Должность</label>
                                <input
                                    className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10"
                                    value={form.position_title}
                                    onChange={e => setForm({ ...form, position_title: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Мин.</label>
                                    <input type="number"
                                        className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10"
                                        value={form.min_salary}
                                        onChange={e => setForm({ ...form, min_salary: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-emerald-600 mb-1">Медиана</label>
                                    <input type="number"
                                        className="w-full h-10 rounded-lg border border-emerald-300 px-3 outline-none focus:ring-2 focus:ring-emerald-500/20 bg-emerald-50/10"
                                        value={form.median_salary}
                                        onChange={e => setForm({ ...form, median_salary: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Макс.</label>
                                    <input type="number"
                                        className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10"
                                        value={form.max_salary}
                                        onChange={e => setForm({ ...form, max_salary: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Источник</label>
                                <input
                                    className="w-full h-10 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10"
                                    value={form.source}
                                    onChange={e => setForm({ ...form, source: e.target.value })}
                                    placeholder="Например: hh.kz"
                                />
                            </div>
                            <button type="submit" className="w-full bg-slate-900 text-white h-11 rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 mt-2">
                                Сохранить
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
