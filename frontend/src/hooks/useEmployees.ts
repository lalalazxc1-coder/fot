import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { EmployeeRecord } from '../components/payroll/types';

export type Employee = EmployeeRecord;

export function useEmployees() {
    return useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const res = await api.get('/employees');
            return res.data as Employee[];
        },
    });
}

export function useCreateEmployee() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: any) => {
            const res = await api.post('/employees', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Сотрудник успешно создан");
            queryClient.invalidateQueries({ queryKey: ['employees'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка при создании: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useUpdateEmployee() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => {
            const res = await api.put(`/employees/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Сотрудник обновлен");
            queryClient.invalidateQueries({ queryKey: ['employees'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка обновления: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useDismissEmployee() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            const res = await api.post(`/employees/${id}/dismiss`);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Сотрудник уволен");
            queryClient.invalidateQueries({ queryKey: ['employees'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка: " + (err.response?.data?.detail || err.message));
        }
    });
}
