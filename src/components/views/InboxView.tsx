'use client';

import React, { useState } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import {
  Tag,
  Flag,
  Calendar,
  Send,
  SlidersHorizontal,
  Plus,
  Sparkles,
  Inbox as InboxIcon,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  Zap,
} from 'lucide-react';

export const InboxView: React.FC = () => {
  const {
    tasks,
    activeView,
    activeListId,
    activeTagId,
    searchQuery,
    createTask,
    toggleTask,
    updateTask,
    deleteTask,
    setSelectedTaskId,
    selectedTaskId,
    openOmniModal,
  } = useTaskStore();

  const [inputTitle, setInputTitle] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'tasks' | 'notes' | 'reminders'>('all');
  const [sortBy, setSortBy] = useState('Date Created');

  const filterTasks = () => {
    return tasks.filter((task) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !task.notes?.toLowerCase().includes(q)) return false;
      }
      if (activeView === 'inbox') return !task.listId || task.list?.name === 'Inbox';
      if (activeView === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        return task.dueDate?.startsWith(todayStr) || task.createdAt?.startsWith(todayStr);
      }
      if (activeView === 'next7') {
        return !!task.dueDate;
      }
      if (activeView === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        return task.dueDate?.startsWith(tomorrowStr);
      }
      if (activeView === 'completed') return task.status === 'COMPLETED';
      if (activeView === 'list' && activeListId) return task.listId === activeListId;
      if (activeView === 'tags' && activeTagId) return task.tags?.some((t) => t.tag.id === activeTagId);
      return true;
    });
  };

  const filteredTasks = filterTasks();
  const todoTasks = activeView === 'completed' 
    ? filteredTasks.filter((t) => t.status === 'COMPLETED')
    : filteredTasks.filter((t) => t.status !== 'COMPLETED');
  const completedTasks = filteredTasks.filter((t) => t.status === 'COMPLETED');
  
  const notesCount = todoTasks.filter((t) => t.notes && t.notes.trim().length > 0).length;
  const remindersCount = todoTasks.filter((t) => !!t.dueDate).length;

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputTitle.trim()) {
      createTask(inputTitle.trim());
      setInputTitle('');
    }
  };

  return (
    <div className="flex-1 h-full bg-[#F4F5F8] dark:bg-[#121217] text-slate-900 dark:text-slate-100 p-6 overflow-y-auto select-none font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Filter Pills & Sort Bar */}

        {/* 2. Filter Pills & Sort Bar */}
        <div className="flex items-center justify-between pt-1">
          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterType === 'all'
                  ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-500/20'
                  : 'bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08]'
              }`}
            >
              <span>All</span>
              <span className="text-[10px] font-mono opacity-80">{todoTasks.length}</span>
            </button>

            <button
              onClick={() => setFilterType('tasks')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterType === 'tasks'
                  ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-500/20'
                  : 'bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tasks</span>
              <span className="text-[10px] font-mono opacity-80">{todoTasks.length}</span>
            </button>

            <button
              onClick={() => setFilterType('notes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterType === 'notes'
                  ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-500/20'
                  : 'bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Notes</span>
              <span className="text-[10px] font-mono opacity-80">{notesCount}</span>
            </button>

            <button
              onClick={() => setFilterType('reminders')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterType === 'reminders'
                  ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-500/20'
                  : 'bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Reminders</span>
              <span className="text-[10px] font-mono opacity-80">{remindersCount}</span>
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span className="text-slate-500 font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="Date Created" className="bg-white dark:bg-[#16161E] text-slate-800 dark:text-slate-200">Date Created ⌄</option>
              <option value="Due Date" className="bg-white dark:bg-[#16161E] text-slate-800 dark:text-slate-200">Due Date</option>
              <option value="Priority" className="bg-white dark:bg-[#16161E] text-slate-800 dark:text-slate-200">Priority</option>
              <option value="Alphabetical" className="bg-white dark:bg-[#16161E] text-slate-800 dark:text-slate-200">Alphabetical</option>
            </select>
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ml-1" />
          </div>
        </div>

        {/* 3. Task List OR Serene Sunset Clear Inbox Card */}
        {todoTasks.length > 0 ? (
          <div className="space-y-2 pt-2">
            {todoTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTaskId(t.id)}
                className={`flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#191922] border transition-all duration-150 cursor-pointer ${
                  selectedTaskId === t.id
                    ? 'border-indigo-500/60 bg-indigo-50/60 dark:bg-purple-500/10 shadow-md shadow-indigo-500/10'
                    : 'border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12] hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTask(t.id);
                    }}
                    className="w-5 h-5 rounded-lg border border-slate-400 dark:border-slate-500 hover:border-indigo-500 flex items-center justify-center transition active:scale-95"
                  >
                    {t.status === 'COMPLETED' && <span className="text-indigo-600 dark:text-purple-400 font-bold text-xs">✓</span>}
                  </button>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  {t.priority && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                      t.priority === 'P1' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
                      t.priority === 'P2' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                      t.priority === 'P3' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                      'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                    }`}>
                      {t.priority}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Serene Sunset Clear Inbox Card */
          <div 
            className="relative rounded-3xl overflow-hidden border border-slate-200/80 dark:border-white/[0.12] p-12 text-center flex flex-col items-center justify-center shadow-xl space-y-4 my-2 bg-cover bg-center min-h-[340px] bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.45),rgba(240,243,250,0.7)),url('/inbox-clear-bg.jpg')] dark:bg-[image:linear-gradient(to_bottom,rgba(10,10,18,0.1),rgba(10,10,18,0.45)),url('/inbox-clear-bg.jpg')]"
          >
            {/* Glowing Sunset Horizon Graphic */}
            <div className="relative w-32 h-32 flex items-center justify-center my-2">
              <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-3xl" />
              {/* Paper Tray in Sunset horizon */}
              <div className="relative w-24 h-24 bg-white/90 dark:bg-[#181928]/80 border border-slate-200/80 dark:border-white/20 rounded-3xl flex items-center justify-center shadow-lg backdrop-blur-xl">
                <InboxIcon className="w-12 h-12 text-indigo-600 dark:text-purple-200 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
                <Sparkles className="w-5 h-5 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1.5 max-w-md relative z-10">
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-serif drop-shadow-sm">Your inbox is clear</h3>
              <p className="text-xs text-slate-600 dark:text-slate-200 font-medium drop-shadow leading-relaxed">
                Capture tasks, ideas, notes, and reminders.<br />Everything you add will appear here.
              </p>
            </div>

            {/* Glowing Primary Action Button */}
            <button
              onClick={() => openOmniModal()}
              className="mt-2 flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-indigo-500/30 relative z-10"
            >
              <Plus className="w-4 h-4" />
              <span>Capture something</span>
              <kbd className="ml-1 font-mono text-[10px] bg-black/30 px-1.5 py-0.5 rounded text-white/90">N</kbd>
            </button>

            {/* Footnote Tip */}
            <p className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 pt-2 relative z-10">
              <span>💡 Tip: Press <kbd className="px-1.5 py-0.5 bg-black/40 rounded font-mono text-slate-200 border border-white/20">N</kbd> anywhere to quickly capture a task</span>
            </p>
          </div>
        )}

        {/* 4. Recent Captures Section (100% Real Dynamic Store Data Only) */}
        <div className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300 tracking-tight">Recent captures</h4>
            <button
              onClick={() => useTaskStore.getState().setActiveView('inbox')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium hover:underline transition"
            >
              View all
            </button>
          </div>

          <div className="space-y-2">
            {tasks.length > 0 ? (
              [...tasks].reverse().slice(0, 5).map((item: any) => {
                const listName = item.list?.name || 'Inbox';
                const isWork = listName.toLowerCase().includes('work');
                const tagBg = isWork ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
                
                // Dynamic relative time string calculation
                let relativeTime = 'Just now';
                if (item.createdAt) {
                  const diffMins = Math.max(1, Math.floor((Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60)));
                  if (diffMins < 60) relativeTime = `${diffMins}m ago`;
                  else if (diffMins < 1440) relativeTime = `${Math.floor(diffMins / 60)}h ago`;
                  else relativeTime = `${Math.floor(diffMins / 1440)}d ago`;
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedTaskId(item.id)}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#161622]/80 hover:bg-slate-50 dark:hover:bg-[#1C1C2B] border border-slate-200/80 dark:border-white/[0.05] hover:border-slate-300 dark:hover:border-white/[0.1] transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTask(item.id);
                        }}
                        className="w-4 h-4 rounded border border-slate-500 group-hover:border-purple-400 flex items-center justify-center transition"
                      >
                        {item.status === 'COMPLETED' && <span className="text-purple-400 font-bold text-[10px]">✓</span>}
                      </button>
                      <span className={`text-xs font-medium transition ${item.status === 'COMPLETED' ? 'line-through text-slate-500' : 'text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                        {item.title}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${tagBg}`}>
                        {listName}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">{relativeTime}</span>
                  </div>
                );
              })
            ) : (
              <div className="p-4 rounded-2xl bg-white dark:bg-[#161622]/40 border border-slate-200/80 dark:border-white/[0.04] text-center text-xs text-slate-500 font-medium">
                No recent captures yet. Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.06] rounded font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]">N</kbd> to capture your first task.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

