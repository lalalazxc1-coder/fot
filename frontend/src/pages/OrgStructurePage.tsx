import { useCallback, useEffect, useState, useMemo } from 'react';
import ReactFlow, {
    Connection,
    Edge,
    Node,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    MiniMap,
    Panel,
    MarkerType,
    ReactFlowProvider,
    useReactFlow,
    Position,
    ConnectionMode
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { useFlatStructure, useUpdateUnit, useCreateBranch, useCreateDepartment, useDeleteStructure } from '../hooks/useStructure';
import { useEmployees } from '../hooks/useEmployees';
import OrgNode from '../components/structure/OrgNode';
import Modal from '../components/Modal';
import { Plus, Layout, Search } from 'lucide-react';

const nodeTypes = {
    org: OrgNode
};

const nodeWidth = 280;
const nodeHeight = 120;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = direction === 'LR' ? Position.Left : Position.Top;
        node.sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom;

        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };
    });

    return { nodes, edges };
};

const OrgStructureFlow = () => {
    const { fitView } = useReactFlow();
    const { data: flatStructure, isLoading } = useFlatStructure();
    const { data: employees } = useEmployees();
    const updateUnit = useUpdateUnit();
    const createBranch = useCreateBranch();
    const createDept = useCreateDepartment();
    const deleteUnit = useDeleteStructure();

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const [isHeadModalOpen, setIsHeadModalOpen] = useState(false);
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [targetUnitId, setTargetUnitId] = useState<number | null>(null);
    const [targetUnitName, setTargetUnitName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createParentId, setCreateParentId] = useState<number | null>(null);
    const [createModalMode, setCreateModalMode] = useState<'head_office' | 'branch' | 'department'>('head_office');
    const [newUnitName, setNewUnitName] = useState('');

    const filteredEmployees = useMemo(() => {
        if (!employees) return [];
        return employees.filter(e =>
            e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (e.position || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [employees, searchQuery]);

    const unitEmployees = useMemo(() => {
        if (!employees || !targetUnitId) return [];
        return employees.filter(e => e.org_unit_id === targetUnitId);
    }, [employees, targetUnitId]);

    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    const toggleExpand = (id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            const isExpanding = !next.has(id);

            if (isExpanding) {
                // Accordion behavior: Collapse siblings
                if (flatStructure) {
                    const node = flatStructure.find(n => n.id === id);
                    if (node) {
                        const parentId = node.parent_id;
                        // Find all currently expanded siblings
                        flatStructure.forEach(sibling => {
                            // If same parent, different ID, and is currently expanded -> Close it
                            if (sibling.parent_id === parentId && sibling.id !== id && next.has(sibling.id)) {
                                next.delete(sibling.id);
                            }
                        });
                    }
                }
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    };

    // Transform flat structure to Nodes/Edges
    useEffect(() => {
        if (!flatStructure) return;

        // 1. Build hierarchy map
        const childrenMap = new Map<number, number[]>();
        const roots: number[] = [];

        flatStructure.forEach(item => {
            if (item.parent_id) {
                if (!childrenMap.has(item.parent_id)) childrenMap.set(item.parent_id, []);
                childrenMap.get(item.parent_id)!.push(item.id);
            } else {
                roots.push(item.id);
            }
        });

        // 2. Identify visible nodes (Base: Roots are always visible)
        // If expandedIds is empty (first load), treat roots as expanded by default? 
        // Or user wants "base" meaning only roots.

        // Let's create a Set of visible IDs
        const visibleIds = new Set<number>();
        const traverse = (id: number) => {
            visibleIds.add(id);
            if (expandedIds.has(id)) {
                const children = childrenMap.get(id) || [];
                children.forEach(traverse);
            }
        };

        roots.forEach(traverse);

        // 3. Create Nodes
        const rawNodes: Node[] = flatStructure
            .filter(item => visibleIds.has(item.id))
            .map((item) => {
                const hasChildren = (childrenMap.get(item.id)?.length || 0) > 0;
                return {
                    id: item.id.toString(),
                    type: 'org',
                    data: {
                        label: item.name,
                        type: item.type,
                        head: item.head,
                        count: item.employee_count,
                        total_salary: item.total_salary,  // NEW: Pass total salary to node
                        onAddSub: () => handleAddSub(item.id),
                        onSetHead: () => handleSetHead(item.id),
                        onRemoveHead: () => handleRemoveHead(item.id),
                        onViewEmployees: () => handleViewEmployees(item.id, item.name),
                        onDelete: () => handleDelete(item.id),
                        onEdit: () => handleEdit(item.id, item.name),
                        hasChildren: hasChildren,
                        isExpanded: expandedIds.has(item.id),
                        onToggleExpand: () => toggleExpand(item.id)
                    },
                    position: { x: 0, y: 0 }
                };
            });

        // 4. Create Edges (only if both nodes visible)
        const rawEdges: Edge[] = flatStructure
            .filter(item => item.parent_id && visibleIds.has(item.id) && visibleIds.has(item.parent_id))
            .map(item => ({
                id: `e${item.parent_id}-${item.id}`,
                source: item.parent_id!.toString(),
                target: item.id.toString(),
                type: 'smoothstep',
                animated: true,
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: '#6366f1', strokeWidth: 2 }
            }));

        const layouted = getLayoutedElements(rawNodes, rawEdges);
        setNodes(layouted.nodes);
        setEdges(layouted.edges);

        // Auto-center view
        requestAnimationFrame(() => {
            fitView({ duration: 400, padding: 0.2 });
        });

    }, [flatStructure, expandedIds, fitView]);

    const onConnect = useCallback((params: Connection) => {
        if (params.source === params.target) return;

        if (confirm("Вы хотите переместить этот отдел?")) {
            updateUnit.mutate({
                id: parseInt(params.target!),
                data: { parent_id: parseInt(params.source!) }
            });
        }
    }, [updateUnit]);

    // Handlers
    const openCreateModal = (parentId: number | null = null) => {
        if (parentId) {
            const parent = flatStructure?.find(u => u.id === parentId);
            if (parent && parent.type === 'branch') {
                setCreateModalMode('department');
            } else {
                setCreateModalMode('department');
            }
        } else {
            setCreateModalMode('head_office');
        }
        setCreateParentId(parentId);
        setNewUnitName('');
        setIsCreateModalOpen(true);
    };

    const handleCreateUnit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUnitName.trim()) return;

        try {
            if (createModalMode === 'head_office') {
                await createBranch.mutateAsync({ name: newUnitName, type: 'head_office' });
            } else if (createModalMode === 'branch') {
                if (createParentId) {
                    await createDept.mutateAsync({ name: newUnitName, parent_id: createParentId, type: 'branch' });
                } else {
                    await createBranch.mutateAsync({ name: newUnitName, type: 'branch' });
                }
            } else {
                if (createParentId) {
                    await createDept.mutateAsync({ name: newUnitName, parent_id: createParentId });
                }
            }
            setIsCreateModalOpen(false);
            setNewUnitName('');
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddSub = (parentId: number) => {
        openCreateModal(parentId);
    };

    const handleAddRoot = () => {
        openCreateModal(null);
    };

    const handleSetHead = (unitId: number) => {
        setTargetUnitId(unitId);
        setSearchQuery('');
        setIsHeadModalOpen(true);
    };

    const handleRemoveHead = (unitId: number) => {
        if (confirm("Вы уверены, что хотите убрать руководителя?")) {
            updateUnit.mutate({ id: unitId, data: { head_id: 0 } });
        }
    };

    const handleViewEmployees = (unitId: number, unitName: string) => {
        setTargetUnitId(unitId);
        setTargetUnitName(unitName);
        setIsEmployeeModalOpen(true);
    };

    const assignHead = (employeeId: number) => {
        if (targetUnitId) {
            updateUnit.mutate({ id: targetUnitId, data: { head_id: employeeId } });
            setIsHeadModalOpen(false);
            setTargetUnitId(null);
        }
    };

    const handleDelete = (id: number) => {
        if (confirm("Удалить этот отдел? Это действие необратимо.")) {
            deleteUnit.mutate(id);
        }
    }

    const handleEdit = (id: number, currentName: string) => {
        const name = prompt("Новое название:", currentName);
        if (name && name !== currentName) {
            updateUnit.mutate({ id, data: { name } });
        }
    }

    const onLayout = useCallback(() => {
        const layouted = getLayoutedElements(nodes, edges);
        setNodes([...layouted.nodes]);
        setEdges([...layouted.edges]);
    }, [nodes, edges]);

    if (isLoading) return <div className="p-10 flex justify-center text-slate-500">Загрузка структуры...</div>;

    return (
        <div className="h-full w-full bg-slate-50 flex flex-col relative">

            <div className="absolute top-4 right-4 z-50 flex gap-2">
                <button onClick={onLayout} className="px-3 py-1.5 text-sm bg-white border border-slate-200 shadow-sm hover:bg-slate-50 rounded text-slate-700 font-medium transition-colors">
                    Авто-выравнивание
                </button>
                <button onClick={handleAddRoot} className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 rounded text-white font-medium flex items-center gap-1 shadow-sm transition-colors">
                    <Plus className="w-4 h-4" />
                    Головной офис
                </button>
            </div>

            <div className="flex-1 w-full h-full min-h-[600px]">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    fitView
                    nodesDraggable={true}
                    nodesConnectable={true}
                    connectionMode={ConnectionMode.Loose}
                    attributionPosition="bottom-right"
                    className="bg-slate-50"
                >
                    <Controls />
                    <MiniMap zoomable pannable />
                    <Background gap={12} size={1} color="#e2e8f0" />
                    <Panel position="top-center" className="bg-white/90 backdrop-blur p-4 rounded-xl border border-slate-200 shadow-sm text-sm text-slate-600 max-w-sm mt-2">
                        <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                            <Layout className="w-4 h-4" /> Оргструктура
                        </h3>
                        <p>
                            • <b>Соедините узлы</b>, чтобы изменить подчинение.<br />
                            • <b>ПКМ</b> или кнопки на узле для действий.<br />
                            • <b>Перетаскивайте</b> для удобного просмотра.
                        </p>
                    </Panel>
                </ReactFlow>
            </div>

            <Modal
                isOpen={isHeadModalOpen}
                onClose={() => setIsHeadModalOpen(false)}
                title="Назначить руководителя"
                maxWidth="max-w-md"
            >
                <div className="mb-4 relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Поиск сотрудника..."
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                    {filteredEmployees.map(emp => (
                        <div
                            key={emp.id}
                            onClick={() => assignHead(emp.id)}
                            className="p-3 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg cursor-pointer flex justify-between items-center group transition-all"
                        >
                            <div>
                                <div className="font-medium text-slate-700">{emp.full_name}</div>
                                <div className="text-xs text-slate-500">{emp.position || 'Без должности'}</div>
                            </div>
                            <span className="text-xs font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                Выбрать
                            </span>
                        </div>
                    ))}
                    {filteredEmployees.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">
                            Сотрудники не найдены
                        </div>
                    )}
                </div>
            </Modal>

            {/* Employee List Modal */}
            <Modal
                isOpen={isEmployeeModalOpen}
                onClose={() => setIsEmployeeModalOpen(false)}
                title={`Сотрудники: ${targetUnitName}`}
                maxWidth="max-w-2xl"
            >
                <div className="space-y-4">
                    {unitEmployees.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-500">
                            В этом подразделении нет сотрудников
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {unitEmployees.map(emp => (
                                <div key={emp.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:shadow-sm transition-shadow">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm">
                                            {emp.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-800">{emp.full_name}</div>
                                            <div className="text-xs text-slate-500">{emp.position || 'Без должности'}</div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {(emp.status as string) === 'Active' || (emp.status as string) === 'Активен' ? (
                                            <span className="text-green-600 bg-green-50 px-2 py-1 rounded-full">Активен</span>
                                        ) : (
                                            <span className="text-red-500 bg-red-50 px-2 py-1 rounded-full">{emp.status}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Create Unit Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title={
                    createModalMode === 'head_office' ? "Новый головной офис" :
                        createModalMode === 'branch' ? "Новый филиал" :
                            "Новое подразделение"
                }
                maxWidth="max-w-md"
            >
                <form onSubmit={handleCreateUnit}>
                    <p className="text-sm text-slate-500 mb-4">
                        {createModalMode === 'head_office'
                            ? "Головной офис - это верхний уровень организационной структуры."
                            : createModalMode === 'branch'
                                ? "Филиал - это подразделение компании в определенном регионе или направлении."
                                : "Отдел - это структурное подразделение."}
                    </p>

                    {/* Type Selector for head_office and department parents */}
                    {createParentId && (() => {
                        const parent = flatStructure?.find(u => u.id === createParentId);
                        const canChooseType = parent && (parent.type === 'head_office' || parent.type === 'department');

                        if (canChooseType) {
                            return (
                                <div className="mb-4">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Тип подразделения</label>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setCreateModalMode('department')}
                                            className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium text-sm transition-all ${createModalMode === 'department'
                                                ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                                }`}
                                        >
                                            📁 Отдел
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCreateModalMode('branch')}
                                            className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium text-sm transition-all ${createModalMode === 'branch'
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
                            createModalMode === 'head_office'
                                ? "Например: Головной офис"
                                : createModalMode === 'branch'
                                    ? "Например: Филиал в г. Алматы"
                                    : "Например: Финансовый департамент"
                        }
                        value={newUnitName}
                        onChange={e => setNewUnitName(e.target.value)}
                        required
                        autoFocus
                    />

                    <button
                        type="submit"
                        className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 shadow-lg shadow-slate-900/10 transition-all"
                    >
                        {createModalMode === 'head_office' ? 'Создать головной офис' :
                            createModalMode === 'branch' ? 'Создать филиал' :
                                'Добавить отдел'}
                    </button>
                </form>
            </Modal>
        </div>
    );
};


export default function OrgStructurePage() {
    return (
        <div className="h-full w-full">
            <ReactFlowProvider>
                <OrgStructureFlow />
            </ReactFlowProvider>
        </div>
    );
}
