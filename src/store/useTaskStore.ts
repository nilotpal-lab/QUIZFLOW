import { create } from 'zustand';
import { Task, List, Tag, ViewType, EisenhowerQuadrant, Priority } from '../types';
import { api } from '../lib/api';

// Generate a local ID when backend is unavailable
const localId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

interface TaskState {
  tasks: Task[];
  trashTasks: Task[];
  lists: List[];
  tags: Tag[];
  activeView: ViewType;
  activeListId: string | null;
  activeTagId: string | null;
  selectedTaskId: string | null;
  searchQuery: string;
  isLoading: boolean;
  kanbanColumns: string[];
  hideCompleted: boolean;
  customSections: string[];

  isOmniModalOpen: boolean;
  openOmniModal: () => void;
  closeOmniModal: () => void;

  isLeftSidebarCollapsed: boolean;
  toggleLeftSidebar: () => void;
  isRightPanelCollapsed: boolean;
  toggleRightPanel: () => void;

  setHideCompleted: (hide: boolean) => void;
  addKanbanColumn: (name: string) => void;
  removeKanbanColumn: (name: string) => void;
  renameKanbanColumn: (oldName: string, newName: string) => void;
  addCustomSection: (name: string) => void;

  setActiveView: (view: ViewType, listId?: string | null, tagId?: string | null) => void;
  setSelectedTaskId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;

  fetchTasks: () => Promise<void>;
  fetchLists: () => Promise<void>;
  fetchTags: () => Promise<void>;

