'use client';

import React from 'react';
import { Search, SlidersHorizontal, Plus, ChevronDown, Inbox, Sun, Moon, Calendar, Grid, Kanban, BarChart3, Trophy, Settings, Trash2, CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';

export const TopBar: React.FC = () => {
  const {
    activeView,
    lists,
    activeListId,
    searchQuery,
    setSearchQuery,
    openOmniModal,
    isLeftSidebarCollapsed,
    toggleLeftSidebar,
    isRightPanelCollapsed,
    toggleRightPanel,
  } = useTaskStore();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const getTitleInfo = () => {
    switch (activeView) {
      case 'inbox':
        return { icon: <Inbox className="w-4 h-4 text-blue-400" />, title: 'Inbox' };
      case 'today':
        return { icon: <Sun className="w-4 h-4 text-amber-400" />, title: 'Today' };
      case 'tomorrow':
        return { icon: <Moon className="w-4 h-4 text-orange-400" />, title: 'Tomorrow' };
      case 'next7':
        return { icon: <Calendar className="w-4 h-4 text-purple-400" />, title: 'Upcoming' };
      case 'list': {
        const found = lists.find((l) => l.id === activeListId);
        return { icon: <Inbox className="w-4 h-4 text-blue-400" />, title: found ? found.name : 'List' };
      }
      case 'calendar':
        return { icon: <Calendar className="w-4 h-4 text-blue-400" />, title: 'Calendar' };
      case 'eisenhower':
        return { icon: <Grid className="w-4 h-4 text-purple-400" />, title: 'Eisenhower Matrix' };
      case 'kanban':
        return { icon: <Kanban className="w-4 h-4 text-emerald-400" />, title: 'Kanban Board' };
      case 'timeline':
        return { icon: <BarChart3 className="w-4 h-4 text-indigo-400" />, title: 'Productivity Analytics' };
      case 'habits':
        return { icon: <Trophy className="w-4 h-4 text-amber-400" />, title: 'Habits & Streaks' };
      case 'pomodoro':
        return { icon: <Sun className="w-4 h-4 text-red-400" />, title: 'Focus Sessions' };
      case 'settings':
        return { icon: <Settings className="w-4 h-4 text-slate-400" />, title: 'Settings' };
      case 'trash':
        return { icon: <Trash2 className="w-4 h-4 text-red-400" />, title: 'Trash' };
      case 'completed':
        return { icon: <CheckSquare className="w-4 h-4 text-emerald-400" />, title: 'Completed' };
      default:
        return { icon: <Inbox className="w-4 h-4 text-blue-400" />, title: 'Tasks' };
    }
  };

  const info = getTitleInfo();

  return (
    <header className="h-14 border-b border-slate-200/80 dark:border-white/[0.06] bg-white/80 dark:bg-[#09090B]/80 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-20 text-slate-900 dark:text-[#F8FAFC] select-none font-sans">
      {/* 1. View Title & Left Sidebar Toggle Button (<- / ->) */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={toggleLeftSidebar}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition active:scale-95 mr-1"
          title={isLeftSidebarCollapsed ? 'Expand Left Sidebar (->)' : 'Collapse Left Sidebar (<-)'}
        >
          {isLeftSidebarCollapsed ? <ChevronRight className="w-4 h-4 text-indigo-600 dark:text-purple-400" /> : <ChevronLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
        </button>
        {info.icon}
        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{info.title}</h2>
      </div>

      {/* 2. Center Search & Actions */}
      <div className="flex items-center gap-3 relative">
        {/* Search Bar */}
        <div className="relative group flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Search tasks, notes, projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-12 py-1.5 text-xs bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] rounded-xl w-64 focus:w-80 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-purple-500/60 transition-all duration-200"
          />
          <div className="absolute right-2.5 flex items-center gap-0.5 opacity-60 group-focus-within:opacity-0 transition-opacity pointer-events-none">
            <kbd className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-white/[0.06] px-1.5 py-0.5 rounded border border-slate-300 dark:border-white/[0.08]">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Filter / Sort Toggle Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] active:scale-95 transition-all duration-150"
          title="Filter & Sort"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* Top Right Glowing + New Task Button */}
        <button
          onClick={() => openOmniModal()}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all duration-150 shadow-md shadow-indigo-500/20"
          title="Add New Task (N)"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
          <ChevronDown className="w-3.5 h-3.5 text-white/80 ml-0.5" />
        </button>

        {/* Right Panel Collapse Toggle Button (-> / <-) */}
        <button
          onClick={toggleRightPanel}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] active:scale-95 transition-all duration-150"
          title={isRightPanelCollapsed ? 'Expand Right Panel (<-)' : 'Collapse Right Panel (->)'}
        >
          {isRightPanelCollapsed ? <ChevronLeft className="w-4 h-4 text-indigo-600 dark:text-purple-400" /> : <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
        </button>

        {/* Dropdown Options Popup */}
        {menuOpen && (
          <div className="absolute right-0 top-12 w-56 bg-[#16161E] border border-white/[0.1] shadow-2xl rounded-2xl p-2 z-50 text-xs space-y-1">
            <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              View Layouts
            </div>
            <button
              onClick={() => { useTaskStore.getState().setActiveView('inbox'); setMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/[0.06] text-slate-200 active:scale-95 transition-all duration-150 font-medium"
            >
              <span>☰ List View</span>
            </button>
            <button
              onClick={() => { useTaskStore.getState().setActiveView('kanban'); setMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/[0.06] text-slate-200 active:scale-95 transition-all duration-150 font-medium"
            >
              <span>📋 Kanban Board</span>
            </button>
            <button
              onClick={() => { useTaskStore.getState().setActiveView('timeline'); setMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/[0.06] text-slate-200 active:scale-95 transition-all duration-150 font-medium"
            >
              <span>📊 Timeline View</span>
            </button>
            <div className="border-t border-white/[0.08] my-1" />
            <button
              onClick={() => {
                const store = useTaskStore.getState();
                store.setHideCompleted(!store.hideCompleted);
                setMenuOpen(false);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-white/[0.06] text-slate-200 active:scale-95 transition-all duration-150 font-medium"
            >
              <span>Hide Completed Tasks</span>
              {useTaskStore.getState().hideCompleted && <span className="text-purple-400">✓</span>}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
