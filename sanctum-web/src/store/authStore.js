import { create } from 'zustand';
import axios from 'axios';

// Configure Axios base URL
const api = axios.create({
  baseURL: 'http://159.223.82.75:8000', // Your Droplet IP
});

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('sanctum_token') || null,
  isAuthenticated: false,

  login: async (email, password) => {
    try {
      // The FastAPI OAuth2 expects form-data, not JSON
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/token', formData);
      const { access_token } = response.data;

      // Save token
      localStorage.setItem('sanctum_token', access_token);
      
      set({ token: access_token, isAuthenticated: true });
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('sanctum_token');
    set({ token: null, user: null, isAuthenticated: false });
  }
}));

export default useAuthStore;
