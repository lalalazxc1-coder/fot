import React from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
    extra?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, children, extra }) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
                {subtitle && <p className="text-slate-500 mt-1 text-lg leading-relaxed">{subtitle}</p>}
                {extra}
            </div>
            <div className="flex items-center gap-3">
                {children}
            </div>
        </div>
    );
};
