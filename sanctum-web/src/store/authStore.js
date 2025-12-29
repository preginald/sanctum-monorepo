import { create } from 'zustand';
import axios from 'axios';
import { jwtDecode } from "jwt-decode";

// Configure Axios base URL
const api = axios.create({
  baseURL: 'http://159.223.82.75:8000', // Your Droplet IP
});

// --- PERSISTENCE LOGIC ---
// Check if token exists on page load (so refresh doesn't kill session)
const storedToken = localStorage.getItem('sanctum_token');
let initialUser = null;

if (storedToken) {
  try {
    // Attempt to decode the stored token to get user data immediately
    initialUser = jwtDecode(storedToken);
  } catch (error) {
    console.error("Invalid token found, clearing storage.");
    localStorage.removeItem('sanctum_token');
  }
}

const useAuthStore = create((set) => ({
  user: initialUser,
  token: storedToken,
  isAuthenticated: !!storedToken, // True if token exists

  login: async (email, password) => {
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/token', formData);
      const { access_token } = response.data;

      // 1. DECODE THE TOKEN
      // This extracts { sub: "ceo@...", scope: "global" }
      const decodedUser = jwtDecode(access_token);

      // 2. SAVE TO STORAGE
      localStorage.setItem('sanctum_token', access_token);

      // 3. UPDATE STATE
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

  logout: () => {
    localStorage.removeItem('sanctum_token');
    set({ token: null, user: null, isAuthenticated: false });
  }
}));

export default useAuthStore;
