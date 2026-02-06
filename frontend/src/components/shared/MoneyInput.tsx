import React from 'react';

/**
 * Reusable money input component with automatic formatting
 * Handles number input and displays it as formatted currency
 */
interface MoneyInputProps {
    value: number;
    onChange: (value: number) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    required?: boolean;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
    value,
    onChange,
    placeholder = '0',
    className = '',
    disabled = false,
    required = false
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Extract only digits from input
        const raw = e.target.value.replace(/\D/g, '');
        onChange(raw ? parseInt(raw, 10) : 0);
    };

    return (
        <input
            type="text"
            className={`h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all ${className}`}
            placeholder={placeholder}
            value={value === 0 ? '' : value.toLocaleString('ru-RU')}
            onChange={handleChange}
            disabled={disabled}
            required={required}
        />
    );
};
