import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import {
    Vacancy, Candidate, Comment, VacancyCreate, VacancyUpdate,
    CandidateCreate, CommentCreate
} from '../types/recruiting';

// --- VACANCIES ---

export const useVacancies = () => {
    return useQuery({
        queryKey: ['vacancies'],
        queryFn: async () => {
            const { data } = await api.get<Vacancy[]>('/vacancies');
            return data;
        },
    });
};

export const useVacancy = (id: number | null) => {
    return useQuery({
        queryKey: ['vacancies', id],
        queryFn: async () => {
            if (!id) return null;
            const { data } = await api.get<Vacancy>(`/vacancies/${id}`);
            return data;
        },
        enabled: !!id,
    });
};

export const useCreateVacancy = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: VacancyCreate) => {
            const { data } = await api.post<Vacancy>('/vacancies', payload);
            return data;
        },
        onSuccess: () => {
            toast.success('Вакансия успешно создана');
            queryClient.invalidateQueries({ queryKey: ['vacancies'] });
        },
        onError: () => toast.error('Ошибка при создании вакансии'),
    });
};

export const useUpdateVacancy = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: { id: number; payload: VacancyUpdate }) => {
            const { data } = await api.put<Vacancy>(`/vacancies/${id}`, payload);
            return data;
        },
        onSuccess: (_, variables) => {
            toast.success('Вакансия обновлена');
            queryClient.invalidateQueries({ queryKey: ['vacancies'] });
            queryClient.invalidateQueries({ queryKey: ['vacancies', variables.id] });
        },
        onError: () => toast.error('Ошибка при обновлении вакансии'),
    });
};

export const useUpdateVacancyStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, status }: { id: number; status: string }) => {
            const { data } = await api.patch<Vacancy>(`/vacancies/${id}/status`, { status });
            return data;
        },
        onSuccess: (_, variables) => {
            toast.success('Статус вакансии обновлен');
            queryClient.invalidateQueries({ queryKey: ['vacancies'] });
            queryClient.invalidateQueries({ queryKey: ['vacancies', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['comments', 'vacancy', variables.id] });
        },
        onError: () => toast.error('Ошибка при изменении статуса'),
    });
};

export const useDeleteVacancy = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/vacancies/${id}`);
        },
        onSuccess: () => {
            toast.success('Вакансия удалена');
            queryClient.invalidateQueries({ queryKey: ['vacancies'] });
        },
        onError: () => toast.error('Ошибка при удалении вакансии'),
    });
};

// --- CANDIDATES ---

export const useCandidates = (vacancyId?: number) => {
    return useQuery({
        queryKey: ['candidates', vacancyId],
        queryFn: async () => {
            const params = vacancyId ? { vacancy_id: vacancyId } : {};
            const { data } = await api.get<Candidate[]>('/candidates', { params });
            return data;
        },
    });
};

export const useCandidate = (id: number | null) => {
    return useQuery({
        queryKey: ['candidates', 'single', id],
        queryFn: async () => {
            if (!id) return null;
            const { data } = await api.get<Candidate>(`/candidates/${id}`);
            return data;
        },
        enabled: !!id,
    });
};

export const useCreateCandidate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: CandidateCreate) => {
            const { data } = await api.post<Candidate>('/candidates', payload);
            return data;
        },
        onSuccess: () => {
            toast.success('Кандидат добавлен');
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
        },
        onError: () => toast.error('Ошибка при добавлении кандидата'),
    });
};

export const useUploadCandidateResume = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ candidateId, file }: { candidateId: number; file: File }) => {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await api.post<{ resume_url: string }>(`/candidates/${candidateId}/resume`, formData);
            return data;
        },
        onSuccess: (_, variables) => {
            toast.success('Резюме прикреплено');
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
            queryClient.invalidateQueries({ queryKey: ['candidates', 'single', variables.candidateId] });
        },
        onError: () => toast.error('Ошибка при загрузке резюме'),
    });
};

export const useUpdateCandidateStage = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, stage }: { id: number; stage: string }) => {
            const { data } = await api.patch<Candidate>(`/candidates/${id}/stage`, { stage });
            return data;
        },
        onSuccess: (_, variables) => {
            toast.success('Этап кандидата обновлен');
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
            queryClient.invalidateQueries({ queryKey: ['candidates', 'single', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['comments', 'candidate', variables.id] });
        },
        onError: () => toast.error('Ошибка при изменении этапа'),
    });
};

export const useDeleteCandidate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/candidates/${id}`);
        },
        onSuccess: () => {
            toast.success('Кандидат удален');
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
        },
        onError: () => toast.error('Ошибка при удалении кандидата'),
    });
};

export const useNotifyCustomer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ candidateId, message }: { candidateId: number; message: string }) => {
            const { data } = await api.post(`/candidates/${candidateId}/notify`, { message });
            return data;
        },
        onSuccess: (_, variables) => {
            toast.success('Заказчик уведомлен');
            queryClient.invalidateQueries({ queryKey: ['comments', 'candidate', variables.candidateId] });
        },
        onError: () => toast.error('Ошибка при уведомлении заказчика'),
    });
};

// --- COMMENTS ---

export const useComments = (targetType: "vacancy" | "candidate", targetId: number | null) => {
    return useQuery({
        queryKey: ['comments', targetType, targetId],
        queryFn: async () => {
            if (!targetId) return [];
            const { data } = await api.get<Comment[]>(`/comments`, {
                params: { target_type: targetType, target_id: targetId }
            });
            return data;
        },
        enabled: !!targetId,
    });
};

export const useAddComment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: CommentCreate) => {
            const { data } = await api.post<Comment>('/comments', payload);
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['comments', variables.target_type, variables.target_id] });
        },
        onError: () => toast.error('Ошибка при отправке комментария'),
    });
};
