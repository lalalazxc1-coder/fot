export interface Vacancy {
    id: number;
    title: string;
    department_id: number;
    location: string | null;
    planned_count: number;
    status: string;
    priority: string;
    creator_id: number;
    assignee_id: number | null;
    created_at: string;
    position_name: string | null;
    description: string | null;
    salary_from: number | null;
    salary_to: number | null;
}

export interface Candidate {
    id: number;
    vacancy_id: number;
    first_name: string;
    last_name: string;
    stage: string;
    created_at: string;
    phone: string | null;
    email: string | null;
    resume_url: string | null;
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
    assignee_id?: number | null;
    position_name?: string | null;
    description?: string | null;
    salary_from?: number | null;
    salary_to?: number | null;
}

export interface VacancyUpdate {
    title?: string;
    department_id?: number;
    location?: string;
    planned_count?: number;
    status?: string;
    priority?: string;
    assignee_id?: number | null;
    position_name?: string | null;
    description?: string | null;
    salary_from?: number | null;
    salary_to?: number | null;
}

export interface CandidateCreate {
    vacancy_id: number;
    first_name: string;
    last_name: string;
    stage?: string;
    phone?: string | null;
    email?: string | null;
}

export interface CandidateUpdate {
    vacancy_id?: number;
    first_name?: string;
    last_name?: string;
    stage?: string;
    phone?: string | null;
    email?: string | null;
    resume_url?: string | null;
}

export interface CommentCreate {
    target_type: "vacancy" | "candidate";
    target_id: number;
    content: string;
}
