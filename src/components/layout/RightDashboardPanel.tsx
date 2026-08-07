'use client';

import React from 'react';
import { Calendar, Zap, CheckSquare, FileText, Bell, Flag, ChevronRight, Quote, Command, Keyboard } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { useTaskStore } from '../../store/useTaskStore';
import { getDailyQuote } from '../../lib/quotes';

export const RightDashboardPanel: React.FC = () => {
  const { openOmniModal, tasks, setActiveView, isRightPanelCollapsed, toggleRightPanel } = useTaskStore();
  const dailyQuote = React.useMemo(() => getDailyQuote(), []);

  // Today's plan items (100% Real Tasks from Store)
  const todayTasks = tasks.filter((t) => {
    if (t.status === 'COMPLETED') return false;
    if (!t.dueDate) return false;
    try {
      return isToday(new Date(t.dueDate));
    } catch (e) {
      return false;
    }
  }).slice(0, 5);

  return (
    <aside
      className={`h-full overflow-y-auto flex flex-col gap-4 select-none shrink-0 font-sans text-slate-800 dark:text-slate-200 bg-[#F4F5F8] dark:bg-transparent transition-all duration-300 custom-scrollbar ${
        isRightPanelCollapsed ? 'w-0 p-0 opacity-0 pointer-events-none' : 'w-80 p-4 opacity-100'
      }`}
    >
      {/* Top Header Collapse Bar */}
      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold pb-1 border-b border-slate-200/80 dark:border-white/[0.06]">
        <span>Dashboard Widgets</span>
        <button
          onClick={toggleRightPanel}
          className="p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition"
          title="Collapse Right Panel (->)"
        >
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* 1. Today's Plan Widget */}
      <div className="bg-white dark:bg-[#161622]/90 border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 space-y-3 shadow-sm dark:shadow-xl hover:border-blue-500/30 dark:hover:border-blue-500/30 transition-all duration-200">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white tracking-tight">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Today's plan</span>
          </div>
          <button
            onClick={() => setActiveView('today')}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline transition"
          >
            View full day
          </button>
        </div>

        <div className="space-y-2.5 pt-1">
          {todayTasks.length > 0 ? (
            todayTasks.map((t, idx) => (
              <div
                key={t.id}
                onClick={() => useTaskStore.getState().setSelectedTaskId(t.id)}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.04] transition cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {t.dueDate ? format(new Date(t.dueDate), 'hh:mm a') : 'Today'}
                  </span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${idx % 2 === 0 ? 'bg-blue-400' : 'bg-purple-400'}`} />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white transition">
                    {t.title}
                  </span>
                </div>
                <Flag className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-xs text-slate-500 space-y-1">
              <Calendar className="w-5 h-5 mx-auto text-slate-600 mb-1" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">No tasks scheduled for today</p>
              <p className="text-[10px] text-slate-500">Press N anywhere to add a task</p>
            </div>
          )}
        </div>
      </div>

      {/* 2. Expanded Randomized Daily Quote Card with Serene Lighthouse Sunset Background */}
      <div 
        className="relative overflow-hidden rounded-2xl p-5 border border-purple-300/60 dark:border-purple-500/40 shadow-sm dark:shadow-2xl space-y-3 group min-h-[140px] flex flex-col justify-between bg-cover bg-center bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.45),rgba(240,243,250,0.65)),url('/quote-bg.jpg')] dark:bg-[image:linear-gradient(to_bottom,rgba(14,14,24,0.15),rgba(10,10,18,0.6)),url('/quote-bg.jpg')]"
      >
        <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 relative z-10">
          <Quote className="w-4 h-4" />
          <span className="text-purple-700 dark:text-purple-200 font-bold text-xs uppercase tracking-wider">Daily Mindset</span>
        </div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white italic leading-relaxed font-serif drop-shadow-sm relative z-10 my-1">
          "{dailyQuote}"
        </p>
      </div>

      {/* 4. Shortcuts Card */}
      <div className="bg-white dark:bg-[#161622]/90 border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 space-y-3 shadow-sm dark:shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white tracking-tight">
            <Keyboard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Shortcuts</span>
          </div>
          {/* Decorative Plant SVG */}
          <svg className="w-8 h-8 text-emerald-500/20 dark:text-emerald-400/20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 22V12m0 0C12 7 7 4 2 6c0 5 4 10 10 10zm0-6c0-5 5-8 10-6 0 5-4 10-10 10z" />
          </svg>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <kbd className="font-mono text-[10px] bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-white px-1.5 py-0.5 rounded">N</kbd>
              <span>New task</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <kbd className="font-mono text-[10px] bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-white px-1.5 py-0.5 rounded">T</kbd>
              <span>Today view</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
