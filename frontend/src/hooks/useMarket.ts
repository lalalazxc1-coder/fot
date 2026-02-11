import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

import { MarketRow } from '../types';

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
        mutationFn: async (data: any) => {
            const res = await api.post('/market', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Данные успешно добавлены");
            queryClient.invalidateQueries({ queryKey: ['market'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка при добавлении: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useUpdateMarketEntry() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => {
            const res = await api.put(`/market/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Запись обновлена");
            queryClient.invalidateQueries({ queryKey: ['market'] });
        },
        onError: (err: any) => {
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
        onError: (err: any) => {
            toast.error("Ошибка удаления: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useBulkCreateMarketEntry() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (items: any[]) => {
            // Run in parallel
            await Promise.all(items.map(item => api.post('/market', item)));
        },
        onSuccess: (_data, variables) => {
            toast.success(`Импортировано ${variables.length} записей`);
            queryClient.invalidateQueries({ queryKey: ['market'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка импорта: " + (err.response?.data?.detail || err.message));
        }
    });
}
