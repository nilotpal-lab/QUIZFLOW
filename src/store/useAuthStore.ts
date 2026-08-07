import { create } from 'zustand';
import { User } from '../types';
import { api } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: any) => Promise<void>;
  register: (credentials: any) => Promise<void>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('taskflow_token') : null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.login(credentials);
      localStorage.setItem('taskflow_token', res.token);
      set({ user: res.user, token: res.token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  register: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.register(credentials);
      localStorage.setItem('taskflow_token', res.token);
      set({ user: res.user, token: res.token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  deleteAccount: async () => {
    try {
      await api.deleteAccount();
    } catch (e) {
      // Continue cleanup even if network request fails
    }
    localStorage.removeItem('taskflow_token');
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('taskflow_token');
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('taskflow_token');
    if (!token) {
      set({ isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const res = await api.getMe();
      set({ user: res.user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      localStorage.removeItem('taskflow_token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
