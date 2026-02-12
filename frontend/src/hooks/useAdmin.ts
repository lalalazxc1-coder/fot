import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

// --- Types ---
export type User = {
    id: number;
    email: string;
    role_name: string;
    full_name: string;
    role_id: number;
    scope_branches?: number[];
    scope_departments?: number[];
    scope_unit_name?: string;
};

export type Role = {
    id: number;
    name: string;
    permissions: Record<string, boolean>;
};

export type AdminStats = {
    employees: number;
    users: number;
    branches: number;
    budget: number;
};

export type Notification = {
    id: number;
    user_id: number;
    message: string;
    is_read: boolean;
    created_at: string;
    link?: string;
};

// --- Hooks ---

export function useAdminStats() {
    return useQuery({
        queryKey: ['admin-stats'],
        queryFn: async () => {
            const res = await api.get('/admin/stats');
            return res.data as AdminStats;
        },
    });
}

export function useUsers() {
    return useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await api.get('/users');
            return res.data as User[];
        },
    });
}

export function useRoles() {
    return useQuery({
        queryKey: ['roles'],
        queryFn: async () => {
            const res = await api.get('/roles');
            return res.data as Role[];
        },
    });
}

export function useCreateUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: any) => {
            const res = await api.post('/users', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Пользователь успешно создан");
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка при создании: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useUpdateUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => {
            const res = await api.put(`/users/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Пользователь обновлен");
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка при обновлении: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useDeleteUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/users/${id}`);
        },
        onSuccess: () => {
            toast.success("Пользователь удален");
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка при удалении: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useCreateRole() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: any) => {
            const res = await api.post('/roles', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Роль создана");
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка при создании роли: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useUpdateRole() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => {
            const res = await api.put(`/roles/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Роль обновлена");
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка при обновлении роли: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useDeleteRole() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/roles/${id}`);
        },
        onSuccess: () => {
            toast.success("Роль удалена");
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка при удалении роли: " + (err.response?.data?.detail || err.message));
        }
    });
}

// Notifications
export function useNotifications() {
    return useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const res = await api.get('/auth/notifications');
            return res.data as Notification[];
        },
        refetchInterval: 30000 // Poll every 30s
    });
}

export function useMarkNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.patch(`/auth/notifications/${id}/read`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });
}
