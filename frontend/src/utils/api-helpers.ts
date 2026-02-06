/**
 * Centralized API error handling and utilities
 */

export type ApiError = {
    message: string;
    status?: number;
    details?: any;
};

/**
 * Handle API errors consistently across the app
 * @param error - Error object from API call
 * @returns Formatted error object
 */
export const handleApiError = (error: any): ApiError => {
    // Network error
    if (!error.response) {
        return {
            message: 'Ошибка сети. Проверьте подключение к интернету.',
            status: 0,
        };
    }

    // HTTP error
    const status = error.response?.status || 500;
    const data = error.response?.data;

    switch (status) {
        case 400:
            return {
                message: data?.detail || 'Неверный запрос',
                status: 400,
                details: data,
            };
        case 401:
            return {
                message: 'Необходима авторизация',
                status: 401,
            };
        case 403:
            return {
                message: data?.detail || 'Доступ запрещен',
                status: 403,
            };
        case 404:
            return {
                message: data?.detail || 'Ресурс не найден',
                status: 404,
            };
        case 409:
            return {
                message: data?.detail || 'Конфликт данных',
                status: 409,
                details: data,
            };
        case 422:
            return {
                message: data?.detail || 'Ошибка валидации данных',
                status: 422,
                details: data,
            };
        case 500:
            return {
                message: 'Внутренняя ошибка сервера',
                status: 500,
            };
        default:
            return {
                message: data?.detail || `Ошибка сервера (${status})`,
                status,
                details: data,
            };
    }
};

/**
 * Show user-friendly error message
 * @param error - Error object or ApiError
 * @returns User-friendly error message
 */
export const getErrorMessage = (error: any): string => {
    if (typeof error === 'string') {
        return error;
    }

    if (error?.message) {
        return error.message;
    }

    const apiError = handleApiError(error);
    return apiError.message;
};

/**
 * Check if error is authentication error (401)
 * @param error - Error object
 * @returns true if 401 error
 */
export const isAuthError = (error: any): boolean => {
    return error?.response?.status === 401 || error?.status === 401;
};

/**
 * Check if error is permission error (403)
 * @param error - Error object
 * @returns true if 403 error
 */
export const isPermissionError = (error: any): boolean => {
    return error?.response?.status === 403 || error?.status === 403;
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
    let lastError: any;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on client errors (4xx)
            const status = error?.response?.status || 0;
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
export const buildQueryString = (params: Record<string, any>): string => {
    const entries = Object.entries(params).filter(([_, value]) => value !== null && value !== undefined);

    if (entries.length === 0) {
        return '';
    }

    const queryString = entries
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');

    return `?${queryString}`;
};
