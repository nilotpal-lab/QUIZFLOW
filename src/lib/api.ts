import { Task, List, Tag, Habit, PomodoroSession, User } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('taskflow_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options?.headers || {}),
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'An API error occurred');
  }

  return data as T;
}

export const api = {
  // Auth
  register: (body: any) => fetchApi<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => fetchApi<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => fetchApi<{ user: User }>('/auth/me'),
  updateSettings: (body: any) => fetchApi<{ user: User }>('/auth/settings', { method: 'PUT', body: JSON.stringify(body) }),
  deleteAccount: () => fetchApi<{ success: boolean; message: string }>('/auth/account', { method: 'DELETE' }),

  // Tasks
  getTasks: (params?: { listId?: string; tagId?: string; status?: string }) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params || {}).filter(([, v]) => v != null)
    );
    const query = new URLSearchParams(cleanParams).toString();
    return fetchApi<{ tasks: Task[] }>(`/tasks${query ? `?${query}` : ''}`);
  },
  createTask: (body: Partial<Task> & { rawTitle?: string; tagIds?: string[] }) =>
    fetchApi<{ task: Task }>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
  updateTask: (id: string, body: Partial<Task> & { tagIds?: string[] }) =>
    fetchApi<{ task: Task }>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  toggleTask: (id: string) => fetchApi<{ task: Task }>(`/tasks/${id}/toggle`, { method: 'PATCH' }),
  deleteTask: (id: string) => fetchApi<{ success: boolean; id: string }>(`/tasks/${id}`, { method: 'DELETE' }),

  // Subtasks
  addSubtask: (taskId: string, title: string) =>
    fetchApi<{ subtask: any }>(`/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify({ title }) }),
  updateSubtask: (subtaskId: string, body: { title?: string; isCompleted?: boolean }) =>
    fetchApi<{ subtask: any }>(`/tasks/subtasks/${subtaskId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSubtask: (subtaskId: string) =>
    fetchApi<{ success: boolean; id: string }>(`/tasks/subtasks/${subtaskId}`, { method: 'DELETE' }),

  // Lists
  getLists: () => fetchApi<{ lists: List[] }>('/lists'),
  createList: (body: { name: string; color?: string; icon?: string; folderName?: string }) =>
    fetchApi<{ list: List }>('/lists', { method: 'POST', body: JSON.stringify(body) }),
  updateList: (id: string, body: Partial<List>) => fetchApi<{ list: List }>(`/lists/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteList: (id: string) => fetchApi<{ success: boolean; id: string }>(`/lists/${id}`, { method: 'DELETE' }),

  // Tags
  getTags: () => fetchApi<{ tags: Tag[] }>('/tags'),
  createTag: (body: { name: string; color?: string }) =>
    fetchApi<{ tag: Tag }>('/tags', { method: 'POST', body: JSON.stringify(body) }),
  deleteTag: (id: string) => fetchApi<{ success: boolean; id: string }>(`/tags/${id}`, { method: 'DELETE' }),

  // Habits
  getHabits: () => fetchApi<{ habits: Habit[] }>('/habits'),
  createHabit: (body: { title: string; frequency?: string; targetDays?: number; color?: string }) =>
    fetchApi<{ habit: Habit }>('/habits', { method: 'POST', body: JSON.stringify(body) }),
  toggleHabitCheckin: (id: string, date?: string) =>
    fetchApi<{ habit: Habit }>(`/habits/${id}/checkin`, { method: 'POST', body: JSON.stringify({ date }) }),
  deleteHabit: (id: string) => fetchApi<{ success: boolean; id: string }>(`/habits/${id}`, { method: 'DELETE' }),

  // Pomodoro
  logPomodoro: (body: { taskId?: string; durationMins: number; mode: string }) =>
    fetchApi<{ session: PomodoroSession }>('/pomodoro/session', { method: 'POST', body: JSON.stringify(body) }),
  getPomodoroStats: () =>
    fetchApi<{ sessions: PomodoroSession[]; stats: { totalWorkMins: number; totalSessions: number } }>('/pomodoro/stats'),
};
