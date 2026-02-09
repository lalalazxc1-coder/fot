
import axios from 'axios';

const getBaseUrl = () => {
  const url = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
  if (url.endsWith('/api')) return url;
  return `${url}/api`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('fot_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.access_token) {
        config.headers.Authorization = `Bearer ${user.access_token}`;
      }
    } catch (e) {
      console.error('Error parsing user from localStorage', e);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Handle unauthorized, possibly redirect to login or clear storage in future
      // For now, let the component handle it or clear storage if needed.
      localStorage.removeItem('fot_user');
      // window.location.href = '/login'; -> commented out for now as App.tsx handles auth state
    }
    return Promise.reject(error);
  }
);

export { api };
