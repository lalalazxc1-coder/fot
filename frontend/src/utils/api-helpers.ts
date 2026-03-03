/**
 * Centralized API error handling and utilities
 * FIX #22: Replaced `any` with proper types
 */

import { AxiosError } from 'axios';

export type ApiErrorResponse = {
    message: string;
    status?: number;
    details?: Record<string, unknown>;
};

const extractDetailMessage = (detail: unknown): string => {
    if (typeof detail === 'string') {
        return detail;
    }

    if (Array.isArray(detail)) {
        const messages = detail
            .map((item) => {
                if (typeof item === 'string') {
                    return item;
                }

                if (item && typeof item === 'object') {
                    const record = item as Record<string, unknown>;
                    const msg = typeof record.msg === 'string' ? record.msg : null;
                    const loc = Array.isArray(record.loc)
                        ? record.loc.map((part) => String(part)).join('.')
                        : null;

                    if (msg && loc) return `${loc}: ${msg}`;
                    if (msg) return msg;
                }

                return '';
            })
            .filter(Boolean);

        return messages.join('; ') || 'Ошибка валидации данных';
    }

    if (detail && typeof detail === 'object') {
        const record = detail as Record<string, unknown>;
        if (typeof record.msg === 'string') {
            return record.msg;
        }
        try {
            return JSON.stringify(detail);
        } catch {
            return 'Неизвестная ошибка';
        }
    }

    return 'Неизвестная ошибка';
};

/**
 * Handle API errors consistently across the app
 * @param error - Error object from API call
 * @returns Formatted error object
 */
export const handleApiError = (error: AxiosError<{ detail?: unknown }> | Error | unknown): ApiErrorResponse => {
    const axiosErr = error as AxiosError<{ detail?: unknown }>;

    // Network error
    if (!axiosErr.response) {
        return {
            message: 'Ошибка сети. Проверьте подключение к интернету.',
            status: 0,
        };
    }

    // HTTP error
    const status = axiosErr.response?.status || 500;
    const data = axiosErr.response?.data;

    switch (status) {
        case 400:
            return {
                message: extractDetailMessage(data?.detail) || 'Неверный запрос',
                status: 400,
                details: data as Record<string, unknown>,
            };
        case 401:
            return {
                message: 'Необходима авторизация',
                status: 401,
            };
        case 403:
            return {
                message: extractDetailMessage(data?.detail) || 'Доступ запрещен',
                status: 403,
            };
        case 404:
            return {
                message: extractDetailMessage(data?.detail) || 'Ресурс не найден',
                status: 404,
            };
        case 409:
            return {
                message: extractDetailMessage(data?.detail) || 'Конфликт данных',
                status: 409,
                details: data as Record<string, unknown>,
            };
        case 422:
            return {
                message: extractDetailMessage(data?.detail) || 'Ошибка валидации данных',
                status: 422,
                details: data as Record<string, unknown>,
            };
        case 500:
            return {
                message: 'Внутренняя ошибка сервера',
                status: 500,
            };
        default:
            return {
                message: extractDetailMessage(data?.detail) || `Ошибка сервера (${status})`,
                status,
                details: data as Record<string, unknown>,
            };
    }
};

/**
 * Show user-friendly error message
 * @param error - Error object or ApiErrorResponse
 * @returns User-friendly error message
 */
export const getErrorMessage = (error: AxiosError<{ detail?: unknown }> | Error | ApiErrorResponse | string | unknown): string => {
    if (typeof error === 'string') {
        return error;
    }

    const axiosErr = error as AxiosError<{ detail?: unknown }>;
    if (axiosErr?.response) {
        return handleApiError(axiosErr).message;
    }

    if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
        return (error as { message: string }).message;
    }

    const apiError = handleApiError(error);
    return apiError.message;
};

/**
 * Check if error is authentication error (401)
 * @param error - Error object
 * @returns true if 401 error
 */
export const isAuthError = (error: AxiosError | ApiErrorResponse | unknown): boolean => {
    const axiosErr = error as AxiosError;
    return axiosErr?.response?.status === 401 || (error as ApiErrorResponse)?.status === 401;
};

/**
 * Check if error is permission error (403)
 * @param error - Error object
 * @returns true if 403 error
 */
export const isPermissionError = (error: AxiosError | ApiErrorResponse | unknown): boolean => {
    const axiosErr = error as AxiosError;
    return axiosErr?.response?.status === 403 || (error as ApiErrorResponse)?.status === 403;
};

/**
 * Retry API call with exponential backoff
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param delay - Initial delay in ms (default: 1000)
 * @returns Promise with result or throws error
 */
export const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
): Promise<T> => {
    let lastError: unknown;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on client errors (4xx)
            const status = (error as AxiosError)?.response?.status || 0;
            if (status >= 400 && status < 500) {
                throw error;
            }

            // Wait before retry with exponential backoff
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    }

    throw lastError;
};

/**
 * Build query string from object
 * @param params - Object with query parameters
 * @returns Query string (e.g., "?key1=value1&key2=value2")
 */
export const buildQueryString = (params: Record<string, string | number | boolean | null | undefined>): string => {
    const entries = Object.entries(params).filter(([_, value]) => value !== null && value !== undefined);

    if (entries.length === 0) {
        return '';
    }

    const queryString = entries
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');

    return `?${queryString}`;
};
