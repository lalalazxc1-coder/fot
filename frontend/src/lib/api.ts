import axios from 'axios';
import { toast } from 'sonner';

const getBaseUrl = () => {
  // Use relative path by default to leverage Vite's proxy and avoid cross-origin cookie issues
  const url = (import.meta as any).env.VITE_API_URL || '';
  if (!url) return '/api';
  if (url.endsWith('/api')) return url;
  return `${url}/api`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true, // FIX #19: Enable HttpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('fot_user') || sessionStorage.getItem('fot_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.access_token) {
        config.headers.Authorization = `Bearer ${user.access_token}`;
      }
    } catch (e) {
      console.error('Error parsing user from storage', e);
    }
  }
  return config;
});

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
          localStorage.removeItem('fot_user');
          sessionStorage.removeItem('fot_user');
          toast.error('Сессия истекла. Пожалуйста, войдите снова.');
          window.dispatchEvent(new CustomEvent('session-expired'));
        }
        return Promise.reject(refreshError);
      }
    }

    // For 403 or other 401s where refresh already failed
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('fot_user');
        sessionStorage.removeItem('fot_user');
        toast.error('Возникла ошибка авторизации. Пожалуйста, войдите снова.');
        window.dispatchEvent(new CustomEvent('session-expired'));
      }
    }
    return Promise.reject(error);
  }
);

export { api };
