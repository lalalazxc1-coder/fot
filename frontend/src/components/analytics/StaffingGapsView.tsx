import { Loader2, AlertCircle, ChevronRight, ChevronDown, Building2, LayoutGrid, User } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import React, { useState, useMemo } from 'react';
import { useTurnoverAnalytics } from '../../hooks/useAnalytics';

interface StaffingGapItem {
    id: number;
    parent_id: number | null;
    unit_name: string;
    unit_type: string;
    plan: number;
    fact: number;
    gap: number;
}

interface GapTreeNode extends StaffingGapItem {
    children: GapTreeNode[];
}

// Tree row component with individual expansion state management
const GapTreeRows = ({ node, level, expandedNodes, onToggle }: {
    node: GapTreeNode;
    level: number;
    expandedNodes: Set<number>;
    onToggle: (id: number) => void
}) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
        <React.Fragment key={node.id}>
            <tr className={`hover:bg-slate-50 transition-colors ${level === 0 ? 'bg-slate-50/50' : ''}`}>
                <td className="px-4 py-3 font-medium text-slate-700">
                    <div className="flex items-center gap-2" style={{ paddingLeft: level * 20 }}>
                        {hasChildren ? (
                            <button
                                onClick={() => onToggle(node.id)}
                                className="p-0.5 hover:bg-slate-200 rounded transition-colors"
                            >
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                            </button>
                        ) : (
                            <div className="w-5" />
                        )}

                        {node.unit_type === 'head_office' ? (
                            <Building2 className="w-4 h-4 text-indigo-600" />
                        ) : node.unit_type === 'branch' ? (
                            <Building2 className="w-4 h-4 text-slate-500" />
                        ) : node.unit_type === 'position' ? (
                            <User className="w-4 h-4 text-slate-400" />
                        ) : (
                            <LayoutGrid className="w-4 h-4 text-slate-400" />
                        )}

                        <span className={level === 0 ? 'font-bold' : ''}>{node.unit_name}</span>
                        {level === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">ROLLUP</span>}
                    </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{node.plan}</td>
                <td className="px-4 py-3 text-slate-600">{node.fact}</td>
                <td className={`px-4 py-3 font-bold ${node.gap > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    {node.gap > 0 ? `-${node.gap}` : node.gap < 0 ? `+${Math.abs(node.gap)}` : '0'}
                </td>
            </tr>
            {hasChildren && isExpanded && node.children.map(child => (
                <GapTreeRows
                    key={child.id}
                    node={child}
                    level={level + 1}
                    expandedNodes={expandedNodes}
                    onToggle={onToggle}
                />
            ))}
        </React.Fragment>
    );
};

export const StaffingGapsView = () => {
    const { data, isLoading } = useTurnoverAnalytics(365);

    const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

    const toggleNode = (id: number) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const treeData = useMemo(() => {
        if (!data?.staffing_gaps) return [];

        const map = new Map<number, GapTreeNode>();
        const roots: GapTreeNode[] = [];

        data.staffing_gaps.forEach((item: StaffingGapItem) => {
            map.set(item.id, { ...item, children: [] });
        });

        data.staffing_gaps.forEach((item: StaffingGapItem) => {
            const node = map.get(item.id)!;
            if (item.parent_id && map.has(item.parent_id)) {
                map.get(item.parent_id)!.children.push(node);
            } else {
                roots.push(node);
            }
        });

        return roots;
    }, [data?.staffing_gaps]);

    if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-slate-400" /></div>;

    if (!data) return <div>Нет данных</div>;

    const { turnover_rate, dismissed_count, reasons_distribution } = data;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* 1. Staffing Gaps */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        Кадровые разрывы (План vs Факт)
                    </h3>
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Иерархический вид</div>
                </div>

                {treeData.length === 0 ? (
                    <div className="text-slate-500 text-sm">Все плановые позиции заполнены!</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="sticky top-0 z-20 backdrop-blur-md bg-white/85 text-slate-500 font-bold uppercase text-[10px] tracking-wider after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-slate-200/80 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg border-b border-slate-100">Подразделение (Иерархия)</th>
                                    <th className="px-4 py-3 border-b border-slate-100">План (Агр.)</th>
                                    <th className="px-4 py-3 border-b border-slate-100">Факт (Агр.)</th>
                                    <th className="px-4 py-3 rounded-r-lg border-b border-slate-100">Вакансия (Разрыв)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/50">
                                {treeData.map(node => (
                                    <GapTreeRows
                                        key={node.id}
                                        node={node}
                                        level={0}
                                        expandedNodes={expandedNodes}
                                        onToggle={toggleNode}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 2. Turnover Metrics */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Текучесть кадров (год)</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                        <div className="text-red-600 text-sm font-medium mb-1">Коэффициент текучести</div>
                        <div className="text-3xl font-bold text-red-700">{turnover_rate}%</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="text-slate-600 text-sm font-medium mb-1">Уволено сотрудников</div>
                        <div className="text-3xl font-bold text-slate-800">{dismissed_count}</div>
                    </div>
                </div>
            </div>

            {/* 3. Reasons Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Причины увольнений</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={reasons_distribution}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={120}
                                tick={{ fontSize: 11 }}
                            />
                            <Tooltip />
                            <Bar dataKey="value" fill="#64748b" radius={[0, 4, 4, 0]}>
                                {reasons_distribution.map((_, index: number) => (
                                    <Cell key={`cell-${index}`} fill={['#ef4444', '#f59e0b', '#3b82f6', '#10b981'][index % 4] || '#64748b'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
