import React, { useState } from 'react';
import { useWorkflow, useCreateStep, useUpdateStep, useDeleteStep } from '../../hooks/useWorkflow';
import { useRoles, useUsers } from '../../hooks/useAdmin';
import { Plus, Trash2, Edit2, ArrowDown, ShieldCheck, CheckCircle, User } from 'lucide-react';
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

    const [form, setForm] = useState({
        step_order: 1,
        role_id: 0,
        user_id: 0,
        assign_type: 'role', // 'role' | 'user'
        label: '',
        is_final: false,
        step_type: 'approval',
        notify_on_completion: false
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
            notify_on_completion: false
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
            notify_on_completion: step.notify_on_completion || false
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
            user_id: form.assign_type === 'user' ? form.user_id : null
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
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Цепочка согласования (Workflow)</h1>
                    <p className="text-slate-500">Настройка этапов утверждения заявок на изменение ЗП.</p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"
                >
                    <Plus className="w-4 h-4" /> Добавить этап
                </button>
            </div>

            <div className="max-w-3xl mx-auto space-y-4 relative">
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
        </div>
    );
}
