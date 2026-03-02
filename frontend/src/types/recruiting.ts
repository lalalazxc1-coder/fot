export interface Vacancy {
    id: number;
    title: string;
    department_id: number;
    location: string | null;
    planned_count: number;
    status: string;
    priority: string;
    creator_id: number;
    created_at: string;
}

export interface Candidate {
    id: number;
    vacancy_id: number;
    first_name: string;
    last_name: string;
    stage: string;
    created_at: string;
}

export interface Comment {
    id: number;
    target_type: "vacancy" | "candidate";
    target_id: number;
    author_id: number;
    content: string;
    is_system: boolean;
    created_at: string;
    author_name: string | null;
}

export interface VacancyCreate {
    title: string;
    department_id: number;
    location?: string;
    planned_count: number;
    status?: string;
    priority?: string;
}

export interface VacancyUpdate {
    title?: string;
    department_id?: number;
    location?: string;
    planned_count?: number;
    status?: string;
    priority?: string;
}

export interface CandidateCreate {
    vacancy_id: number;
    first_name: string;
    last_name: string;
    stage?: string;
}

export interface CandidateUpdate {
    vacancy_id?: number;
    first_name?: string;
    last_name?: string;
    stage?: string;
}

export interface CommentCreate {
    target_type: "vacancy" | "candidate";
    target_id: number;
    content: string;
}
