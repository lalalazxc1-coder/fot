import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

// --- Types ---
export type SummaryData = {
    fact: { total_net: number; count: number };
    plan: { total_net: number; count: number };
    metrics: {
        diff_net: number;
        execution_percent: number;
        headcount_diff: number;
        is_over_budget: boolean;
    };
    cached_at: string;
};

export type BranchComparison = {
    id: number;
    name: string;
    plan: number;
    fact: number;
    diff: number;
    percent: number;
};

export type TopEmployee = {
    id: number;
    full_name: string;
    position: string;
    branch: string;
    total_net: number;
};

export type CostDistribution = {
    name: string;
    value: number;
};

// --- Hooks ---

export function useAnalytics() {
    const summary = useQuery({
        queryKey: ['analytics', 'summary'],
        queryFn: async () => {
            const res = await api.get('/analytics/summary');
            return res.data as SummaryData;
        },
    });

    const branchComparison = useQuery({
        queryKey: ['analytics', 'branch-comparison'],
        queryFn: async () => {
            const res = await api.get('/analytics/branch-comparison');
            let data = [];
            // Helper to safely extract arrays (copied logic from old component)
            if (Array.isArray(res.data)) data = res.data;
            else if (res.data && Array.isArray(res.data.data)) data = res.data.data;

            // Sort comparison by Fact descending
            return data.sort((a: BranchComparison, b: BranchComparison) => b.fact - a.fact) as BranchComparison[];
        },
    });

    const topEmployees = useQuery({
        queryKey: ['analytics', 'top-employees'],
        queryFn: async () => {
            const res = await api.get('/analytics/top-employees?limit=5');
            if (Array.isArray(res.data)) return res.data as TopEmployee[];
            if (res.data && Array.isArray(res.data.data)) return res.data.data as TopEmployee[];
            return [];
        },
    });

    const costDistribution = useQuery({
        queryKey: ['analytics', 'cost-distribution'],
        queryFn: async () => {
            const res = await api.get('/analytics/cost-distribution');
            let data: CostDistribution[] = [];
            if (Array.isArray(res.data)) data = res.data;
            else if (res.data && Array.isArray(res.data.data)) data = res.data.data;

            // Sort by value descending
            return data.sort((a, b) => b.value - a.value);
        },
    });

    return {
        summary,
        branchComparison,
        topEmployees,
        costDistribution,
        isLoading: summary.isLoading || branchComparison.isLoading || topEmployees.isLoading || costDistribution.isLoading
    };
}

export function useRefreshAnalytics() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            await api.post('/analytics/clear-cache');
        },
        onSuccess: () => {
            toast.success("Данные обновлены");
            queryClient.invalidateQueries({ queryKey: ['analytics'] });
        },
        onError: () => {
            toast.error("Не удалось обновить данные");
        }
    });
}
