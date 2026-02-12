import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

export interface ApprovalStep {
    id: number;
    step_order: number;
    role_id: number;
    role_name: string;
    label: string | null;
    is_final: boolean;
    step_type: 'approval' | 'notification';
    notify_on_completion: boolean;
}

export function useWorkflow() {
    return useQuery({
        queryKey: ['workflow-steps'],
        queryFn: async () => {
            const res = await api.get('/workflow/steps');
            return res.data;
        }
    });
}

export function useCreateStep() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: any) => {
            const res = await api.post('/workflow/steps', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Step created");
            queryClient.invalidateQueries({ queryKey: ['workflow-steps'] });
        },
        onError: (err: any) => {
            toast.error("Error creating step: " + (err.response?.data?.detail || err.message));
        }
    });
}

export function useUpdateStep() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number, data: any }) => {
            const res = await api.put(`/workflow/steps/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Step updated");
            queryClient.invalidateQueries({ queryKey: ['workflow-steps'] });
        },
        onError: (err: any) => {
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
        onError: (err: any) => {
            toast.error("Error deleting step: " + (err.response?.data?.detail || err.message));
        }
    });
}