  createTask: (title: string, extra?: Partial<Task> & { tagIds?: string[] }) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task> & { tagIds?: string[] }) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  restoreTask: (id: string) => void;
  emptyTrash: () => void;

  createList: (name: string, color?: string, icon?: string, folderName?: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;

  createTag: (name: string, color?: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;

  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (subtaskId: string, currentStatus: boolean) => Promise<void>;
  deleteSubtask: (subtaskId: string) => Promise<void>;


}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  trashTasks: [],
  lists: [],
  tags: [],
  activeView: 'inbox',
  activeListId: null,
  activeTagId: null,
  selectedTaskId: null,
  searchQuery: '',
  isLoading: false,

  kanbanColumns: ['To Do', 'In Progress', 'Done'],
  hideCompleted: false,
  customSections: ['Getting Started', 'Feature Modules', 'Explore More'],

  isOmniModalOpen: false,
  openOmniModal: () => set({ isOmniModalOpen: true }),
  closeOmniModal: () => set({ isOmniModalOpen: false }),

  isLeftSidebarCollapsed: false,
  toggleLeftSidebar: () => set((state) => ({ isLeftSidebarCollapsed: !state.isLeftSidebarCollapsed })),
  isRightPanelCollapsed: false,
  toggleRightPanel: () => set((state) => ({ isRightPanelCollapsed: !state.isRightPanelCollapsed })),

  setHideCompleted: (hide) => set({ hideCompleted: hide }),
  addKanbanColumn: (name) => set((state) => ({ kanbanColumns: [...state.kanbanColumns, name] })),
  removeKanbanColumn: (name) => set((state) => ({ kanbanColumns: state.kanbanColumns.filter((c) => c !== name) })),
  renameKanbanColumn: (oldName, newName) => set((state) => ({ kanbanColumns: state.kanbanColumns.map((c) => c === oldName ? newName : c) })),
  addCustomSection: (name) => set((state) => ({ customSections: [...state.customSections, name] })),

  setActiveView: (view, listId = null, tagId = null) => {
    set({ activeView: view, activeListId: listId, activeTagId: tagId });
  },

  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  fetchTasks: async () => {
    set({ isLoading: true });
    try {
      const res = await api.getTasks();
      set({ tasks: res.tasks, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
    }
  },

  fetchLists: async () => {
    try {
      const res = await api.getLists();
      set({ lists: res.lists });
    } catch (err) {
      console.error(err);
    }
  },

  fetchTags: async () => {
    try {
      const res = await api.getTags();
      set({ tags: res.tags });
    } catch (err) {
      console.error(err);
    }
  },

  createTask: async (title, extra = {}) => {
    const activeListId = get().activeListId;
    const activeView = get().activeView;
    const resolvedListId = extra.listId !== undefined ? extra.listId : (activeListId || null);

    // Auto-calculate default due date based on active view if not provided
    let defaultDueDate = extra.dueDate;
    if (!defaultDueDate) {
      const now = new Date();
      if (activeView === 'today') {
        defaultDueDate = now.toISOString();
      } else if (activeView === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        defaultDueDate = tomorrow.toISOString();
      } else if (activeView === 'next7') {
        defaultDueDate = now.toISOString();
      }
    }

    // Map Priority to Eisenhower Quadrant automatically
    const priorityToEisenhower: Record<string, EisenhowerQuadrant> = {
      P1: 'Q1',
      P2: 'Q2',
      P3: 'Q3',
      P4: 'Q4',
    };
    const eisenhowerToPriority: Record<string, Priority> = {
      Q1: 'P1',
      Q2: 'P2',
      Q3: 'P3',
      Q4: 'P4',
    };

    const resolvedPriority = extra.priority || (extra.eisenhower ? eisenhowerToPriority[extra.eisenhower] : 'P4');
    const resolvedEisenhower = extra.eisenhower || (extra.priority ? priorityToEisenhower[extra.priority] : 'Q4');

    // Optimistic local task
    const optimisticTask: Task = {
      id: localId(),
      userId: 'local',
      title,
      priority: resolvedPriority,
      recurrence: 'NONE',
      status: 'TODO',
      eisenhower: resolvedEisenhower,
      kanbanCol: 'To Do',
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...extra,
      dueDate: defaultDueDate,
      listId: resolvedListId,
    };
    set((state) => ({ tasks: [optimisticTask, ...state.tasks] }));
    try {
      const res = await api.createTask({ title, ...extra, priority: resolvedPriority, eisenhower: resolvedEisenhower, dueDate: defaultDueDate, listId: resolvedListId });
      // Replace optimistic with real
      set((state) => ({ tasks: state.tasks.map((t) => t.id === optimisticTask.id ? res.task : t) }));
      return res.task;
    } catch {
      return optimisticTask;
    }
  },

  updateTask: async (id, updates) => {
    const priorityToEisenhower: Record<string, EisenhowerQuadrant> = { P1: 'Q1', P2: 'Q2', P3: 'Q3', P4: 'Q4' };
    const eisenhowerToPriority: Record<string, Priority> = { Q1: 'P1', Q2: 'P2', Q3: 'P3', Q4: 'P4' };

    const finalUpdates = { ...updates };
    if (updates.priority && !updates.eisenhower) {
      finalUpdates.eisenhower = priorityToEisenhower[updates.priority];
    } else if (updates.eisenhower && !updates.priority) {
      finalUpdates.priority = eisenhowerToPriority[updates.eisenhower];
    }

    // Optimistic update
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...finalUpdates } : t)),
    }));
    try {
      const res = await api.updateTask(id, finalUpdates);
      set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? res.task : t)) }));
    } catch { /* keep optimistic state */ }
  },

  toggleTask: async (id) => {
    // Optimistic UI update
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id === id) {
          const newStatus = t.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
          return { ...t, status: newStatus };
        }
        return t;
      }),
    }));
    try {
      const res = await api.toggleTask(id);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? res.task : t)),
      }));
    } catch (err) {
      /* keep optimistic state */
    }
  },

  deleteTask: async (id) => {
    const selectedId = get().selectedTaskId;
    const taskToDelete = get().tasks.find((t) => t.id === id);
    if (!taskToDelete) return;

    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      trashTasks: [taskToDelete, ...state.trashTasks],
      selectedTaskId: selectedId === id ? null : selectedId,
    }));
    try { await api.deleteTask(id); } catch { /* local delete done */ }
  },

  restoreTask: (id) => {
    const taskToRestore = get().trashTasks.find((t) => t.id === id);
    if (!taskToRestore) return;
    set((state) => ({
      trashTasks: state.trashTasks.filter((t) => t.id !== id),
      tasks: [taskToRestore, ...state.tasks],
    }));
  },

  emptyTrash: () => {
    set({ trashTasks: [] });
  },

  createList: async (name, color, icon, folderName) => {
    const optimistic: List = { id: localId(), userId: 'local', name, color: color || '#3b82f6', icon: icon || 'list', folderName, order: 0 };
    set((state) => ({ lists: [...state.lists, optimistic] }));
    try {
      const res = await api.createList({ name, color, icon, folderName });
      set((state) => ({ lists: state.lists.map((l) => l.id === optimistic.id ? res.list : l) }));
    } catch { /* keep optimistic list */ }
  },

  deleteList: async (id) => {
    set((state) => ({ lists: state.lists.filter((l) => l.id !== id) }));
    try { await api.deleteList(id); get().fetchTasks(); } catch { /* local delete done */ }
  },

  createTag: async (name, color) => {
    const optimistic: Tag = { id: localId(), userId: 'local', name, color: color || '#3b82f6' };
    set((state) => ({ tags: [...state.tags, optimistic] }));
    try {
      const res = await api.createTag({ name, color });
      set((state) => ({ tags: state.tags.map((t) => t.id === optimistic.id ? res.tag : t) }));
    } catch { /* keep optimistic tag */ }
  },

  deleteTag: async (id) => {
    set((state) => ({ tags: state.tags.filter((t) => t.id !== id) }));
    try { await api.deleteTag(id); } catch { /* local delete done */ }
  },

  addSubtask: async (taskId, title) => {
    const optimistic = { id: localId(), taskId, title, isCompleted: false, order: 0 };
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), optimistic] } : t
      ),
    }));
    try {
      const res = await api.addSubtask(taskId, title);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: (t.subtasks || []).map((s) => s.id === optimistic.id ? res.subtask : s) }
            : t
        ),
      }));
    } catch { /* keep optimistic subtask */ }
  },

  toggleSubtask: async (subtaskId, currentStatus) => {
    set((state) => ({
      tasks: state.tasks.map((t) => ({
        ...t,
        subtasks: t.subtasks?.map((s) =>
          s.id === subtaskId ? { ...s, isCompleted: !currentStatus } : s
        ),
      })),
    }));
    try { await api.updateSubtask(subtaskId, { isCompleted: !currentStatus }); } catch { /* optimistic kept */ }
  },

  deleteSubtask: async (subtaskId) => {
    set((state) => ({
      tasks: state.tasks.map((t) => ({
        ...t,
        subtasks: t.subtasks?.filter((s) => s.id !== subtaskId),
      })),
    }));
    try { await api.deleteSubtask(subtaskId); } catch { /* local delete done */ }
  },
}));
