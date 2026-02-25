import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { UserCreatePayload, UserUpdatePayload, RoleCreatePayload, RoleUpdatePayload, ApiError } from '../types';

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
    is_active: boolean;
};

export type Role = {
    id: number;
    name: string;
    permissions: Record<string, boolean>;
};

export type AdminStats = {
    counts: {
        employees: number;
        users: number;
        branches: number;
        pending_requests: number;
    };
    budget: {
        total: number;
        avg: number;
    };
    activity: {
        id: number;
        user: string;
        action: string;
        entity: string;
        time: string;
    }[];
    charts: {
        requests: { labels: string[]; data: number[] };
        roles: { labels: string[]; data: number[] };
    };
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

export function useAuditLogs(page: number = 1, limit: number = 50, entity?: string) {
    return useQuery({
        queryKey: ['audit-logs', page, limit, entity],
        queryFn: async () => {
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            if (entity) params.set('entity', entity);
            const res = await api.get(`/admin/logs?${params}`);
            return res.data as {
                logs: any[];
                total: number;
                page: number;
                limit: number;
                total_pages: number;
            };
        },
    });
}

export function useLoginLogs(page: number = 1, limit: number = 50, action?: string) {
    return useQuery({
        queryKey: ['login-logs', page, limit, action],
        queryFn: async () => {
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            if (action) params.set('action', action);
            const res = await api.get(`/admin/login-logs?${params}`);
            return res.data as {
                logs: any[];
                total: number;
                page: number;
                limit: number;
                total_pages: number;
            };
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
        mutationFn: async (data: UserCreatePayload) => {
            const res = await api.post('/users', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Пользователь успешно создан");
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
        },
        onError: (err: ApiError) => {
            toast.error("Ошибка при создании: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useUpdateUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: UserUpdatePayload }) => {
            const res = await api.put(`/users/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Пользователь обновлен");
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
        onError: (err: ApiError) => {
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
        onError: (err: ApiError) => {
            toast.error("Ошибка при удалении: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useToggleBlockUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            const res = await api.patch(`/users/${id}/toggle_block`);
            return res.data;
        },
        onSuccess: (data: { is_active: boolean }) => {
            if (data.is_active) {
                toast.success("Пользователь разблокирован");
            } else {
                toast.success("Пользователь заблокирован");
            }
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
        onError: (err: ApiError) => {
            toast.error("Ошибка при блокировке: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useCreateRole() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: RoleCreatePayload) => {
            const res = await api.post('/roles', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Роль создана");
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
        onError: (err: ApiError) => {
            toast.error("Ошибка при создании роли: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useUpdateRole() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: RoleUpdatePayload }) => {
            const res = await api.put(`/roles/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Роль обновлена");
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
        onError: (err: ApiError) => {
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
        onError: (err: ApiError) => {
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
        refetchInterval: 5000 // Poll every 5s for better responsiveness
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

export function useMarkAllNotificationsRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            await api.post('/auth/notifications/read-all');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });
}

export function useDeleteAllNotifications() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            await api.delete('/auth/notifications');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });
}
