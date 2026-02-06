import React from 'react';

interface EmployeeTabsProps {
    activeTab: 'active' | 'dismissed';
    onTabChange: (tab: 'active' | 'dismissed') => void;
    hasDismissed: boolean;
}

export const EmployeeTabs: React.FC<EmployeeTabsProps> = ({
    activeTab,
    onTabChange,
    hasDismissed
}) => {
    if (!hasDismissed) return null;

    return (
        <div className="flex gap-2 border-b border-slate-200 mb-4">
            <button
                onClick={() => onTabChange('active')}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'active'
                        ? 'border-slate-900 text-slate-900'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
            >
                Активные сотрудники
            </button>
            <button
                onClick={() => onTabChange('dismissed')}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'dismissed'
                        ? 'border-red-500 text-red-500'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
            >
                Уволенные
            </button>
        </div>
    );
};
