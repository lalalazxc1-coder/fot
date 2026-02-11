import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

export type StructureItem = {
    id: number;
    name: string;
    departments: { id: number; name: string }[];
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

export function useCreateBranch() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (name: string) => {
            const res = await api.post('/structure/branch', { name, type: 'branch' });
            return res.data;
        },
        onSuccess: () => {
            toast.success("Филиал создан");
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
        mutationFn: async ({ name, parent_id }: { name: string; parent_id: number }) => {
            const res = await api.post('/structure/department', { name, type: 'department', parent_id });
            return res.data;
        },
        onSuccess: () => {
            toast.success("Отдел создан");
            queryClient.invalidateQueries({ queryKey: ['structure'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка: " + (err.response?.data?.detail || err.message));
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
