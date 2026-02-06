import React from 'react';
import { AlertCircle, Inbox, Search } from 'lucide-react';

interface EmptyStateProps {
    title: string;
    description?: string;
    icon?: 'inbox' | 'search' | 'alert';
    action?: {
        label: string;
        onClick: () => void;
    };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon = 'inbox',
    action
}) => {
    const icons = {
        inbox: Inbox,
        search: Search,
        alert: AlertCircle
    };

    const Icon = icons[icon];

    return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Icon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-slate-500 max-w-md mb-6">{description}</p>
            )}
            {action && (
                <button
                    onClick={action.onClick}
                    className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};
