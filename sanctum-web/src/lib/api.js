import axios from 'axios';

// 1. Create the Instance
const api = axios.create({
  baseURL: '/api',
});

// 2. Request Interceptor (Attach Token Automatically)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sanctum_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 3. Response Interceptor (The Ghostbuster)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401 Unauthorized (Expired/Invalid)
    if (error.response?.status === 401) {
      console.warn("Session expired. Redirecting...");

      // Clear local storage
      localStorage.removeItem('sanctum_token');

      // Capture where the user WAS
      const currentPath = window.location.pathname;

      // Don't loop if already on login
      if (!currentPath.includes('/login')) {
        // Store redirect target in sessionStorage for Login to pick up
        sessionStorage.setItem('sanctum_redirect', currentPath);
        window.location.href = `/login?expired=true`;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
