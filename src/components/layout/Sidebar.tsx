'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Calendar,
  Timer,
  Target,
  BarChart3,
  Trophy,
  Bell,
  Settings,
  HelpCircle,
  Sun,
  Moon,
  Plus,
  Inbox,
  CalendarDays,
  Tag as TagIcon,
  Trash2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { isToday, isFuture } from 'date-fns';
import { useTaskStore } from '../../store/useTaskStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';

export const Sidebar: React.FC = () => {
  const {
    activeView,
    activeListId,
    activeTagId,
    setActiveView,
    lists,
    tags,
    tasks,
    trashTasks,
    createList,
    createTag,
    openOmniModal,
    isLeftSidebarCollapsed,
    toggleLeftSidebar,
  } = useTaskStore();

  const { user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // 100% Real Dynamic Calculations
  const todoTasks = tasks.filter((t) => t.status !== 'COMPLETED');
  
  const todayCount = todoTasks.filter((t) => {
    if (!t.dueDate) return false;
    try {
      return isToday(new Date(t.dueDate));
    } catch (e) {
      return false;
    }
  }).length;

  const tomorrowCount = todoTasks.filter((t) => {
    if (!t.dueDate) return false;
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      return t.dueDate.startsWith(tomorrowStr);
    } catch (e) {
      return false;
    }
  }).length;

  const upcomingCount = todoTasks.filter((t) => {
    if (!t.dueDate) return false;
    try {
      const d = new Date(t.dueDate);
      return isFuture(d) && !isToday(d);
    } catch (e) {
      return false;
    }
  }).length;

  const inboxCount = todoTasks.filter((t) => !t.listId || t.list?.name === 'Inbox').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const trashCount = trashTasks.length;

  // Fallback initial lists if store has none, else use store lists
  const displayLists = lists.length > 0 ? lists : [
    { id: 'default_personal', name: 'Personal', color: 'bg-purple-500' },
    { id: 'default_work', name: 'Work', color: 'bg-blue-500' },
    { id: 'default_study', name: 'Study', color: 'bg-emerald-500' },
    { id: 'default_shopping', name: 'Shopping', color: 'bg-orange-500' },
    { id: 'default_ideas', name: 'Ideas', color: 'bg-pink-500' },
  ];

  // Fallback initial tags if store has none, else use store tags
  const displayTags = tags.length > 0 ? tags : [
    { id: 'default_important', name: 'Important', color: 'text-red-400' },
    { id: 'default_urgent', name: 'Urgent', color: 'text-amber-400' },
    { id: 'default_meeting', name: 'Meeting', color: 'text-blue-400' },
    { id: 'default_home', name: 'Home', color: 'text-emerald-400' },
  ];

  const getListCount = (listId: string, listName: string) => {
    return todoTasks.filter(
      (t) => t.listId === listId || t.list?.name?.toLowerCase() === listName.toLowerCase()
    ).length;
  };

  const getTagCount = (tagId: string, tagName: string) => {
    return todoTasks.filter((t) =>
      t.tags?.some(
        (tr) => tr.tag.id === tagId || tr.tag.name?.toLowerCase() === tagName.toLowerCase()
      )
    ).length;
  };

  const handleAddList = (e: React.FormEvent) => {
    e.preventDefault();
    if (newListName.trim()) {
      createList(newListName.trim());
      setNewListName('');
      setIsAddingList(false);
    }
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagName.trim()) {
      createTag(newTagName.trim());
      setNewTagName('');
      setIsAddingTag(false);
    }
  };

  return (
    <aside className="h-screen bg-[#F8FAF8] dark:bg-[#0C0C12] border-r border-slate-200/80 dark:border-white/[0.06] flex text-slate-700 dark:text-slate-300 select-none shrink-0 font-sans">
      {/* 1. Left Vertical Rail */}
      <div className="w-14 h-full bg-white dark:bg-[#09090E] border-r border-slate-200/80 dark:border-white/[0.06] flex flex-col justify-between items-center py-4">
        <div className="flex flex-col items-center space-y-4 w-full px-2">
          {/* Profile Avatar */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center cursor-pointer shadow-lg shadow-indigo-500/20 active:scale-95 transition-all duration-150">
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>

          <div className="w-full h-px bg-slate-200/80 dark:bg-white/[0.06] my-1" />

          {/* Primary View Icons */}
          <button
            onClick={() => setActiveView('inbox')}
            className={`p-2.5 rounded-xl w-full flex justify-center active:scale-95 transition-all duration-150 ${
              activeView === 'inbox'
                ? 'bg-indigo-50 dark:bg-blue-600/20 border border-indigo-200 dark:border-blue-500/40 text-indigo-600 dark:text-blue-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
            title="Tasks"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveView('calendar')}
            className={`p-2.5 rounded-xl w-full flex justify-center active:scale-95 transition-all duration-150 ${
              activeView === 'calendar'
                ? 'bg-indigo-50 dark:bg-blue-600/20 border border-indigo-200 dark:border-blue-500/40 text-indigo-600 dark:text-blue-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
            title="Calendar View"
          >
            <Calendar className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveView('pomodoro')}
            className={`p-2.5 rounded-xl w-full flex justify-center active:scale-95 transition-all duration-150 ${
              activeView === 'pomodoro'
                ? 'bg-indigo-50 dark:bg-blue-600/20 border border-indigo-200 dark:border-blue-500/40 text-indigo-600 dark:text-blue-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
            title="Focus Sessions"
          >
            <Timer className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveView('eisenhower')}
            className={`p-2.5 rounded-xl w-full flex justify-center active:scale-95 transition-all duration-150 ${
              activeView === 'eisenhower'
                ? 'bg-indigo-50 dark:bg-blue-600/20 border border-indigo-200 dark:border-blue-500/40 text-indigo-600 dark:text-blue-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
            title="Goals & Matrix"
          >
            <Target className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveView('timeline')}
            className={`p-2.5 rounded-xl w-full flex justify-center active:scale-95 transition-all duration-150 ${
              activeView === 'timeline'
                ? 'bg-indigo-50 dark:bg-blue-600/20 border border-indigo-200 dark:border-blue-500/40 text-indigo-600 dark:text-blue-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
            title="Analytics"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveView('habits')}
            className={`p-2.5 rounded-xl w-full flex justify-center active:scale-95 transition-all duration-150 ${
              activeView === 'habits'
                ? 'bg-indigo-50 dark:bg-blue-600/20 border border-indigo-200 dark:border-blue-500/40 text-indigo-600 dark:text-blue-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
            title="Achievements"
          >
            <Trophy className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Rail Utility Icons */}
        <div className="flex flex-col items-center space-y-3 w-full px-2">
          <button
            onClick={() => setActiveView('settings')}
            className={`p-2.5 rounded-xl w-full flex justify-center active:scale-95 transition-all duration-150 ${
              activeView === 'settings'
                ? 'bg-indigo-50 dark:bg-blue-600/20 border border-indigo-200 dark:border-blue-500/40 text-indigo-600 dark:text-blue-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={toggleTheme}
            className="p-2.5 w-full flex justify-center text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] active:scale-95 transition-all duration-150 rounded-xl"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="w-full h-px bg-slate-200/80 dark:bg-white/[0.06] my-1" />

          {/* Left Panel Collapse Toggle Button (<- / ->) */}
          <button
            onClick={toggleLeftSidebar}
            className="p-2.5 w-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-purple-600/20 active:scale-95 transition-all duration-150 rounded-xl border border-white/[0.06] hover:border-purple-500/40"
            title={isLeftSidebarCollapsed ? 'Expand Sidebar (->)' : 'Collapse Sidebar (<-)'}
          >
            {isLeftSidebarCollapsed ? <ChevronRight className="w-4 h-4 text-purple-400" /> : <ChevronLeft className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* 2. Secondary Sidebar Drawer */}
      <div className={`h-full flex flex-col justify-between overflow-y-auto space-y-5 transition-all duration-300 bg-[#F8FAF8] dark:bg-[#0C0C12] border-r border-slate-200/80 dark:border-white/[0.06] ${
        isLeftSidebarCollapsed ? 'w-0 p-0 opacity-0 pointer-events-none' : 'w-56 p-3.5 opacity-100'
      }`}>
        <div className="space-y-5">
          {/* Smart Views with Real Counts */}
          <div className="space-y-1">
            <button
              onClick={() => setActiveView('today')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium active:scale-95 transition-all duration-150 ${
                activeView === 'today'
                  ? 'bg-purple-100/70 dark:bg-white/[0.06] text-purple-700 dark:text-white border border-purple-200/80 dark:border-white/[0.08]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sun className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Today</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{todayCount}</span>
            </button>

            <button
              onClick={() => setActiveView('tomorrow')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium active:scale-95 transition-all duration-150 ${
                activeView === 'tomorrow'
                  ? 'bg-purple-100/70 dark:bg-white/[0.06] text-purple-700 dark:text-white border border-purple-200/80 dark:border-white/[0.08]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Moon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <span>Tomorrow</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{tomorrowCount}</span>
            </button>

            <button
              onClick={() => setActiveView('next7')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium active:scale-95 transition-all duration-150 ${
                activeView === 'next7'
                  ? 'bg-purple-100/70 dark:bg-white/[0.06] text-purple-700 dark:text-white border border-purple-200/80 dark:border-white/[0.08]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CalendarDays className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                <span>Upcoming</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{upcomingCount}</span>
            </button>

            <button
              onClick={() => setActiveView('inbox')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium active:scale-95 transition-all duration-150 ${
                activeView === 'inbox'
                  ? 'bg-purple-100/70 dark:bg-white/[0.06] text-purple-700 dark:text-white border border-purple-200/80 dark:border-white/[0.08]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Inbox className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span>Inbox</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{inboxCount}</span>
            </button>
          </div>

          {/* MY LISTS with Real Counts */}
          <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-white/[0.06]">
            <div className="flex items-center justify-between px-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>My Lists</span>
              <button
                onClick={() => setIsAddingList(!isAddingList)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {isAddingList && (
              <form onSubmit={handleAddList} className="px-2 py-1">
                <input
                  autoFocus
                  type="text"
                  placeholder="New list name..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </form>
            )}

            <div className="space-y-0.5">
              {displayLists.map((l) => {
                const realCount = getListCount(l.id, l.name);
                return (
                  <button
                    key={l.id}
                    onClick={() => setActiveView('list', l.id)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium active:scale-95 transition-all duration-150 ${
                      activeListId === l.id
                        ? 'bg-slate-200/60 dark:bg-white/[0.06] text-slate-900 dark:text-white border border-slate-300/60 dark:border-white/[0.08]'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${l.color || 'bg-purple-500'}`} />
                      <span>{l.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{realCount}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAGS with Real Counts */}
          <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-white/[0.06]">
            <div className="flex items-center justify-between px-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>Tags</span>
              <button
                onClick={() => setIsAddingTag(!isAddingTag)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {isAddingTag && (
              <form onSubmit={handleAddTag} className="px-2 py-1">
                <input
                  autoFocus
                  type="text"
                  placeholder="New tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </form>
            )}

            <div className="space-y-0.5">
              {displayTags.map((t) => {
                const realCount = getTagCount(t.id, t.name);
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveView('tags', undefined, t.id)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium active:scale-95 transition-all duration-150 ${
                      activeTagId === t.id
                        ? 'bg-slate-200/60 dark:bg-white/[0.06] text-slate-900 dark:text-white border border-slate-300/60 dark:border-white/[0.08]'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <TagIcon className={`w-3.5 h-3.5 ${t.color || 'text-purple-400'}`} />
                      <span>{t.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{realCount}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Options: Completed & Trash with Real Counts */}
        <div className="space-y-1 pt-3 border-t border-slate-200/80 dark:border-white/[0.06]">
          <button
            onClick={() => setActiveView('completed')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium active:scale-95 transition-all duration-150 ${
              activeView === 'completed'
                ? 'bg-slate-200/60 dark:bg-white/[0.06] text-slate-900 dark:text-white border border-slate-300/60 dark:border-white/[0.08]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span>Completed</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{completedCount}</span>
          </button>

          <button
            onClick={() => setActiveView('trash')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium active:scale-95 transition-all duration-150 ${
              activeView === 'trash'
                ? 'bg-slate-200/60 dark:bg-white/[0.06] text-slate-900 dark:text-white border border-slate-300/60 dark:border-white/[0.08]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Trash2 className="w-4 h-4 text-slate-500" />
              <span>Trash</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{trashCount}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
