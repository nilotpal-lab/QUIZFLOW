export type Priority = 'P1' | 'P2' | 'P3' | 'P4'; // P1: Red/Urgent, P2: Orange/High, P3: Blue/Medium, P4: Gray/Low
export type Recurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
export type EisenhowerQuadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface User {
  id: string;
  username: string;
  name?: string;
  reminderLeadMins?: number;
}

export interface List {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string;
  folderName?: string | null;
  order: number;
  _count?: {
    tasks: number;
  };
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string;
  _count?: {
    tasks: number;
  };
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  order: number;
}

export interface Task {
  id: string;
  userId: string;
  listId?: string | null;
  title: string;
  notes?: string | null;
  priority: Priority;
  dueDate?: string | null; // ISO string
  recurrence: Recurrence;
  status: TaskStatus;
  eisenhower: EisenhowerQuadrant;
  kanbanCol: string; // "To Do", "In Progress", "Done"
  timeStart?: string | null;
  timeEnd?: string | null;
  order: number;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks?: Subtask[];
  tags?: { tag: Tag }[];
  list?: List | null;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  count: number;
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  frequency: 'DAILY' | 'WEEKLY';
  targetDays: number;
  color: string;
  createdAt: string;
  updatedAt: string;
  logs?: HabitLog[];
  currentStreak?: number;
  longestStreak?: number;
  completedCount?: number;
}

export interface PomodoroSession {
  id: string;
  userId: string;
  taskId?: string | null;
  durationMins: number;
  mode: 'WORK' | 'SHORT_BREAK' | 'LONG_BREAK';
  completedAt: string;
  task?: Task | null;
}

export type ViewType =
  | 'inbox'
  | 'today'
  | 'tomorrow'
  | 'next7'
  | 'list'
  | 'completed'
  | 'trash'
  | 'calendar'
  | 'eisenhower'
  | 'kanban'
  | 'timeline'
  | 'habits'
  | 'pomodoro'
  | 'countdown'
  | 'tags'
  | 'settings';
