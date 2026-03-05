/**
 * FIX #22: Centralized type definitions for API payloads and responses.
 * Replaces `any` usage across all hooks and components.
 */

import { AxiosError } from 'axios';

// --- Common / Shared ---

/** Standard Axios error shape from our API */
export type ApiError = AxiosError<{ detail?: string | object }>;

// --- Market ---

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

// --- Employee ---

export type EmployeeCreatePayload = {
    full_name: string;
    position_title?: string;
    position_id?: number;
    org_unit_id?: string | number;
    branch_id?: number;
    department_id?: number;
    hire_date: string;
    status?: string;
    gender?: string;
    dob?: string;
    is_head?: boolean;
    base_net?: number;
    base_gross?: number;
    kpi_net?: number;
    kpi_gross?: number;
    bonus_net?: number;
    bonus_gross?: number;
    last_raise_date?: string | null;
};

export type EmployeeUpdatePayload = Partial<EmployeeCreatePayload> & {
    email?: string;
    phone?: string;
    iin?: string;
};

// --- Market ---

export type MarketCreatePayload = {
    position_title: string;
    source?: string;
    branch_id?: number | null;
};

export type MarketUpdatePayload = Partial<MarketCreatePayload> & {
    min_salary?: number;
    max_salary?: number;
    median_salary?: number;
};

export type MarketSyncResult = {
    count: number;
    message?: string;
};

// --- Planning ---

export type PlanCreatePayload = {
    position: string;
    branch_id?: number;
    department_id?: number | null;
    count: number;
    schedule?: string;
    base_net: number;
    base_gross: number;
    kpi_net?: number;
    kpi_gross?: number;
    bonus_net?: number;
    bonus_gross?: number;
};

export type PlanUpdatePayload = Partial<PlanCreatePayload>;

// --- Users / Admin ---

export type UserCreatePayload = {
    email: string;
    password?: string;
    full_name: string;
    job_title?: string | null;
    contact_email?: string | null;
    phone?: string | null;
    role_id: number;
    employee_id?: number | null;
    scope_branches?: number[];
    scope_departments?: number[];
    is_active?: boolean;
};

export type UserUpdatePayload = Partial<UserCreatePayload>;

export type RoleCreatePayload = {
    name: string;
    permissions: Record<string, boolean>;
};

export type RoleUpdatePayload = RoleCreatePayload;

// --- Workflow ---

export type StepCreatePayload = {
    step_order: number;
    role_id?: number | null;
    user_id?: number | null;
    label?: string;
    is_final?: boolean;
    step_type?: string;
    notify_on_completion?: boolean;
    condition_type?: string | null;
    condition_amount?: number | null;
};

export type StepUpdatePayload = StepCreatePayload;

// --- Structure ---

export type StructureUpdatePayload = {
    name?: string;
    parent_id?: number | null;
    head_id?: number | null;
};

export type AuthUser = {
    id: number;
    full_name: string;
    email: string;
    contact_email?: string | null;
    phone?: string | null;
    employee_id?: number | null;
    role: string;
    permissions: UserPermissions;
    scope_unit_name?: string;
    scope_branches?: number[];
    scope_departments?: number[];
    is_active?: boolean;
    avatar_url?: string | null;
    job_title?: string | null;
};

export type AppUser = AuthUser;

export const PERMISSION_KEYS = [
    'admin_access',
    'add_employees',
    'view_structure',
    'edit_structure',
    'view_positions',
    'edit_positions',
    'view_financial_reports',
    'manage_planning',
    'view_market',
    'edit_market',
    'view_analytics',
    'view_payroll',
    'view_employees',
    'view_scenarios',
    'manage_offers',
    'edit_financials',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type UserPermissions = Record<PermissionKey, boolean> & Record<string, boolean>;

export const hasPermission = (user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined, key: PermissionKey): boolean => {
    if (!user) return false;
    if (user.role === 'Administrator') return true;
    if (user.permissions?.admin_access) return true;
    return Boolean(user.permissions[key]);
};

export const hasAnyPermission = (
    user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined,
    keys: readonly PermissionKey[]
): boolean => keys.some((key) => hasPermission(user, key));
