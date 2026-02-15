import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const ESGReport = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/analytics/esg/pay-equity').then(res => {
            setData(res.data);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, []);

    if (loading) return <div className="p-10 text-center text-slate-500">Загрузка метрик ESG...</div>;

    const formatMoney = (val: number) => {
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT', minimumFractionDigits: 0 }).format(val);
    };

    const translateCategory = (cat: string) => {
        const map: Record<string, string> = {
            'Male': 'Мужчины',
            'Female': 'Женщины',
            'Gen Z': 'Поколение Z',
            'Millennials': 'Миллениалы',
            'Gen X': 'Поколение X',
            'Boomers': 'Бумеры'
        };
        return map[cat] || cat;
    };

    return (
        <div className="p-6 space-y-6 bg-slate-50">
            <h2 className="text-2xl font-bold text-emerald-800 border-b pb-4">Отчетность ESG и Равенство оплаты</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Gender Gap */}
                <div className="bg-white p-6 rounded-xl shadow-sm h-[400px] border border-slate-100">
                    <h3 className="font-semibold text-lg mb-6 text-slate-700 flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-sm"></span>
                        Гендерный разрыв в оплате
                    </h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={data.gender_equity} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="category" tickFormatter={translateCategory} />
                            <YAxis tickFormatter={(val) => `${val / 1000}k`} />
                            <Tooltip
                                formatter={(val: number) => [formatMoney(val), 'Ср. Гросс ЗП']}
                                labelFormatter={translateCategory}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="avg_salary" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Age Gap */}
                <div className="bg-white p-6 rounded-xl shadow-sm h-[400px] border border-slate-100">
                    <h3 className="font-semibold text-lg mb-6 text-slate-700 flex items-center gap-2">
                        <span className="w-2 h-6 bg-blue-500 rounded-sm"></span>
                        Оплата по поколениям
                    </h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={data.age_equity} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="category" tickFormatter={translateCategory} tick={{ fontSize: 10 }} interval={0} />
                            <YAxis tickFormatter={(val) => `${val / 1000}k`} />
                            <Tooltip
                                formatter={(val: number) => [formatMoney(val), 'Ср. Гросс ЗП']}
                                labelFormatter={translateCategory}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="avg_salary" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm mt-6 border border-slate-200">
                <h3 className="font-semibold mb-4 text-slate-700">Детальные метрики</h3>
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <h4 className="text-sm font-bold text-slate-400 uppercase mb-2">По полу</h4>
                        <ul className="space-y-2">
                            {data.gender_equity.map((item: any) => (
                                <li key={item.category} className="flex justify-between border-b border-slate-50 pb-2">
                                    <span className="text-slate-600 font-medium">{translateCategory(item.category)}</span>
                                    <span className="font-mono text-emerald-600">{formatMoney(item.avg_salary)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-400 uppercase mb-2">По поколениям</h4>
                        <ul className="space-y-2">
                            {data.age_equity.map((item: any) => (
                                <li key={item.category} className="flex justify-between border-b border-slate-50 pb-2">
                                    <span className="text-slate-600 font-medium">{translateCategory(item.category)}</span>
                                    <span className="font-mono text-blue-600">{formatMoney(item.avg_salary)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
