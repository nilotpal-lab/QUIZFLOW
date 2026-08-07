import { create } from 'zustand';
import { PomodoroSession } from '../types';
import { api } from '../lib/api';

type TimerMode = 'WORK' | 'SHORT_BREAK' | 'LONG_BREAK';

const MODE_DURATIONS: Record<TimerMode, number> = {
  WORK: 25 * 60,
  SHORT_BREAK: 5 * 60,
  LONG_BREAK: 15 * 60,
};

interface PomodoroState {
  mode: TimerMode;
  timeLeft: number; // in seconds
  isRunning: boolean;
  activeTaskId: string | null;
  history: PomodoroSession[];
  totalWorkMins: number;
  totalSessions: number;

  setMode: (mode: TimerMode) => void;
  setActiveTaskId: (taskId: string | null) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  tick: () => void;
  completeSession: () => Promise<void>;
  fetchStats: () => Promise<void>;
  setTimeLeft: (seconds: number) => void;
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  mode: 'WORK',
  timeLeft: MODE_DURATIONS.WORK,
  isRunning: false,
  activeTaskId: null,
  history: [],
  totalWorkMins: 0,
  totalSessions: 0,

  setMode: (mode) => {
    set({
      mode,
      timeLeft: MODE_DURATIONS[mode],
      isRunning: false,
    });
  },

  setActiveTaskId: (taskId) => set({ activeTaskId: taskId }),

  startTimer: () => set({ isRunning: true }),
  pauseTimer: () => set({ isRunning: false }),

  resetTimer: () => {
    const currentMode = get().mode;
    set({
      timeLeft: MODE_DURATIONS[currentMode],
      isRunning: false,
    });
  },

  tick: () => {
    const { timeLeft, isRunning } = get();
    if (!isRunning) return;

    if (timeLeft <= 1) {
      set({ isRunning: false, timeLeft: 0 });
      get().completeSession();
    } else {
      set({ timeLeft: timeLeft - 1 });
    }
  },

  completeSession: async () => {
    const { mode, activeTaskId } = get();
    const durationMins = Math.round(MODE_DURATIONS[mode] / 60);

    try {
      await api.logPomodoro({
        taskId: activeTaskId || undefined,
        durationMins,
        mode,
      });
      await get().fetchStats();
    } catch (err) {
      console.error(err);
    }
  },

  fetchStats: async () => {
    try {
      const res = await api.getPomodoroStats();
      set({
        history: res.sessions,
        totalWorkMins: res.stats.totalWorkMins,
        totalSessions: res.stats.totalSessions,
      });
    } catch (err) {
      console.error(err);
    }
  },

  setTimeLeft: (seconds: number) => {
    set({ timeLeft: Math.max(1, seconds), isRunning: false });
  },
}));
