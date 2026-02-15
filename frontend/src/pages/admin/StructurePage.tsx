import React, { useState, useMemo } from 'react';
import { Building, Plus, Trash2, Loader2, LayoutGrid, List, ChevronRight, ChevronDown, FolderPlus, Building2 } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useSnapshot } from '../../context/SnapshotContext';
import Modal from '../../components/Modal';
import { useFlatStructure, useCreateBranch, useCreateDepartment, useDeleteStructure } from '../../hooks/useStructure';
import OrgStructureGraph from '../../pages/OrgStructurePage';
import { TimeTravelPicker } from '../../components/TimeTravelPicker';

interface TreeNode {
    id: number;
    name: string;
    type: 'head_office' | 'branch' | 'department';
    total_salary?: number;  // NEW: Total salary including children
    children: TreeNode[];
}

const StructureNode = ({ node, level, onAdd, onDelete }: { node: TreeNode, level: number, onAdd: (id: number) => void, onDelete: (id: number) => void }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = node.children.length > 0;

    return (
        <div className="select-none">
            <div
                className={`flex items-center justify-between p-3 my-1 rounded-lg border border-transparent hover:bg-slate-50 hover:border-slate-100 transition-all group ${level === 0 ? 'bg-slate-50/50 border-slate-200 shadow-sm' : ''}`}
                style={{ marginLeft: level * 20 }}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`p-1 rounded hover:bg-slate-200 text-slate-400 transition-colors ${!hasChildren && 'invisible'}`}
                    >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {node.type === 'head_office' ? (
                        <Building2 className="w-5 h-5 text-purple-600" />
                    ) : node.type === 'branch' ? (
                        <Building2 className={`w-5 h-5 ${level === 0 ? 'text-indigo-600' : 'text-slate-500'}`} />
                    ) : (
                        <div className="w-5 h-5 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                        </div>
                    )}

                    <span className={`text-sm ${level === 0 ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}`}>
                        {node.name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 uppercase tracking-tighter">
                        {node.type === 'head_office' ? 'Головной' : node.type === 'branch' ? 'Филиал' : 'Отдел'}
                    </span>
                    {node.total_salary !== undefined && node.total_salary > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                            💰 {node.total_salary.toLocaleString('ru-RU')} ₸
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onAdd(node.id)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors flex items-center gap-1.5"
                        title="Добавить подразделение"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-xs font-semibold">Добавить</span>
                    </button>
                    <button
                        onClick={() => onDelete(node.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Удалить"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {hasChildren && isExpanded && (
                <div className="relative">
                    {/* Vertical line for visual hierarchy */}
                    <div
                        className="absolute left-[26px] top-0 bottom-2 w-px bg-slate-200"
                        style={{ left: (level * 20) + 26 }}
                    />
                    {node.children.map(child => (
                        <StructureNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            onAdd={onAdd}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default function StructurePage() {
    const { user } = useOutletContext<{ user: any }>();
    const { snapshotDate } = useSnapshot();
    const [viewMode, setViewMode] = useState<'list' | 'graph'>('list'); // Default to list for editing hierarchy

    const { data: flatStructure = [], isLoading } = useFlatStructure(snapshotDate);

    const createBranchMutation = useCreateBranch();
    const createDeptMutation = useCreateDepartment();
    const deleteMutation = useDeleteStructure();

    const canEdit = user?.role === 'Administrator' || user?.permissions?.admin_access || user?.permissions?.edit_structure;

    // Tree Construction
    const treeData = useMemo(() => {
        const map = new Map<number, TreeNode>();
        const roots: TreeNode[] = [];

        // 1. Create Nodes
        flatStructure.forEach(item => {
            map.set(item.id, {
                id: item.id,
                name: item.name,
                type: item.type as 'head_office' | 'branch' | 'department',
                total_salary: item.total_salary,  // NEW: Include total salary
                children: []
            });
        });

        // 2. Link Parents
        flatStructure.forEach(item => {
            const node = map.get(item.id)!;
            if (item.parent_id && map.has(item.parent_id)) {
                map.get(item.parent_id)!.children.push(node);
            } else {
                roots.push(node);
            }
        });

        return roots;
    }, [flatStructure]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'head_office' | 'branch' | 'department'>('head_office');
    const [parentId, setParentId] = useState<number | null>(null);
    const [newItemName, setNewItemName] = useState('');

    const isSubmitting = createBranchMutation.isPending || createDeptMutation.isPending || deleteMutation.isPending;

    const openHeadOfficeModal = () => {
        setModalMode('head_office');
        setParentId(null);
        setNewItemName('');
        setIsModalOpen(true);
    };

    const openChildModal = (pId: number) => {
        const parent = flatStructure.find(u => u.id === pId);
        if (!parent) return;

        // Branches can only have departments
        if (parent.type === 'branch') {
            setModalMode('department');
        } else {
            // head_office and departments can have both departments and branches
            // Default to department, user can change in modal
            setModalMode('department');
        }

        setParentId(pId);
        setNewItemName('');
        setIsModalOpen(true);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (modalMode === 'head_office') {
                await createBranchMutation.mutateAsync({ name: newItemName, type: 'head_office' });
            } else if (modalMode === 'branch') {
                if (parentId) {
                    await createDeptMutation.mutateAsync({ name: newItemName, parent_id: parentId, type: 'branch' });
                } else {
                    await createBranchMutation.mutateAsync({ name: newItemName, type: 'branch' });
                }
            } else if (modalMode === 'department') {
                if (parentId) {
                    await createDeptMutation.mutateAsync({ name: newItemName, parent_id: parentId });
                }
            }
            setIsModalOpen(false);
            setNewItemName('');
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Удалить это подразделение и все вложенные отделы?")) return;
        try {
            await deleteMutation.mutateAsync(id);
        } catch (e) {
            // Toast handled by hook
        }
    };

    if (viewMode === 'graph') {
        return (
            <div className="h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
                <div className="absolute top-4 left-4 z-50 bg-white/90 backdrop-blur p-1 rounded-lg border border-slate-200 shadow-sm flex gap-1">
                    <button
                        onClick={() => setViewMode('list')}
                        className="p-2 text-slate-400 hover:text-slate-900 rounded-md transition-colors"
                        title="Список"
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('graph')}
                        className="p-2 bg-indigo-50 text-indigo-600 rounded-md shadow-sm"
                        title="График"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                </div>
                <OrgStructureGraph />
            </div>
        );
    }

    if (isLoading) return (
        <div className="h-64 flex justify-center items-center">
            <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
        </div>
    );

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in duration-300 h-full flex flex-col">
            <div className="mb-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-100 p-1 rounded-lg flex gap-1 border border-slate-200">
                        <button
                            onClick={() => setViewMode('list')}
                            className="p-2 bg-white text-slate-900 rounded-md shadow-sm border border-slate-100"
                            title="Иерархия"
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('graph')}
                            className="p-2 text-slate-400 hover:text-indigo-600 rounded-md transition-colors"
                            title="График"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Building className="w-6 h-6 text-slate-900" /> Структура организации</h2>
                        <p className="text-slate-500 text-sm mt-1">Управление иерархией компании</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <TimeTravelPicker />
                    {canEdit && (
                        <button
                            onClick={openHeadOfficeModal}
                            className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-purple-700 font-medium whitespace-nowrap shadow-lg shadow-purple-600/10 flex items-center gap-2"
                        >
                            <FolderPlus className="w-4 h-4" />
                            Создать головной офис
                        </button>
                    )}
                </div>
            </div >

            <div className="flex-1 border border-slate-200 rounded-xl p-4 overflow-y-auto">
                {treeData.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        Структура пуста. Создайте первый филиал.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {treeData.map(node => (
                            <StructureNode
                                key={node.id}
                                node={node}
                                level={0}
                                onAdd={openChildModal}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Combined Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={
                    modalMode === 'head_office' ? "\u041d\u043e\u0432\u044b\u0439 \u0433\u043e\u043b\u043e\u0432\u043d\u043e\u0439 \u043e\u0444\u0438\u0441" :
                        modalMode === 'branch' ? "\u041d\u043e\u0432\u044b\u0439 \u0444\u0438\u043b\u0438\u0430\u043b" :
                            "\u041d\u043e\u0432\u043e\u0435 \u043f\u043e\u0434\u0440\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u0435"
                }>
                <form onSubmit={handleCreate}>
                    <p className="text-sm text-slate-500 mb-4">
                        {modalMode === 'head_office'
                            ? "Головной офис - это верхний уровень организационной структуры."
                            : modalMode === 'branch'
                                ? "Филиал - это подразделение компании в определенном регионе или направлении."
                                : "Отдел - это структурное подразделение."}
                    </p>

                    {/* Type Selector for head_office and department parents */}
                    {parentId && (() => {
                        const parent = flatStructure.find(u => u.id === parentId);
                        const canChooseType = parent && (parent.type === 'head_office' || parent.type === 'department');

                        if (canChooseType) {
                            return (
                                <div className="mb-4">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Тип подразделения</label>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setModalMode('department')}
                                            className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium text-sm transition-all ${modalMode === 'department'
                                                ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                                }`}
                                        >
                                            📁 Отдел
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setModalMode('branch')}
                                            className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium text-sm transition-all ${modalMode === 'branch'
                                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                                }`}
                                        >
                                            🏢 Филиал
                                        </button>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    <label className="block text-sm font-bold text-slate-700 mb-2">Название</label>
                    <input
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 mb-4"
                        placeholder={
                            modalMode === 'head_office'
                                ? "Например: Головной офис"
                                : modalMode === 'branch'
                                    ? "Например: Филиал в г. Алматы"
                                    : "Например: Финансовый департамент"
                        }
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        required
                        autoFocus
                    />

                    <button
                        disabled={isSubmitting}
                        className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 shadow-lg shadow-slate-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Создание...' : (
                            modalMode === 'head_office' ? 'Создать головной офис' :
                                modalMode === 'branch' ? 'Создать филиал' :
                                    'Добавить отдел'
                        )}
                    </button>
                </form>
            </Modal>
        </div >
    );
}
