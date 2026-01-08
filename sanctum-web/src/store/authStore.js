import { create } from 'zustand';
import { jwtDecode } from "jwt-decode";
import api from '../lib/api';

// --- PERSISTENCE LOGIC ---
let storedToken = localStorage.getItem('sanctum_token');
let initialUser = null;

if (storedToken) {
  try {
    initialUser = jwtDecode(storedToken);
    // Check if expired client-side as well
    if (initialUser.exp * 1000 < Date.now()) {
      throw new Error("Token expired");
    }
  } catch (error) {
    console.error("Invalid or expired token found, clearing storage.");
    localStorage.removeItem('sanctum_token');
    storedToken = null; 
    initialUser = null;
  }
}

const useAuthStore = create((set) => ({
  user: initialUser,
  token: storedToken,
  isAuthenticated: !!storedToken,

  login: async (email, password) => {
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/token', formData);
      const { access_token } = response.data;

      const decodedUser = jwtDecode(access_token);

      localStorage.setItem('sanctum_token', access_token);
      
      set({ 
        token: access_token, 
        user: decodedUser, 
        isAuthenticated: true 
      });
      
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  },

  // --- THIS IS THE MISSING ACTION ---
  setToken: (access_token) => {
    try {
        const decodedUser = jwtDecode(access_token);
        localStorage.setItem('sanctum_token', access_token);
        set({ 
            token: access_token, 
            user: decodedUser, 
            isAuthenticated: true 
        });
    } catch (e) {
        console.error("Failed to set token:", e);
    }
  },

  logout: () => {
    localStorage.removeItem('sanctum_token');
    set({ token: null, user: null, isAuthenticated: false });
  }
}));

export default useAuthStore;