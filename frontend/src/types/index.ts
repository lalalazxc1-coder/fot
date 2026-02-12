export type MarketRow = {
    id: number;
    position_title: string;
    min_salary: number;
    max_salary: number;
    median_salary: number;
    source: string;
    updated_at: string;
    branch_id?: number;
};

export type MarketEntry = {
    id: number;
    market_id: number;
    company_name: string;
    salary: number;
    created_at: string;
};

export type Position = {
    id: number;
    title: string;
    grade: number;
};
