import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

// --- Types ---
export type Details = {
    name: string;
    position: string;
    branch: string;
    department: string;
    date?: string; // For approver
};

export type HistoryItem = {
    id: number;
    step_label: string | null;
    actor_name: string;
    action: string;
    comment: string | null;
    created_at: string;
};

export type RequestRow = {
    id: number;
    employee_id: number;
    employee_details: Details;
    requester_details: Details;
    approver_details?: Details; // Helper from API
    type: 'raise' | 'bonus';
    current_value: number;
    requested_value: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;

    // Workflow
    current_step_label: string;
    current_step_type: 'approval' | 'notification';
    can_approve: boolean;
    history: HistoryItem[];
};

// --- Hooks ---

export function useRequests() {
    return useQuery({
        queryKey: ['requests'],
        queryFn: async () => {
            const res = await api.get('/requests');
            return res.data as RequestRow[];
        },
    });
}

export function useCreateRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: {
            employee_id: number;
            type: string;
            current_value: number;
            requested_value: number;
            reason: string;
        }) => {
            const res = await api.post('/requests', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Заявка успешно создана");
            queryClient.invalidateQueries({ queryKey: ['requests'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка при создании заявки: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useUpdateRequestStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, status }: { id: number; status: 'approved' | 'rejected' }) => {
            const res = await api.patch(`/requests/${id}/status`, { status });
            return res.data;
        },
        onSuccess: (_, variables) => {
            toast.success(variables.status === 'approved' ? "Заявка одобрена" : "Заявка отклонена");
            queryClient.invalidateQueries({ queryKey: ['requests'] });
        },
        onError: (err: any) => {
            toast.error("Ошибка обновления статуса: " + (err.response?.data?.detail || err.message));
        }
    });
}
