import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Save, Info, CheckCircle, XCircle, Key, Loader2, Trash2, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface IntegrationService {
    id: number;
    service_name: string;
    is_active: boolean;
    has_api_key: boolean;
    has_client_secret: boolean;
    client_id?: string | null;
    updated_at?: string;
    additional_params?: Record<string, unknown>;
}

interface IntegrationSettingsPayload {
    service_name?: string;
    is_active: boolean;
    api_key?: string;
    client_id?: string;
    client_secret?: string;
    additional_params?: Record<string, unknown>;
}

interface TestConnectionPayload {
    service_name: string;
    api_key?: string;
    client_id?: string;
    client_secret?: string;
    base_url?: string;
}

interface TestConnectionResponse {
    success: boolean;
    message: string;
}

const getApiErrorMessage = (error: unknown): string => {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: { message?: string } } }).response;
        if (response?.data?.message) {
            return response.data.message;
        }
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'Неизвестная ошибка';
};

export default function IntegrationsPage() {
    const queryClient = useQueryClient();
    const { data: settings = [], isLoading } = useQuery<IntegrationService[]>({
        queryKey: ['integrations'],
        queryFn: async () => {
            const res = await api.get<IntegrationService[]>('/integrations/settings');
            return res.data;
        }
    });

    const updateMutation = useMutation<IntegrationService, unknown, IntegrationSettingsPayload>({
        mutationFn: async (data) => {
            const res = await api.post<IntegrationService>('/integrations/settings', data);
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
                {settings.map((service) => (
                    <IntegrationCard
                        key={`${service.id}-${service.updated_at}`}
                        service={service}
                        onSave={(data) => updateMutation.mutate({ ...data, service_name: service.service_name })}
                        isSaving={updateMutation.isPending}
                    />
                ))}
            </div>
        </div>
    );
}

type IntegrationCardProps = {
    service: IntegrationService;
    onSave: (data: IntegrationSettingsPayload) => void;
    isSaving: boolean;
};

const IntegrationCard = ({ service, onSave, isSaving }: IntegrationCardProps) => {
    const [apiKey, setApiKey] = useState('');
    const [clientId, setClientId] = useState(service.client_id || '');
    const [clientSecret, setClientSecret] = useState('');
    const [isActive, setIsActive] = useState(service.is_active);
    const [isTesting, setIsTesting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const isHH = service.service_name === 'hh';
    const isAI = service.service_name === 'openai';
    const isOneC = service.service_name === 'onec';

    const [baseUrl, setBaseUrl] = useState(() => {
        if (service.additional_params?.base_url) return service.additional_params.base_url as string;
        if (isAI) return 'https://api.openai.com/v1';
        if (isOneC) return 'http://host.docker.internal/mybase';
        return '';
    });

    const handleSave = () => {
        const payload: IntegrationSettingsPayload = { is_active: isActive };
        // Clean strings
        if (apiKey.trim()) payload.api_key = apiKey.trim();
        if (clientId.trim()) payload.client_id = clientId.trim();
        if (clientSecret.trim()) payload.client_secret = clientSecret.trim();

        if (isAI || isOneC) {
            payload.additional_params = { ...service.additional_params, base_url: baseUrl };
        }

        onSave(payload);
    };

    const handleClear = () => {
        if (!confirm('Вы уверены, что хотите удалить ключи подключения? Интеграция перестанет работать.')) return;
        // Sending empty strings to clear
        const payload: IntegrationSettingsPayload = { is_active: false, api_key: '', client_id: '', client_secret: '' };
        onSave(payload);
        setApiKey('');
        setClientId('');
        setClientSecret('');
    };

    const handleTest = async () => {
        setIsTesting(true);
        try {
            const payload: TestConnectionPayload = { service_name: service.service_name };
            if (apiKey.trim()) payload.api_key = apiKey.trim();
            if (clientId.trim()) payload.client_id = clientId.trim();
            if (clientSecret.trim()) payload.client_secret = clientSecret.trim();
            if (isAI || isOneC) payload.base_url = baseUrl;

            const res = await api.post<TestConnectionResponse>('/integrations/test-connection', payload);
            if (res.data.success) {
                toast.success(res.data.message);
            } else {
                toast.error(res.data.message);
            }
        } catch (error: unknown) {
            toast.error(`Ошибка соединения: ${getApiErrorMessage(error)}`);
        } finally {
            setIsTesting(false);
        }
    };

    const getIcon = () => {
        if (isHH) return <p className="font-bold text-lg">hh.ru</p>;
        if (isAI) return <p className="font-bold text-lg">AI</p>;
        if (isOneC) return <p className="font-bold text-lg text-yellow-600">1C</p>;
        return <Info className="w-6 h-6" />;
    };

    const getTitle = () => {
        if (isHH) return 'HeadHunter API';
        if (isAI) return 'ИИ Ассистент (OpenAI/DeepSeek)';
        if (isOneC) return '1С:Предприятие (ЗУП/ERP)';
        return service.service_name;
    };

    const cardColorClass = isActive
        ? (isHH ? 'bg-red-100 text-red-600' : (isAI ? 'bg-emerald-100 text-emerald-600' : 'bg-yellow-100 text-yellow-700'))
        : 'bg-slate-200 text-slate-500';

    return (
        <div className={`p-6 rounded-2xl border transition-all ${isExpanded ? 'bg-white border-blue-200 shadow-md ring-1 ring-blue-50' : (isActive ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300' : 'bg-slate-50 border-slate-200 opacity-80 hover:opacity-100')}`}>
            <div
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl transition-colors ${cardColorClass}`}>
                        {getIcon()}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {getTitle()}
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

                <div className="flex items-center gap-6" onClick={e => e.stopPropagation()}>
                    <label className="relative inline-flex items-center cursor-pointer" title={isActive ? 'Отключить интеграцию' : 'Включить интеграцию'}>
                        <input type="checkbox" className="sr-only peer" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                    </label>
                    <button
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors flex items-center justify-center"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                    >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300 mt-6 pt-6 border-t border-slate-100 relative">
                    {!isAI && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                {isOneC ? 'Адрес сервера (Base URL)' : 'Client ID'}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={isOneC ? baseUrl : clientId}
                                    onChange={e => isOneC ? setBaseUrl(e.target.value) : setClientId(e.target.value)}
                                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                                    placeholder={isOneC ? "http://192.168.1.10/mybase" : "Введите Client ID приложения"}
                                />
                            </div>
                        </div>
                    )}

                    {isOneC && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Имя пользователя (Логин)</label>
                            <input
                                type="text"
                                value={clientId}
                                onChange={e => setClientId(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="Admin"
                            />
                        </div>
                    )}

                    {(isHH || isOneC) && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                {isOneC ? 'Пароль' : 'Client Secret'}
                            </label>
                            <div className="flex gap-2 relative">
                                <input
                                    type="password"
                                    value={clientSecret}
                                    onChange={e => setClientSecret(e.target.value)}
                                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 pr-10"
                                    placeholder={service.has_client_secret ? "•••••••• (Сохранен)" : (isOneC ? "Введите пароль" : "Введите Client Secret")}
                                />
                                <Key className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                            </div>
                        </div>
                    )}

                    {isHH && (
                        <div className="bg-blue-50 p-3 rounded-lg flex gap-3 text-sm text-blue-700">
                            <Info className="w-5 h-5 flex-shrink-0" />
                            <p>
                                Зарегистрируйте приложение на <a href="https://dev.hh.ru/admin" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-blue-900">dev.hh.ru</a>.
                                Используйте <code>Client Credentials</code> Grant Type.
                            </p>
                        </div>
                    )}

                    {isOneC && (
                        <div className="bg-yellow-50 p-3 rounded-lg flex gap-3 text-sm text-yellow-800 border border-yellow-100">
                            <Info className="w-5 h-5 flex-shrink-0" />
                            <p>
                                Для интеграции 1С должен быть опубликован HTTP-сервис.
                                Проверьте, что адрес доступен с сервера приложения.
                            </p>
                        </div>
                    )}

                    {isAI && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Провайдер / Base URL</label>
                                <div className="flex gap-2 mb-3">
                                    <button
                                        onClick={() => setBaseUrl('https://api.openai.com/v1')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${baseUrl.includes('openai.com') ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                                    >
                                        OpenAI
                                    </button>
                                    <button
                                        onClick={() => setBaseUrl('https://api.deepseek.com')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${baseUrl.includes('deepseek.com') ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                                    >
                                        DeepSeek
                                    </button>
                                    <button
                                        onClick={() => setBaseUrl('https://openrouter.ai/api/v1')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${baseUrl.includes('openrouter.ai') ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                                    >
                                        OpenRouter
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={baseUrl}
                                    onChange={e => setBaseUrl(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                                    placeholder="https://api.openai.com/v1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
                                <div className="flex gap-2 relative">
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={e => setApiKey(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 pr-10"
                                        placeholder={service.has_api_key ? "•••••••• (Сохранен)" : "Введите API Key"}
                                    />
                                    <Key className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                                </div>
                            </div>
                            <div className="bg-slate-100 p-3 rounded-lg flex gap-3 text-sm text-slate-600">
                                <Info className="w-5 h-5 flex-shrink-0" />
                                <p>Используется для анализа резюме и матчинга вакансий. Поддерживаются OpenAI, DeepSeek и OpenRouter.</p>
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
                            <button
                                onClick={handleTest}
                                disabled={isTesting || (!service.has_api_key && !apiKey && !service.has_client_secret && !clientSecret && !clientId)}
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
