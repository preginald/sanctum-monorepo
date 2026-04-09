import { create } from 'zustand';
import { jwtDecode } from "jwt-decode";
import api from '../lib/api';
import { generatePKCE, generateState } from '../lib/pkce';

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

  loginWithSSO: async (redirectTo = null) => {
    // Fetch SSO config from backend
    const { data: config } = await api.get('/auth/sso/config');

    // Generate PKCE pair and state
    const { verifier, challenge } = await generatePKCE();
    const state = generateState();

    // Store in sessionStorage for the callback (include redirect target)
    const ssoData = { verifier, state };
    if (redirectTo) ssoData.redirectTo = redirectTo;
    sessionStorage.setItem('sanctum_sso', JSON.stringify(ssoData));

    // Redirect to Sanctum Auth
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.client_id,
      redirect_uri: config.redirect_uri,
      scope: config.scopes,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${config.authorize_url}?${params.toString()}`;
  },

  handleSSOCallback: async (code, state) => {
    // Retrieve PKCE verifier and validate state
    const stored = JSON.parse(sessionStorage.getItem('sanctum_sso') || 'null');
    if (!stored || stored.state !== state) {
      throw new Error('Invalid SSO state — possible CSRF');
    }
    const redirectTo = stored.redirectTo || null;
    sessionStorage.removeItem('sanctum_sso');

    // Fetch SSO config to get redirect_uri
    const { data: config } = await api.get('/auth/sso/config');

    // Exchange code for Core JWT
    const response = await api.post('/auth/sso/callback', {
      code,
      code_verifier: stored.verifier,
      redirect_uri: config.redirect_uri,
    });

    const { access_token, refresh_token } = response.data;
    const decodedUser = jwtDecode(access_token);

    localStorage.setItem('sanctum_token', access_token);
    if (refresh_token) {
      localStorage.setItem('sanctum_sso_refresh', refresh_token);
    }

    set({
      token: access_token,
      user: decodedUser,
      isAuthenticated: true,
    });

    return { user: decodedUser, redirectTo };
  },

  logout: () => {
    // Revoke SSO refresh token if present
    const ssoRefresh = localStorage.getItem('sanctum_sso_refresh');
    if (ssoRefresh) {
      api.post('/auth/sso/logout', { refresh_token: ssoRefresh }).catch(() => {});
      localStorage.removeItem('sanctum_sso_refresh');
    }

    localStorage.removeItem('sanctum_token');
    set({ token: null, user: null, isAuthenticated: false });
  }
}));

export default useAuthStore;
