import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useSnapshot } from '../context/SnapshotContext';

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
    parent_id?: number | null;
    name: string;
    type?: 'head_office' | 'branch' | 'department';  // Type of organizational unit
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

export type RetentionRiskItem = {
    id: number;
    full_name: string;
    position: string;
    branch: string;
    months_stagnant: number;
    gap_percent: number;
    risk_score: number;
    current_salary: number;
    market_median: number;
};

export type RetentionDashboardData = {
    items: RetentionRiskItem[];
    risk_distribution: Record<string, number>;
    cached_at?: string;
};

export type ESGItem = {
    category: string;
    count: number;
    avg_salary: number;
};

export type EsgMetricsData = {
    gender_equity: ESGItem[];
    age_equity: ESGItem[];
    cached_at?: string;
};

export type StaffingGapItem = {
    id: number;
    parent_id: number | null;
    unit_name: string;
    unit_type: string;
    plan: number;
    fact: number;
    gap: number;
};

export type TurnoverReasonItem = {
    name: string;
    value: number;
};

export type TurnoverAnalyticsData = {
    turnover_rate: number;
    dismissed_count: number;
    reasons_distribution: TurnoverReasonItem[];
    staffing_gaps: StaffingGapItem[];
    period_days: number;
    cached_at?: string;
};

export type AnalyticsEmployee = {
    id: number;
    full_name: string;
    position: string;
    unit_name: string;
    total_net: number;
};

export type AnalyticsEmployeeFilters = {
    unit_id?: number;
    position?: string;
    risk_level?: string;
};

export const analyticsQueryKeys = {
    all: ['analytics'] as const,
    summary: (snapshotDate: string | null) => ['analytics', 'summary', snapshotDate] as const,
    branchComparison: (snapshotDate: string | null) => ['analytics', 'branch-comparison', snapshotDate] as const,
    topEmployees: (snapshotDate: string | null, limit: number) => ['analytics', 'top-employees', snapshotDate, limit] as const,
    costDistribution: (snapshotDate: string | null) => ['analytics', 'cost-distribution', snapshotDate] as const,
    retentionRisk: () => ['analytics', 'retention-risk'] as const,
    esgMetrics: () => ['analytics', 'esg-metrics'] as const,
    turnover: (days: number) => ['analytics', 'turnover', days] as const,
    employees: (filters: AnalyticsEmployeeFilters, snapshotDate: string | null) => [
        'analytics',
        'employees',
        filters.unit_id ?? null,
        filters.position ?? null,
        filters.risk_level ?? null,
        snapshotDate,
    ] as const,
};

const extractArrayData = <T>(payload: unknown): T[] => {
    if (Array.isArray(payload)) {
        return payload as T[];
    }

    if (payload && typeof payload === 'object') {
        const wrappedData = payload as { data?: unknown };
        if (Array.isArray(wrappedData.data)) {
            return wrappedData.data as T[];
        }
    }

    return [];
};

// --- Hooks ---

export function useAnalytics() {
    const { snapshotDate } = useSnapshot();

    const summary = useQuery({
        queryKey: analyticsQueryKeys.summary(snapshotDate),
        queryFn: async () => {
            const params = snapshotDate ? { date: snapshotDate } : {};
            const res = await api.get('/analytics/summary', { params });
            return res.data as SummaryData;
        },
    });

    const branchComparison = useQuery({
        queryKey: analyticsQueryKeys.branchComparison(snapshotDate),
        queryFn: async () => {
            const params = snapshotDate ? { date: snapshotDate } : {};
            const res = await api.get('/analytics/branch-comparison', { params });
            const data = extractArrayData<BranchComparison>(res.data);

            // Sort comparison by Fact descending
            return data.sort((a, b) => b.fact - a.fact);
        },
    });

    const topEmployees = useQuery({
        queryKey: analyticsQueryKeys.topEmployees(snapshotDate, 5),
        queryFn: async () => {
            const params = { limit: 5, ...(snapshotDate ? { date: snapshotDate } : {}) };
            const res = await api.get('/analytics/top-employees', { params });
            return extractArrayData<TopEmployee>(res.data);
        },
    });

    const costDistribution = useQuery({
        queryKey: analyticsQueryKeys.costDistribution(snapshotDate),
        queryFn: async () => {
            const params = snapshotDate ? { date: snapshotDate } : {};
            const res = await api.get('/analytics/cost-distribution', { params });
            const data = extractArrayData<CostDistribution>(res.data);

            // Sort by value descending
            return data.sort((a, b) => b.value - a.value);
        },
    });

    return {
        summary,
        branchComparison,
        topEmployees,
        costDistribution,
        isLoading:
            summary.isLoading ||
            branchComparison.isLoading ||
            topEmployees.isLoading ||
            costDistribution.isLoading,
    };
}

export function useRetentionRisk(options: { enabled?: boolean } = {}) {
    return useQuery({
        queryKey: analyticsQueryKeys.retentionRisk(),
        queryFn: async () => {
            const res = await api.get('/analytics/retention-risk');
            return res.data as RetentionDashboardData;
        },
        enabled: options.enabled ?? true,
    });
}

export function useEsgMetrics(options: { enabled?: boolean } = {}) {
    return useQuery({
        queryKey: analyticsQueryKeys.esgMetrics(),
        queryFn: async () => {
            const res = await api.get('/analytics/esg/pay-equity');
            return res.data as EsgMetricsData;
        },
        enabled: options.enabled ?? true,
    });
}

export function useTurnoverAnalytics(days: number = 365, options: { enabled?: boolean } = {}) {
    return useQuery({
        queryKey: analyticsQueryKeys.turnover(days),
        queryFn: async () => {
            const res = await api.get('/analytics/turnover', { params: { days } });
            return res.data as TurnoverAnalyticsData;
        },
        enabled: options.enabled ?? true,
    });
}

export function useAnalyticsEmployees(filters: AnalyticsEmployeeFilters, options: { enabled?: boolean } = {}) {
    const { snapshotDate } = useSnapshot();

    return useQuery({
        queryKey: analyticsQueryKeys.employees(filters, snapshotDate),
        queryFn: async () => {
            const params: Record<string, string | number> = {};

            if (typeof filters.unit_id === 'number') {
                params.unit_id = filters.unit_id;
            }

            if (filters.position) {
                params.position = filters.position;
            }

            if (filters.risk_level) {
                params.risk_level = filters.risk_level;
            }

            if (snapshotDate) {
                params.date = snapshotDate;
            }

            const res = await api.get('/analytics/employees', { params });
            return res.data as AnalyticsEmployee[];
        },
        enabled: options.enabled ?? true,
    });
}

export function useRefreshAnalytics() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            await api.post('/analytics/clear-cache');
        },
        onSuccess: () => {
            toast.success("Данные обновлены");
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.all });
        },
        onError: () => {
            toast.error("Не удалось обновить данные");
        }
    });
}
