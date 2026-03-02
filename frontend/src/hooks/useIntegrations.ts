import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type IntegrationSetting = {
    id: number;
    service_name: string;
    is_active: boolean;
    api_key?: string;
    client_id?: string;
    client_secret?: string;
    additional_params?: Record<string, any>;
    updated_at: string;
};

export function useIntegrations() {
    return useQuery({
        queryKey: ['integrations-settings'],
        queryFn: async () => {
            const res = await api.get('/integrations/settings');
            return res.data as IntegrationSetting[];
        },
    });
}
