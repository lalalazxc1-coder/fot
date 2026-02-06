import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
    fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'md',
    text,
    fullScreen = false
}) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };

    const containerClasses = fullScreen
        ? 'fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50'
        : 'flex flex-col items-center justify-center p-10';

    return (
        <div className={containerClasses}>
            <Loader2 className={`${sizeClasses[size]} animate-spin text-slate-400`} />
            {text && <p className="mt-3 text-sm text-slate-500 font-medium">{text}</p>}
        </div>
    );
};
