import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { PlanCreatePayload, PlanUpdatePayload, ApiError } from '../types';

export type PlanRow = {
    id: number;
    position: string;
    branch_id?: string | number;
    department_id?: string | number;
    schedule?: string;
    count: number;
    base_net: number;
    base_gross: number;
    kpi_net: number;
    kpi_gross: number;
    bonus_net: number;
    bonus_gross: number;
    bonus_count?: number | null;
};

export function usePlanningData() {
    return useQuery({
        queryKey: ['planning'],
        queryFn: async () => {
            const res = await api.get('/planning');
            return res.data as PlanRow[];
        },
    });
}

export function useCreatePlanItem() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: PlanCreatePayload) => {
            const res = await api.post('/planning', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Позиция добавлена");
            queryClient.invalidateQueries({ queryKey: ['planning'] });
        },
        onError: (err: ApiError) => {
            toast.error("Ошибка: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useUpdatePlanItem() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: PlanUpdatePayload }) => {
            const res = await api.patch(`/planning/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Позиция обновлена");
            queryClient.invalidateQueries({ queryKey: ['planning'] });
        },
        onError: (err: ApiError) => {
            toast.error("Ошибка: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useDeletePlanItem() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/planning/${id}`);
        },
        onSuccess: () => {
            toast.success("Позиция удалена");
            queryClient.invalidateQueries({ queryKey: ['planning'] });
        },
        onError: (err: ApiError) => {
            toast.error("Ошибка удаления: " + (err.response?.data?.detail || err.message));
        }
    });
}

export type PlanHistoryItem = {
    date: string;
    user: string;
    field: string;
    oldVal: string;
    newVal: string;
};

export function usePlanningHistory(id: number, isOpen: boolean) {
    return useQuery({
        queryKey: ['planning', id, 'history'],
        queryFn: async () => {
            const res = await api.get(`/planning/${id}/history`);
            return res.data as PlanHistoryItem[];
        },
        enabled: isOpen && id > 0
    });
}
