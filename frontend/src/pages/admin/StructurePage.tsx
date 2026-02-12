import React, { useState } from 'react';
import { Building, Plus, Trash2, Loader2 } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import Modal from '../../components/Modal';
import { useStructure, useCreateBranch, useCreateDepartment, useDeleteStructure } from '../../hooks/useStructure';

export default function StructurePage() {
    const { user } = useOutletContext<{ user: any }>();
    const { data: branches = [], isLoading } = useStructure();

    const createBranchMutation = useCreateBranch();
    const createDeptMutation = useCreateDepartment();
    const deleteMutation = useDeleteStructure();

    const canEdit = user?.role === 'Administrator' || user?.permissions?.admin_access || user?.permissions?.edit_structure;

    // Modal State
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);

    // Form State
    const [newItemName, setNewItemName] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

    const isSubmitting = createBranchMutation.isPending || createDeptMutation.isPending || deleteMutation.isPending;

    const openBranchModal = () => {
        setNewItemName('');
        setIsBranchModalOpen(true);
    };

    const openDeptModal = (branchId: number) => {
        setSelectedBranchId(branchId);
        setNewItemName('');
        setIsDeptModalOpen(true);
    };

    const handleAddBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        await createBranchMutation.mutateAsync(newItemName);
        setNewItemName('');
        setIsBranchModalOpen(false);
    };

    const handleAddDept = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBranchId) return;

        await createDeptMutation.mutateAsync({ name: newItemName, parent_id: selectedBranchId });
        setNewItemName('');
        setIsDeptModalOpen(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Удалить подразделение?")) return;
        await deleteMutation.mutateAsync(id);
    };

    if (isLoading) return (
        <div className="h-64 flex justify-center items-center">
            <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
        </div>
    );

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in duration-300">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Building className="w-6 h-6 text-slate-900" /> Структура организации</h2>
                    <p className="text-slate-500 text-sm mt-1">Филиалы и подразделения</p>
                </div>
                <div className="flex items-center gap-4">
                    {canEdit && (
                        <button
                            onClick={openBranchModal}
                            className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm hover:bg-slate-800 font-medium whitespace-nowrap shadow-lg shadow-slate-900/10"
                        >
                            + Создать филиал
                        </button>
                    )}
                </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {branches.length === 0 && <p className="text-center text-slate-400 py-10 col-span-full border border-dashed rounded-lg">Структура пуста</p>}
                {branches.map(b => (
                    <div key={b.id} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow group bg-slate-50/50">
                        <div className="bg-white p-4 border-b border-slate-100 flex justify-between items-center group-hover:border-slate-200 transition-colors">
                            <span className="font-bold text-slate-800 text-lg">{b.name}</span>
                            <div className="flex items-center gap-2">
                                {canEdit && (
                                    <>
                                        <button onClick={() => handleDelete(b.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Удалить филиал">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => openDeptModal(b.id)} className="text-xs bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-900 hover:text-white transition-all font-medium flex items-center gap-1 shadow-sm">
                                            <Plus className="w-3 h-3" /> Отдел
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="p-4">
                            {b.departments.length === 0 ? (
                                <span className="text-xs text-slate-400 italic pl-1 block py-2">Нет отделов</span>
                            ) : (
                                <ul className="space-y-2">
                                    {b.departments.map(d => (
                                        <li key={d.id} className="text-sm text-slate-600 flex justify-between items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-100 hover:shadow-sm group/item">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 bg-slate-400 rounded-full shrink-0"></div>
                                                {d.name}
                                            </div>
                                            {canEdit && (
                                                <button onClick={() => handleDelete(d.id)} className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-red-500 transition-opacity">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Branch Modal */}
            <Modal isOpen={isBranchModalOpen} onClose={() => setIsBranchModalOpen(false)} title="Новый филиал">
                <form onSubmit={handleAddBranch}>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Название филиала</label>
                    <input
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 mb-4"
                        placeholder="Например: Филиал Алматы"
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        required
                        autoFocus
                    />
                    <button disabled={isSubmitting} className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 shadow-lg shadow-slate-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Создание...' : 'Создать'}
                    </button>
                </form>
            </Modal>

            {/* Department Modal */}
            <Modal isOpen={isDeptModalOpen} onClose={() => setIsDeptModalOpen(false)} title="Новое подразделение">
                <form onSubmit={handleAddDept}>
                    <p className="text-sm text-slate-500 mb-4">Добавление отдела в филиал</p>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Название отдела</label>
                    <input
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 mb-4"
                        placeholder="Например: Бухгалтерия"
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        required
                        autoFocus
                    />
                    <button disabled={isSubmitting} className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 shadow-lg shadow-slate-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Добавление...' : 'Добавить отдел'}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
