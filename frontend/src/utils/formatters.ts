/**
 * Centralized formatting utilities
 * Used across the application for consistent data display
 */

/**
 * Format number as KZT currency
 * @param value - The number to format
 * @returns Formatted currency string (e.g., "1 500 000 ₸")
 */
export const formatMoney = (value: number): string => {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'KZT',
        maximumFractionDigits: 0,
    }).format(value);
};

/**
 * Format number as KZT currency (short version with K/M suffixes)
 * @param value - The number to format
 * @returns Formatted short currency string (e.g., "1.5M ₸")
 */
export const formatMoneyShort = (value: number): string => {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M ₸`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(0)}K ₸`;
    }
    return formatMoney(value);
};

/**
 * Parse formatted money string back to number
 * @param value - Formatted string (e.g., "1 500 000 ₸")
 * @returns Parsed number
 */
export const parseMoney = (value: string): number => {
    return parseInt(value.replace(/[^\d]/g, '')) || 0;
};

/**
 * Format date to День-Месяц-Год (DD-MM-YYYY)
 * @param date - Date string or Date object
 * @returns Formatted date (e.g., "06-02-2026")
 */
export const formatDate = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) {
        return typeof date === 'string' ? date : '—';
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

/**
 * Format datetime to День-Месяц-Год with time
 * @param date - Date string or Date object
 * @returns Formatted datetime (e.g., "06-02-2026, 15:30")
 */
export const formatDateTime = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) {
        return typeof date === 'string' ? date : '—';
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year}, ${hours}:${minutes}`;
};

/**
 * Format number with thousand separators
 * @param value - The number to format
 * @returns Formatted number string (e.g., "1 500 000")
 */
export const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('ru-RU').format(value);
};

/**
 * Format percentage
 * @param value - The number to format (e.g., 0.75 for 75%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string (e.g., "75.0%")
 */
export const formatPercent = (value: number, decimals: number = 1): string => {
    return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Currency symbol constant
 */
export const CURRENCY = '₸';
