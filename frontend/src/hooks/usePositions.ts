import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Position } from '../types';

export function usePositions() {
    return useQuery({
        queryKey: ['positions'],
        queryFn: async () => {
            const res = await api.get('/positions');
            return res.data as Position[];
        },
    });
}

export function useCreatePosition() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { title: string, grade: number }) => {
            const res = await api.post('/positions', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Должность добавлена");
            queryClient.invalidateQueries({ queryKey: ['positions'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка добавления: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useUpdatePosition() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number, data: { title: string, grade: number } }) => {
            const res = await api.put(`/positions/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Должность обновлена");
            queryClient.invalidateQueries({ queryKey: ['positions'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка обновления: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useDeletePosition() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/positions/${id}`);
        },
        onSuccess: () => {
            toast.success("Должность удалена");
            queryClient.invalidateQueries({ queryKey: ['positions'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка удаления: " + (err.response?.data?.detail || err.message));
        }
    });
}
