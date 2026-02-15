import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

export type StructureItem = {
    id: number;
    name: string;
    departments: { id: number; name: string; parent_id?: number | null; type?: string }[];
};

export type FlatStructureItem = {
    id: number;
    name: string;
    type: 'head_office' | 'branch' | 'department';
    parent_id: number | null;
    head_id: number | null;
    head: { id: number; full_name: string; position: string; salary: number } | null;
    employee_count: number;
    total_salary: number;  // NEW: Total salary including children
};

export function useStructure() {
    return useQuery({
        queryKey: ['structure'],
        queryFn: async () => {
            const res = await api.get('/structure');
            return res.data as StructureItem[];
        },
        staleTime: 10 * 60 * 1000 // Structure rarely changes
    });
}

export function useFlatStructure(date?: string | null) {
    return useQuery({
        queryKey: ['structure', 'flat', date],
        queryFn: async () => {
            const params = date ? { date } : {};
            const res = await api.get('/structure/flat', { params });
            return res.data as FlatStructureItem[];
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: (previousData) => previousData // Keep defined data while loading new
    });
}

export function useCreateBranch() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ name, head_id, type }: { name: string; head_id?: number; type?: string }) => {
            const unitType = type || 'branch';
            const endpoint = unitType === 'head_office' ? '/structure/head_office' : '/structure/branch';
            const res = await api.post(endpoint, { name, type: unitType, head_id });
            return res.data;
        },
        onSuccess: () => {
            toast.success("Структура создана");
            queryClient.invalidateQueries({ queryKey: ['structure'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useCreateDepartment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ name, parent_id, head_id, type }: { name: string; parent_id: number; head_id?: number; type?: string }) => {
            const unitType = type || 'department';
            const endpoint = unitType === 'branch' ? '/structure/branch' : '/structure/department';
            const res = await api.post(endpoint, { name, type: unitType, parent_id, head_id });
            return res.data;
        },
        onSuccess: () => {
            toast.success("Подразделение создано");
            queryClient.invalidateQueries({ queryKey: ['structure'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useUpdateUnit() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: Partial<FlatStructureItem> }) => {
            // Only send what's needed
            const payload: any = {};
            if (data.name) payload.name = data.name;
            if (data.parent_id !== undefined) payload.parent_id = data.parent_id;
            if (data.head_id !== undefined) payload.head_id = data.head_id;

            const res = await api.patch(`/structure/${id}`, payload);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Структура обновлена");
            queryClient.invalidateQueries({ queryKey: ['structure'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка обновления: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useDeleteStructure() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/structure/${id}`);
        },
        onSuccess: () => {
            toast.success("Удалено успешно");
            queryClient.invalidateQueries({ queryKey: ['structure'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка удаления: " + (err.response?.data?.detail || err.message));
        }
    });
}
