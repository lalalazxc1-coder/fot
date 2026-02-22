import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { MarketRow, MarketEntry, MarketCreatePayload, MarketUpdatePayload, MarketSyncResult, ApiError } from '../types';

export type { MarketRow };

export function useMarket() {
    return useQuery({
        queryKey: ['market'],
        queryFn: async () => {
            const res = await api.get('/market');
            return res.data as MarketRow[];
        },
    });
}

export function useCreateMarketEntry() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: MarketCreatePayload) => {
            const res = await api.post('/market', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Данные успешно добавлены");
            queryClient.invalidateQueries({ queryKey: ['market'] });
        },
        onError: (err: ApiError) => {
            toast.error("Ошибка при добавлении: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useUpdateMarketEntry() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: MarketUpdatePayload }) => {
            const res = await api.put(`/market/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Запись обновлена");
            queryClient.invalidateQueries({ queryKey: ['market'] });
        },
        onError: (err: ApiError) => {
            toast.error("Ошибка обновления: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useDeleteMarketEntry() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/market/${id}`);
        },
        onSuccess: () => {
            toast.success("Запись удалена");
            queryClient.invalidateQueries({ queryKey: ['market'] });
        },
        onError: (err: ApiError) => {
            toast.error("Ошибка удаления: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useBulkCreateMarketEntry() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (items: MarketCreatePayload[]) => {
            // Run in parallel
            await Promise.all(items.map(item => api.post('/market', item)));
        },
        onSuccess: (_data, variables) => {
            toast.success(`Импортировано ${variables.length} записей`);
            queryClient.invalidateQueries({ queryKey: ['market'] });
        },
        onError: (err: ApiError) => {
            toast.error("Ошибка импорта: " + (err.response?.data?.detail || err.message));
        }
    });
}

// Entries hooks
export function useMarketEntries(marketId: number) {
    return useQuery({
        queryKey: ['market-entries', marketId],
        queryFn: async () => {
            if (!marketId) return [];
            const res = await api.get(`/market/${marketId}/entries`);
            return res.data as MarketEntry[];
        },
        enabled: !!marketId
    });
}

export function useCreateMarketEntryPoint() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { market_id: number, company_name: string, salary: number }) => {
            const res = await api.post('/market/entries', data);
            return res.data;
        },
        onSuccess: (_data, variables) => {
            toast.success("Запись добавлена");
            queryClient.invalidateQueries({ queryKey: ['market-entries', variables.market_id] });
            queryClient.invalidateQueries({ queryKey: ['market'] }); // Update main stats
        },
        onError: (err: ApiError) => {
            toast.error("Ошибка добавления: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useDeleteMarketEntryPoint() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id }: { id: number, marketId: number }) => {
            await api.delete(`/market/entries/${id}`);
        },
        onSuccess: (_data, variables) => {
            toast.success("Запись удалена");
            queryClient.invalidateQueries({ queryKey: ['market-entries', variables.marketId] });
            queryClient.invalidateQueries({ queryKey: ['market'] }); // Update main stats
        },
        onError: (err: ApiError) => {
            toast.error("Ошибка удаления: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useSyncMarketData() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            const res = await api.post(`/market/${id}/sync-hh`);
            return res.data as MarketSyncResult;
        },
        onSuccess: (data: MarketSyncResult) => {
            toast.success(`Успешно! Найдено вакансий: ${data.count || 0}`);
            queryClient.invalidateQueries({ queryKey: ['market'] });
            queryClient.invalidateQueries({ queryKey: ['market-entries'] });
        },
        onError: (err: ApiError) => {
            toast.error("Ошибка синхронизации: " + (err.response?.data?.detail || err.message));
        }
    });
}
