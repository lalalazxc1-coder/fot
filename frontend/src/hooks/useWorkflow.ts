import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { StepCreatePayload, StepUpdatePayload, ApiError } from '../types';

export interface ApprovalStep {
    id: number;
    step_order: number;
    role_id: number | null;
    user_id: number | null;
    role_name?: string;
    user_name?: string;
    label: string | null;
    is_final: boolean;
    step_type: string;
    notify_on_completion: boolean;
    condition_type?: string | null;
    condition_amount?: number | null;
}

export function useWorkflow() {
    return useQuery({
        queryKey: ['workflow-steps'],
        queryFn: async () => {
            const res = await api.get('/workflow/steps');
            return res.data as ApprovalStep[];
        }
    });
}

export function useCreateStep() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: StepCreatePayload) => {
            const res = await api.post('/workflow/steps', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Step created");
            queryClient.invalidateQueries({ queryKey: ['workflow-steps'] });
        },
        onError: (err: ApiError) => {
            toast.error("Error creating step: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useUpdateStep() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number, data: StepUpdatePayload }) => {
            const res = await api.put(`/workflow/steps/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Step updated");
            queryClient.invalidateQueries({ queryKey: ['workflow-steps'] });
        },
        onError: (err: ApiError) => {
            toast.error("Error updating step: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useDeleteStep() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/workflow/steps/${id}`);
        },
        onSuccess: () => {
            toast.success("Step deleted");
            queryClient.invalidateQueries({ queryKey: ['workflow-steps'] });
        },
        onError: (err: ApiError) => {
            toast.error("Error deleting step: " + (err.response?.data?.detail || err.message));
        }
    });
}
