import React, { useState } from 'react';
import { useWorkflow, useCreateStep, useUpdateStep, useDeleteStep } from '../../hooks/useWorkflow';
import { useRoles, useUsers } from '../../hooks/useAdmin';
import { Trash2, Edit2, ArrowDown, ShieldCheck, CheckCircle, User, HelpCircle } from 'lucide-react';
import Modal from '../../components/Modal';

export default function WorkflowPage() {
    const { data: steps = [], isLoading } = useWorkflow();
    const { data: roles = [] } = useRoles();
    const { data: users = [] } = useUsers();

    const createStep = useCreateStep();
    const updateStep = useUpdateStep();
    const deleteStep = useDeleteStep();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStep, setEditingStep] = useState<any | null>(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const [form, setForm] = useState({
        step_order: 1,
        role_id: 0,
        user_id: 0,
        assign_type: 'role', // 'role' | 'user'
        label: '',
        is_final: false,
        step_type: 'approval',
        notify_on_completion: false,
        condition_type: '',
        condition_amount: 0
    });

    const handleOpenCreate = () => {
        const nextOrder = steps.length > 0 ? Math.max(...steps.map((s: any) => s.step_order)) + 1 : 1;
        setForm({
            step_order: nextOrder,
            role_id: roles.length > 0 ? roles[0].id : 0,
            user_id: 0,
            assign_type: 'role',
            label: '',
            is_final: false,
            step_type: 'approval',
            notify_on_completion: false,
            condition_type: '',
            condition_amount: 0
        });
        setEditingStep(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (step: any) => {
        setForm({
            step_order: step.step_order,
            role_id: step.role_id || 0,
            user_id: step.user_id || 0,
            assign_type: step.user_id ? 'user' : 'role',
            label: step.label,
            is_final: step.is_final,
            step_type: step.step_type || 'approval',
            notify_on_completion: step.notify_on_completion || false,
            condition_type: step.condition_type || '',
            condition_amount: step.condition_amount || 0
        });
        setEditingStep(step);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        // Validation
        if (form.assign_type === 'role' && !form.role_id) return;
        if (form.assign_type === 'user' && !form.user_id) return;

        // Prepare payload
        const payload: any = {
            ...form,
            role_id: form.assign_type === 'role' ? form.role_id : null,
            user_id: form.assign_type === 'user' ? form.user_id : null,
            condition_type: form.condition_type === '' ? null : form.condition_type,
            condition_amount: form.condition_amount === 0 ? null : form.condition_amount
        };
        delete payload.assign_type;

        if (editingStep) {
            await updateStep.mutateAsync({ id: editingStep.id, data: form });
        } else {
            await createStep.mutateAsync(payload);
        }
        setIsModalOpen(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure? This might break pending requests.")) return;
        await deleteStep.mutateAsync(id);
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">Цепочка согласования</h2>
                    <p className="text-slate-500 text-sm mt-1">Настройка этапов утверждения заявок на изменение зарплаты</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsHelpOpen(true)}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors text-sm font-medium"
                    >
                        <HelpCircle className="w-5 h-5" />
                        Как это работает?
                    </button>
                    <button
                        onClick={handleOpenCreate}
                        className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
                    >
                        + Добавить этап
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto space-y-4 relative pt-4">
                <div className="absolute left-8 top-4 bottom-4 w-0.5 bg-slate-200 -z-10"></div>

                {steps.sort((a: any, b: any) => a.step_order - b.step_order).map((step: any, index: number) => (
                    <div key={step.id} className="relative pl-16">
                        {/* Connector dot */}
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-900 border-4 border-slate-50"></div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center group hover:border-slate-300 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="bg-slate-100 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-slate-500">
                                    {step.step_order}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                        {step.label}
                                        {step.is_final && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Финал</span>}
                                    </h3>
                                    <div className="text-sm text-slate-500 flex items-center gap-1">
                                        <div className="text-sm text-slate-500 flex items-center gap-1">
                                            {step.user_id ? (
                                                <>
                                                    <User className="w-3 h-3" />
                                                    Сотрудник: <span className="font-medium text-slate-700">{step.user_name || '...'}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldCheck className="w-3 h-3" />
                                                    Роль: <span className="font-medium text-slate-700">{step.role_name || '...'}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {step.condition_type && (
                                        <div className="mt-2 text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded inline-flex items-center gap-1 font-medium shadow-sm border border-amber-100">
                                            Условие: Только если сумма повышения {step.condition_type === 'amount_less_than' ? '<' : '≥'} {step.condition_amount} ₸
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenEdit(step)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(step.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {index < steps.length - 1 && (
                                <div className="absolute left-[29px] -bottom-6 text-slate-300">
                                    <ArrowDown className="w-4 h-4" />
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {steps.length === 0 && (
                    <div className="text-center p-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400">
                        Этапы не настроены. Заявки не будут иметь процесса согласования.
                    </div>
                )}
            </div>

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingStep ? "Редактировать этап" : "Создать этап"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Порядковый номер</label>
                        <input
                            type="number"
                            className="w-full h-10 rounded-lg border border-slate-300 px-3"
                            value={form.step_order}
                            onChange={e => setForm({ ...form, step_order: Number(e.target.value) })}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Название этапа</label>
                        <input
                            className="w-full h-10 rounded-lg border border-slate-300 px-3"
                            value={form.label}
                            onChange={e => setForm({ ...form, label: e.target.value })}
                            required
                            placeholder="Например: Согласование HR"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Тип исполнителя</label>
                        <div className="flex bg-slate-100 p-1 rounded-lg mb-2">
                            <button
                                type="button"
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${form.assign_type === 'role' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => setForm({ ...form, assign_type: 'role' })}
                            >
                                Роль (Группа)
                            </button>
                            <button
                                type="button"
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${form.assign_type === 'user' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => setForm({ ...form, assign_type: 'user' })}
                            >
                                Конкретный сотрудник
                            </button>
                        </div>

                        {form.assign_type === 'role' ? (
                            <select
                                className="w-full h-10 rounded-lg border border-slate-300 px-3 bg-white"
                                value={form.role_id}
                                onChange={e => setForm({ ...form, role_id: Number(e.target.value) })}
                                required
                            >
                                <option value={0} disabled>Выберите роль</option>
                                {roles.map((r: any) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        ) : (
                            <select
                                className="w-full h-10 rounded-lg border border-slate-300 px-3 bg-white"
                                value={form.user_id}
                                onChange={e => setForm({ ...form, user_id: Number(e.target.value) })}
                                required
                            >
                                <option value={0} disabled>Выберите сотрудника</option>
                                {users.map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.full_name} ({u.role_name})</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Тип этапа</label>
                        <select
                            className="w-full h-10 rounded-lg border border-slate-300 px-3 bg-white"
                            value={form.step_type}
                            onChange={e => setForm({ ...form, step_type: e.target.value })}
                        >
                            <option value="approval">Согласование (Требуется действие)</option>
                            <option value="notification">Уведомление (Только просмотр)</option>
                        </select>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2 space-y-3">
                        <label className="block text-sm font-bold text-slate-700 mb-1">Умная маршрутизация (Smart Routing)</label>
                        <select
                            className="w-full h-10 rounded-lg border border-slate-300 px-3 bg-white"
                            value={form.condition_type}
                            onChange={e => setForm({ ...form, condition_type: e.target.value })}
                        >
                            <option value="">Всегда проходить этот этап</option>
                            <option value="amount_less_than">Только если сумма повышения меньше</option>
                            <option value="amount_greater_than_or_equal">Только если сумма повышения больше или равна</option>
                        </select>
                        {form.condition_type && (
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Сумма повышения (₸)</label>
                                <input
                                    type="number"
                                    className="w-full h-10 rounded-lg border border-slate-300 px-3"
                                    value={form.condition_amount}
                                    onChange={e => setForm({ ...form, condition_amount: Number(e.target.value) })}
                                />
                            </div>
                        )}
                    </div>


                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={form.notify_on_completion}
                            onChange={e => setForm({ ...form, notify_on_completion: e.target.checked })}
                            id="notify_on_completion"
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <label htmlFor="notify_on_completion" className="text-sm font-medium text-slate-700">
                            Уведомить о результате (после полного согласования заявки)
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={form.is_final}
                            onChange={e => setForm({ ...form, is_final: e.target.checked })}
                            id="is_final"
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <label htmlFor="is_final" className="text-sm font-medium text-slate-700">
                            Это финальный этап (Применение изменений в БД)
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={createStep.isPending || updateStep.isPending}
                        className="w-full h-11 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50"
                    >
                        Сохранить
                    </button>
                </form>
            </Modal>

            {/* Help Modal */}
            <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Как работает цепочка согласования?">
                <div className="space-y-6 text-sm text-slate-600">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="mb-2">
                            <span className="font-bold text-slate-900">Цепочка согласования (Workflow)</span> — это последовательность этапов, через которые проходит каждая заявка на изменение зарплаты.
                        </p>
                        <p>
                            Вы можете настроить несколько уровней утверждения с назначением ответственных лиц или ролей для каждого этапа.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-900">Основные понятия</h4>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>
                                <span className="font-medium text-slate-900">Этап:</span> Отдельный шаг согласования (например, "Руководитель филиала", "HR", "Директор").
                            </li>
                            <li>
                                <span className="font-medium text-slate-900">Порядковый номер:</span> Определяет очередность этапов. Заявка проходит этапы по возрастанию номера.
                            </li>
                            <li>
                                <span className="font-medium text-slate-900">Роль vs Конкретный пользователь:</span> Вы можете назначить этап на роль (например, "HR Manager") или на конкретного сотрудника.
                            </li>
                            <li>
                                <span className="font-medium text-slate-900">Финальный этап:</span> Если отмечен, то при одобрении на этом этапе изменения автоматически применятся к финансовым данным сотрудника.
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-900">Как это работает</h4>
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                                <div>
                                    <div className="font-medium text-slate-900">Создание заявки</div>
                                    <div className="text-xs text-slate-500">Менеджер создает заявку на повышение или бонус</div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                                <div>
                                    <div className="font-medium text-slate-900">Согласование</div>
                                    <div className="text-xs text-slate-500">Заявка последовательно проходит все настроенные этапы</div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">✓</div>
                                <div>
                                    <div className="font-medium text-slate-900">Финальное утверждение</div>
                                    <div className="text-xs text-slate-500">При одобрении на финальном этапе изменения применяются автоматически</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                        <div className="font-bold text-amber-900 mb-1 flex items-center gap-2">
                            ⚠️ Важно
                        </div>
                        <div className="text-amber-800 text-xs space-y-1">
                            <p>• Удаление или изменение этапов может повлиять на заявки, находящиеся в процессе согласования</p>
                            <p>• Хотя бы один этап должен быть отмечен как "Финальный"</p>
                            <p>• Заявки проходят этапы строго по порядку номеров</p>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl text-blue-800 text-xs">
                        <div className="font-bold mb-1">Пример умной маршрутизации (Условия):</div>
                        <div className="space-y-1 mt-2">
                            <div>1. Непосредственный руководитель (Всегда)</div>
                            <div>2. HR Директор (Только если сумма повышения ≥ 50 000 ₸)</div>
                            <div>3. Финансовый директор (Финальный этап, Всегда)</div>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
