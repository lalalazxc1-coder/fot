import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
    extra?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, children, extra }) => {
    const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

    useEffect(() => {
        let isMounted = true;

        const findPortal = () => {
            if (!isMounted) return;
            const root = document.getElementById('page-header-portal');
            if (root) {
                setPortalRoot(root);
            } else {
                requestAnimationFrame(findPortal);
            }
        };
        findPortal();

        return () => {
            isMounted = false;
        };
    }, []);

    const portalContent = (
        <div className="min-w-0 flex flex-col justify-center animate-in fade-in duration-300">
            <h1 className="text-[17px] font-bold tracking-tight text-slate-800 truncate">{title}</h1>
            {subtitle && <p className="text-slate-500 text-[12px] leading-tight truncate mt-0.5">{subtitle}</p>}
        </div>
    );

    const isHiddenMain = portalRoot && !extra && !children;

    return (
        <>
            {portalRoot && createPortal(portalContent, portalRoot)}

            {!isHiddenMain && (
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 md:mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex-1">
                        {!portalRoot && (
                            <>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
                                {subtitle && <p className="text-slate-500 mt-1 text-sm md:text-lg leading-relaxed">{subtitle}</p>}
                            </>
                        )}
                        {extra && <div className={!portalRoot ? "mt-2" : ""}>{extra}</div>}
                    </div>

                    {children && (
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto mt-2 md:mt-0">
                            {children}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
