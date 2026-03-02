import axios from 'axios';
import { toast } from 'sonner';

const getBaseUrl = () => {
  const url = import.meta.env.VITE_API_URL || '';

  if (!url || url.includes('backend:8000')) {
    return '/api';
  } else if (url.endsWith('/api')) {
    return url;
  } else {
    return `${url}/api`;
  }
};

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true, // FIX #19: Enable HttpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

const CSRF_HEADER_NAME = 'X-CSRF-Token';

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const ensureCsrfToken = async (): Promise<string | null> => {
  let token = readCookie('csrf_token');
  if (token) return token;

  try {
    await axios.get(getBaseUrl() + '/auth/csrf', { withCredentials: true });
    token = readCookie('csrf_token');
    return token;
  } catch {
    return null;
  }
};

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (!isMutating) return config;

  const token = await ensureCsrfToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers[CSRF_HEADER_NAME] = token;
  }

  return config;
});

// NEW-1 FIX: НЕ читаем access_token из localStorage — аутентификация через HttpOnly cookie.
// Браузер автоматически отправляет cookie при withCredentials: true.
// Это исключает возможность кражи токена через XSS (токен недоступен из JS).

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Attempt refresh on 401 (Unauthorized)
    if (error.response && error.response.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login')) {
      originalRequest._retry = true;
      try {
        await axios.post(getBaseUrl() + '/auth/refresh', {}, { withCredentials: true });
        // Retry original request if refresh is successful
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        if (!window.location.pathname.includes('/login')) {
          const hadSession = !!(localStorage.getItem('fot_user') || sessionStorage.getItem('fot_user'));
          localStorage.removeItem('fot_user');
          sessionStorage.removeItem('fot_user');
          if (hadSession) {
            toast.error('Сессия истекла. Пожалуйста, войдите снова.');
          }
          window.dispatchEvent(new CustomEvent('session-expired'));
        }
        return Promise.reject(refreshError);
      }
    }

    // For 401s where refresh already failed (we don't logout on 403, 403 just means no permission for a specific action)
    if (error.response && error.response.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        const hadSession = !!(localStorage.getItem('fot_user') || sessionStorage.getItem('fot_user'));
        localStorage.removeItem('fot_user');
        sessionStorage.removeItem('fot_user');
        if (hadSession) {
          toast.error('Возникла ошибка авторизации. Пожалуйста, войдите снова.');
        }
        window.dispatchEvent(new CustomEvent('session-expired'));
      }
    } else if (error.response && error.response.status === 403) {
      // Just show a permission error toast, don't logout
      toast.error('У вас нет прав для этого действия');
    }
    return Promise.reject(error);
  }
);

export { api };
