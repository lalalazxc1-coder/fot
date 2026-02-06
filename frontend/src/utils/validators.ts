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
export const validateRequired = (value: any, fieldName: string = 'Поле'): string => {
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
    if (password.length < 6) {
        return { isValid: false, message: 'Пароль должен содержать минимум 6 символов' };
    }
    if (password.length > 128) {
        return { isValid: false, message: 'Пароль слишком длинный (макс. 128 символов)' };
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
