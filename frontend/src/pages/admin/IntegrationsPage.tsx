import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Save, Info, CheckCircle, XCircle, Key, Loader2, Trash2, Play } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function IntegrationsPage() {
    const queryClient = useQueryClient();
    const { data: settings, isLoading } = useQuery({
        queryKey: ['integrations'],
        queryFn: async () => {
            const res = await api.get('/integrations/settings');
            return res.data;
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await api.post('/integrations/settings', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['integrations'] });
            toast.success('Настройки сохранены');
        },
        onError: () => toast.error('Ошибка сохранения')
    });

    if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6 max-w-4xl">
            <h2 className="text-xl font-bold text-slate-900">Внешние интеграции</h2>
            <p className="text-slate-500">Настройте подключение к внешним сервисам для поиска кандидатов и аналитики.</p>

            <div className="grid gap-6">
                {settings?.map((service: any) => (
                    <IntegrationCard
                        key={service.id}
                        service={service}
                        onSave={(data: any) => updateMutation.mutate({ ...data, service_name: service.service_name })}
                        isSaving={updateMutation.isPending}
                    />
                ))}
            </div>
        </div>
    );
}

const IntegrationCard = ({ service, onSave, isSaving }: any) => {
    const [apiKey, setApiKey] = useState('');
    const [clientId, setClientId] = useState(service.client_id || '');
    const [clientSecret, setClientSecret] = useState('');
    const [isActive, setIsActive] = useState(service.is_active);
    const [isTesting, setIsTesting] = useState(false);

    const isHH = service.service_name === 'hh';
    const isAI = service.service_name === 'openai';

    const handleSave = () => {
        const payload: any = { is_active: isActive };
        // Clean strings
        if (apiKey.trim()) payload.api_key = apiKey.trim();
        if (clientId.trim()) payload.client_id = clientId.trim();
        if (clientSecret.trim()) payload.client_secret = clientSecret.trim();
        onSave(payload);
    };

    const handleClear = () => {
        if (!confirm('Вы уверены, что хотите удалить ключи подключения? Интеграция перестанет работать.')) return;
        // Sending empty strings to clear
        const payload: any = { is_active: false, api_key: "", client_id: "", client_secret: "" };
        onSave(payload);
        setApiKey('');
        setClientId('');
        setClientSecret('');
    };

    const handleTest = async () => {
        setIsTesting(true);
        try {
            const payload: any = { service_name: service.service_name };
            if (apiKey.trim()) payload.api_key = apiKey.trim();
            if (clientId.trim()) payload.client_id = clientId.trim();
            if (clientSecret.trim()) payload.client_secret = clientSecret.trim();

            const res = await api.post('/integrations/test-connection', payload);
            if (res.data.success) {
                toast.success(res.data.message);
            } else {
                toast.error(res.data.message);
            }
        } catch (e: any) {
            toast.error("Ошибка соединения: " + (e.response?.data?.message || e.message));
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className={`p-6 rounded-2xl border transition-all ${isActive ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isActive ? (isHH ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600') : 'bg-slate-200 text-slate-500'}`}>
                        {isHH ? <p className="font-bold text-lg">hh.ru</p> : <p className="font-bold text-lg">AI</p>}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">
                            {isHH ? 'HeadHunter API' : 'ИИ Ассистент (OpenAI/DeepSeek)'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            {isActive ? (
                                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    <CheckCircle className="w-3 h-3" /> Активно
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                                    <XCircle className="w-3 h-3" /> Отключено
                                </span>
                            )}
                            {service.updated_at && (
                                <span className="text-xs text-slate-400">Обновлено: {new Date(service.updated_at).toLocaleDateString()}</span>
                            )}
                        </div>
                    </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                </label>
            </div>

            {isActive && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {isHH && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Client ID</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={clientId}
                                        onChange={e => setClientId(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                                        placeholder="Введите Client ID приложения"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Client Secret</label>
                                <div className="flex gap-2 relative">
                                    <input
                                        type="password"
                                        value={clientSecret}
                                        onChange={e => setClientSecret(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 pr-10"
                                        placeholder={service.has_client_secret ? "•••••••• (Сохранен)" : "Введите Client Secret"}
                                    />
                                    <Key className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                                </div>
                            </div>
                            <div className="bg-blue-50 p-3 rounded-lg flex gap-3 text-sm text-blue-700">
                                <Info className="w-5 h-5 flex-shrink-0" />
                                <p>
                                    Зарегистрируйте приложение на <a href="https://dev.hh.ru/admin" target="_blank" className="underline font-bold hover:text-blue-900">dev.hh.ru</a>.
                                    Используйте <code>Client Credentials</code> Grant Type.
                                </p>
                            </div>
                        </>
                    )}

                    {isAI && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
                                <div className="flex gap-2 relative">
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={e => setApiKey(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 pr-10"
                                        placeholder={service.has_api_key ? "sk-•••••••• (Сохранен)" : "sk-..."}
                                    />
                                    <Key className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                                </div>
                            </div>
                            <div className="bg-slate-100 p-3 rounded-lg flex gap-3 text-sm text-slate-600">
                                <Info className="w-5 h-5 flex-shrink-0" />
                                <p>Используется для анализа резюме и матчинга вакансий. Поддерживаются ключи OpenAI.</p>
                            </div>
                        </>
                    )}

                    <div className="pt-2 flex justify-between items-center border-t border-slate-100 mt-4 pt-4">
                        <button
                            onClick={handleClear}
                            className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" /> Удалить ключи
                        </button>

                        <div className="flex gap-3">
                            {/* Test Button only if saved or has values */}
                            <button
                                onClick={handleTest}
                                disabled={isTesting || (!service.has_api_key && !apiKey && !service.has_client_secret)}
                                className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                Проверить связь
                            </button>

                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Сохранить настройки
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
