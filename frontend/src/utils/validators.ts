/**
 * Centralized validation utilities
 * Used for form validation and data integrity checks
 */

/**
 * Validate email format
 * @param email - Email string to validate
 * @returns true if valid email format
 */
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate salary range (min <= max)
 * @param min - Minimum salary
 * @param max - Maximum salary
 * @returns Error message if invalid, empty string if valid
 */
export const validateSalaryRange = (min: number, max: number): string => {
    if (min < 0 || max < 0) {
        return 'Зарплата не может быть отрицательной';
    }
    if (min > max) {
        return 'Минимальная зарплата не может превышать максимальную';
    }
    return '';
};

/**
 * Validate positive number
 * @param value - Number to validate
 * @param fieldName - Name of field for error message
 * @returns Error message if invalid, empty string if valid
 */
export const validatePositiveNumber = (value: number, fieldName: string = 'Значение'): string => {
    if (value < 0) {
        return `${fieldName} не может быть отрицательным`;
    }
    if (isNaN(value)) {
        return `${fieldName} должно быть числом`;
    }
    return '';
};

/**
 * Validate required field
 * @param value - Value to check
 * @param fieldName - Name of field for error message
 * @returns Error message if empty, empty string if valid
 */
export const validateRequired = (value: unknown, fieldName: string = 'Поле'): string => {
    if (value === null || value === undefined || value === '') {
        return `${fieldName} обязательно для заполнения`;
    }
    return '';
};

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Object with isValid flag and error message
 */
export const validatePassword = (password: string): { isValid: boolean; message: string } => {
    if (password.length < 8) {
        return { isValid: false, message: 'Пароль должен содержать минимум 8 символов' };
    }
    if (password.length > 128) {
        return { isValid: false, message: 'Пароль слишком длинный (макс. 128 символов)' };
    }
    if (!/[a-zA-Zа-яА-Я]/.test(password)) {
        return { isValid: false, message: 'Пароль должен содержать хотя бы одну букву' };
    }
    if (!/\d/.test(password)) {
        return { isValid: false, message: 'Пароль должен содержать хотя бы одну цифру' };
    }
    return { isValid: true, message: '' };
};

/**
 * Validate phone number (Russian format)
 * @param phone - Phone number to validate
 * @returns true if valid format
 */
export const isValidPhone = (phone: string): boolean => {
    // Accepts: +7XXXXXXXXXX, 8XXXXXXXXXX, 7XXXXXXXXXX
    const phoneRegex = /^(\+7|8|7)\d{10}$/;
    return phoneRegex.test(phone.replace(/[\s()-]/g, ''));
};

/**
 * Normalize phone to +7XXXXXXXXXX format
 */
export const normalizePhone = (phone: string): string => {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (!cleaned) return '';

    if (cleaned.startsWith('+7') && cleaned.length === 12) return cleaned;
    if (cleaned.startsWith('8') && cleaned.length === 11) return `+7${cleaned.slice(1)}`;
    if (cleaned.startsWith('7') && cleaned.length === 11) return `+${cleaned}`;

    return cleaned;
};

/**
 * Format phone for display/input mask: +7 700 000 00 00
 */
export const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';

    let normalized = digits;
    if (normalized.startsWith('8')) normalized = `7${normalized.slice(1)}`;
    if (!normalized.startsWith('7')) normalized = `7${normalized}`;
    normalized = normalized.slice(0, 11);

    const p1 = normalized.slice(1, 4);
    const p2 = normalized.slice(4, 7);
    const p3 = normalized.slice(7, 9);
    const p4 = normalized.slice(9, 11);

    let result = '+7';
    if (p1) result += ` ${p1}`;
    if (p2) result += ` ${p2}`;
    if (p3) result += ` ${p3}`;
    if (p4) result += ` ${p4}`;
    return result;
};

/**
 * Sanitize string (remove potentially dangerous characters)
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export const sanitizeString = (input: string): string => {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};
