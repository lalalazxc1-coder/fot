import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { Settings, Save, RefreshCw, AlertCircle } from 'lucide-react';

interface ConfigItem {
    value: string;
    description: string;
}

export default function AnalyticsSettingsPage() {
    const [config, setConfig] = useState<Record<string, ConfigItem>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const res = await api.get('/analytics/config');
            setConfig(res.data);
        } catch (e) {
            toast.error("Ошибка при загрузке настроек");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload = Object.keys(config).reduce((acc, key) => {
                acc[key] = config[key].value;
                return acc;
            }, {} as Record<string, string>);
            
            await api.post('/analytics/config', payload);
            toast.success("Настройки аналитики обновлены");
        } catch (e) {
            toast.error("Ошибка при сохранении");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center p-20">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
        </div>
    );

    return (
        <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-slate-900 rounded-2xl text-white">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Конфигурация аналитики</h2>
                        <p className="text-slate-500">Управление глобальными параметрами расчета рисков</p>
                    </div>
                </div>

                <div className="space-y-10">
                    {/* Retention Risk Section */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            <h3 className="text-lg font-bold text-slate-800">Пороги рисков удержания (Retention)</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {config['retention_stagnation_months'] && (
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700 block uppercase tracking-wider">
                                        Лимит стагнации (мес.)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={config['retention_stagnation_months'].value}
                                            onChange={(e) => setConfig({
                                                ...config,
                                                'retention_stagnation_months': { ...config['retention_stagnation_months'], value: e.target.value }
                                            })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all font-mono"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold uppercase">мес.</div>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {config['retention_stagnation_months'].description}
                                    </p>
                                </div>
                            )}

                            {config['retention_market_gap_percent'] && (
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700 block uppercase tracking-wider">
                                        Разрыв с рынком (%)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={config['retention_market_gap_percent'].value}
                                            onChange={(e) => setConfig({
                                                ...config,
                                                'retention_market_gap_percent': { ...config['retention_market_gap_percent'], value: e.target.value }
                                            })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all font-mono"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold uppercase">%</div>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {config['retention_market_gap_percent'].description}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-3 px-8 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-bold shadow-lg shadow-slate-900/20 disabled:opacity-50"
                        >
                            {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Сохранить настройки
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
