import { useParams, Link, useOutletContext } from 'react-router-dom';
import { Building, Briefcase, Mail, Phone, Calendar, ArrowLeft, Loader2, ShieldAlert, Cake, TrendingUp, UserCheck } from 'lucide-react';
import { useEmployees } from '../hooks/useEmployees';
import { useFlatStructure } from '../hooks/useStructure';
import { AuthUser } from '../types';
import { PageHeader } from '../components/shared/PageHeader';
import { resolveAvatarUrl } from '../utils/avatar';

export default function EmployeeViewPage() {
    const { id } = useParams();
    const { user } = useOutletContext<{ user: AuthUser }>();
    const { data: employees = [], isLoading: isEmployeesLoading } = useEmployees();
    const { data: structure = [], isLoading: isStructureLoading } = useFlatStructure();

    const employee = employees.find(e => e.id === Number(id)) as any;

    if (isEmployeesLoading || isStructureLoading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
        );
    }

    if (!employee) {
        return (
            <div className="p-8 text-center text-slate-500">
                Сотрудник не найден
            </div>
        );
    }

    // Access control for compensation data
    // Assuming backend will eventually do this, but we can also hide on frontend based on rules.
    // 1. If it's the current user's profile (user.employee_id === employee.id)
    // 2. Or the user is an Admin / has admin_access
    // 3. Or the user has specific view_payroll permissions (which allows seeing all salaries)
    const canViewCompensation =
        user.employee_id === employee.id ||
        user.role === 'Administrator' ||
        user.permissions?.admin_access ||
        user.permissions?.view_payroll;

    const initials = employee.full_name
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    // formatting helpers
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(val);
    };

    const unit = structure.find(u => u.id === (employee.department_id || employee.branch_id || employee.org_unit_id));
    const managerName = unit?.head?.full_name || 'Не назначен';

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <div className="flex items-center mb-2">
                <Link to="/employees" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Назад
                </Link>
            </div>

            <PageHeader title="Профиль сотрудника" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ЛЕВАЯ КОЛОНКА (Профиль и Контакты) */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                        <div className="flex flex-col items-center text-center">
                            {employee.linked_user_avatar ? (
                                <img
                                    src={employee.linked_user_avatar ? resolveAvatarUrl(employee.linked_user_avatar) : undefined}
                                    alt={employee.full_name}
                                    className="w-24 h-24 rounded-2xl bg-white object-cover shadow-sm ring-1 ring-slate-900/5 mb-4"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-600 flex items-center justify-center text-2xl font-bold mb-4 shadow-sm ring-1 ring-slate-900/5">
                                    {initials}
                                </div>
                            )}
                            <h1 className="text-xl font-bold text-slate-900 leading-tight">{employee.full_name}</h1>
                            <p className="text-sm font-medium text-slate-500 mt-1">{employee.position || 'Должность не указана'}</p>

                            <div className="mt-4">
                                {employee.status === 'Dismissed' ?
                                    <span className="text-red-700 bg-red-50 border border-red-100 px-3 py-1 rounded-full text-xs font-semibold">Уволен</span> :
                                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Работает</span>}
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <div className="text-sm overflow-hidden w-full">
                                    <div className="text-slate-400 text-xs uppercase tracking-wide">Корпоративный Email</div>
                                    <div className="font-medium text-slate-700 truncate">{employee.linked_user_contact_email || '—'}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                    <Phone className="w-4 h-4" />
                                </div>
                                <div className="text-sm overflow-hidden w-full">
                                    <div className="text-slate-400 text-xs uppercase tracking-wide">Контактный телефон</div>
                                    <div className="font-medium text-slate-700 truncate">{employee.linked_user_phone || '—'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ПРАВАЯ КОЛОНКА (Орг. инфа и ЗП) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                        <h2 className="text-base font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100">Рабочая информация</h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                            <div className="flex gap-3">
                                <Building className="w-5 h-5 text-slate-400 shrink-0" />
                                <div>
                                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Подразделение</div>
                                    <div className="text-sm font-semibold text-slate-900 mt-0.5">{employee.branch || '-'}</div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Briefcase className="w-5 h-5 text-slate-400 shrink-0" />
                                <div>
                                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Отдел</div>
                                    <div className="text-sm font-semibold text-slate-900 mt-0.5">{employee.department || '-'}</div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <UserCheck className="w-5 h-5 text-slate-400 shrink-0" />
                                <div>
                                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Руководитель</div>
                                    <div className="text-sm font-semibold text-slate-900 mt-0.5">{managerName}</div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Calendar className="w-5 h-5 text-slate-400 shrink-0" />
                                <div>
                                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Дата найма</div>
                                    <div className="text-sm font-semibold text-slate-900 mt-0.5">{employee.hire_date || '-'}</div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Cake className="w-5 h-5 text-slate-400 shrink-0" />
                                <div>
                                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Дата рождения</div>
                                    <div className="text-sm font-semibold text-slate-900 mt-0.5">{employee.dob || '-'}</div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <TrendingUp className="w-5 h-5 text-slate-400 shrink-0" />
                                <div>
                                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Посл. повышение ЗП</div>
                                    <div className="text-sm font-semibold text-slate-900 mt-0.5">{employee.last_raise_date || '-'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {canViewCompensation && (
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                            <h2 className="text-base font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100 flex items-center justify-between">
                                Компенсация
                                <span className="text-[10px] font-normal text-slate-400 bg-slate-50 px-2 py-1 rounded-md">Строго конфиденциально</span>
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Оклад</div>
                                    <div className="text-lg font-bold text-slate-900">{formatCurrency(employee.base?.net || 0)}</div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">KPI</div>
                                    <div className="text-lg font-bold text-slate-900">{formatCurrency(employee.kpi?.net || 0)}</div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Доплаты</div>
                                    <div className="text-lg font-bold text-slate-900">{formatCurrency(employee.bonus?.net || 0)}</div>
                                </div>
                                <div className="bg-slate-900 p-4 rounded-2xl shadow-md">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Итого (на руки)</div>
                                    <div className="text-xl font-bold text-white">{formatCurrency(employee.total?.net || 0)}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
