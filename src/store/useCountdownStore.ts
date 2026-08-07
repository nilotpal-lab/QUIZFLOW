import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CountdownItem {
  id: string;
  title: string;
  targetDate: string; // ISO or YYYY-MM-DD
  category?: string; // "Birthday", "Launch", "Exam", "Holiday"
  icon?: string;
  isPinned?: boolean;
  color?: string;
}

interface CountdownState {
  countdowns: CountdownItem[];
  createCountdown: (item: Omit<CountdownItem, 'id'>) => void;
  deleteCountdown: (id: string) => void;
  togglePinCountdown: (id: string) => void;
}

const generateId = () => `cd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const useCountdownStore = create<CountdownState>()(
  persist(
    (set) => ({
      countdowns: [
        { id: generateId(), title: 'Product V2 Launch', targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), category: 'Launch', color: '#3b82f6' },
        { id: generateId(), title: 'Birthday Celebration', targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), category: 'Birthday', color: '#ec4899' },
        { id: generateId(), title: 'Final Exam', targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), category: 'Exam', color: '#eab308' },
      ],
      createCountdown: (item) => set((state) => ({
        countdowns: [...state.countdowns, { ...item, id: generateId() }],
      })),
      deleteCountdown: (id) => set((state) => ({
        countdowns: state.countdowns.filter((c) => c.id !== id),
      })),
      togglePinCountdown: (id) => set((state) => ({
        countdowns: state.countdowns.map((c) =>
          c.id === id ? { ...c, isPinned: !c.isPinned } : c
        ),
      })),
    }),
    { name: 'taskflow-countdowns' }
  )
);
