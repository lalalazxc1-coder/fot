export type FinancialValue = { net: number; gross: number };

export interface EmployeeRecord {
    id: number;
    org_unit_id?: number;
    full_name: string;
    position: string;
    branch: string;
    department: string;
    status: 'Active' | 'Dismissed';
    hire_date: string;
    dismissal_date?: string;
    base: FinancialValue;
    kpi: FinancialValue;
    bonus: FinancialValue;
    total: FinancialValue;
}

export interface AuditLog {
    date: string;
    user: string;
    field: string;
    oldVal: string;
    newVal: string;
}

export interface BranchStructure {
    id: number;
    name: string;
    departments: { id: number; name: string; parent_id?: number | null; type?: string }[];
}

export interface PlanRow {
    position: string;
    branch_id: number;
    department_id: number;
    count: number;
    base_net: number;
    base_gross: number;
    kpi_net: number;
    kpi_gross: number;
    bonus_net: number;
    bonus_gross: number;
}
