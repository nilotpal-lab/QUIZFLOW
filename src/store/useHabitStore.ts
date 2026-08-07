import { create } from 'zustand';
import { Habit } from '../types';
import { api } from '../lib/api';

const localId = () => `local_habit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

interface HabitState {
  habits: Habit[];
  isLoading: boolean;
  fetchHabits: () => Promise<void>;
  createHabit: (title: string, frequency?: string, targetDays?: number, color?: string) => Promise<void>;
  toggleCheckin: (habitId: string, date?: string) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  isLoading: false,

  fetchHabits: async () => {
    set({ isLoading: true });
    try {
      const res = await api.getHabits();
      set({ habits: res.habits, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
    }
  },

  createHabit: async (title, frequency, targetDays, color) => {
    const optimistic: Habit = {
      id: localId(),
      userId: 'local',
      title,
      frequency: (frequency as any) || 'DAILY',
      targetDays: targetDays || 7,
      color: color || '#3b82f6',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      logs: [],
      currentStreak: 0,
      longestStreak: 0,
      completedCount: 0,
    };

    set((state) => ({ habits: [optimistic, ...state.habits] }));

    try {
      const res = await api.createHabit({ title, frequency, targetDays, color });
      set((state) => ({
        habits: state.habits.map((h) => (h.id === optimistic.id ? res.habit : h)),
      }));
    } catch {
      /* Keep optimistic habit if offline */
    }
  },

  toggleCheckin: async (habitId, date) => {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Optimistic toggle
    set((state) => ({
      habits: state.habits.map((h) => {
        if (h.id !== habitId) return h;
        const logs = h.logs || [];
        const existing = logs.find((l) => l.date === targetDate);
        const newCompleted = existing ? !existing.completed : true;
        const updatedLogs = existing
          ? logs.map((l) => (l.date === targetDate ? { ...l, completed: newCompleted } : l))
          : [...logs, { id: localId(), habitId, date: targetDate, completed: true, count: 1 }];

        const completedCount = updatedLogs.filter((l) => l.completed).length;

        return {
          ...h,
          logs: updatedLogs,
          completedCount,
          currentStreak: newCompleted ? (h.currentStreak || 0) + 1 : Math.max(0, (h.currentStreak || 1) - 1),
        };
      }),
    }));

    try {
      const res = await api.toggleHabitCheckin(habitId, date);
      set((state) => ({
        habits: state.habits.map((h) => (h.id === habitId ? res.habit : h)),
      }));
    } catch {
      /* Keep optimistic toggle if offline */
    }
  },

  deleteHabit: async (habitId) => {
    set((state) => ({ habits: state.habits.filter((h) => h.id !== habitId) }));
    try {
      await api.deleteHabit(habitId);
    } catch {
      /* Local deletion already applied */
    }
  },
}));
