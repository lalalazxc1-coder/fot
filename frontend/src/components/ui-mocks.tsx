import React from 'react';

export const Card = ({ className, children }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={`rounded-xl border bg-white text-slate-900 shadow-sm ${className}`}>{children}</div>
);

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, ...props }, ref) => (
    <button ref={ref} className={`inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none bg-slate-900 text-white hover:bg-slate-800 h-10 px-4 py-2 ${className}`} {...props} />
))
Button.displayName = "Button";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
    <input type={type} className={`flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} ref={ref} {...props} />
))
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
    <select className={`flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} ref={ref} {...props} />
))
Select.displayName = "Select";
