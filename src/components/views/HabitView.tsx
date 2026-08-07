'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Plus, MoreHorizontal, Check, Zap, Flame, Trash2, LayoutGrid, X } from 'lucide-react';
import { format, subDays, eachDayOfInterval, isToday } from 'date-fns';
import { useHabitStore } from '../../store/useHabitStore';

const getHabitEmoji = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('water') || t.includes('drink') || t.includes('hydrat')) return '💧';
  if (t.includes('read') || t.includes('book') || t.includes('study') || t.includes('learn')) return '📖';
  if (t.includes('exercise') || t.includes('workout') || t.includes('gym') || t.includes('run') || t.includes('jog') || t.includes('walk')) return '🏃';
  if (t.includes('meditat') || t.includes('mindful') || t.includes('zen') || t.includes('breathe')) return '🧘';
  if (t.includes('code') || t.includes('program') || t.includes('dev') || t.includes('build')) return '💻';
  if (t.includes('food') || t.includes('eat') || t.includes('diet') || t.includes('salad') || t.includes('meal')) return '🥗';
  if (t.includes('sleep') || t.includes('bed') || t.includes('rest') || t.includes('nap')) return '😴';
  if (t.includes('money') || t.includes('save') || t.includes('budget') || t.includes('finance') || t.includes('invest')) return '💰';
  if (t.includes('music') || t.includes('guitar') || t.includes('piano') || t.includes('sing')) return '🎵';
  if (t.includes('clean') || t.includes('tidy') || t.includes('organize')) return '🧹';
  return '⭐';
};

export const HabitView: React.FC = () => {
  const { habits, fetchHabits, createHabit, toggleCheckin, deleteHabit } = useHabitStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  
  const [viewMode, setViewMode] = useState<'7day' | 'grid'>('7day');
  const [showOptions, setShowOptions] = useState(false);
  const [reminderTime, setReminderTime] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('habit-reminder-time') || '';
    }
    return '';
  });
  const [archivedHabits, setArchivedHabits] = useState(false);
  
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build 7-day window (Mon-Sun of current week, or last 7 days)
  const today = new Date();
  const past7Days = eachDayOfInterval({ start: subDays(today, 6), end: today });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      createHabit(newTitle.trim(), undefined, undefined, newColor);
      setNewTitle('');
      setIsAdding(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F4F5F8] dark:bg-[#121217] text-slate-900 dark:text-slate-100 overflow-hidden transition-colors">
      {/* Top Action Bar */}
      <div className="flex items-center justify-end gap-2 px-6 py-3 border-b border-slate-200 dark:border-[#252525]">
        <button
          onClick={() => setViewMode(viewMode === '7day' ? 'grid' : '7day')}
          className={`p-2 rounded-lg transition-transform active:scale-95 ${viewMode === 'grid' ? 'bg-slate-200 dark:bg-[#252525] text-blue-500' : 'hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-800 dark:text-slate-200'}`}
          title="Toggle Grid View"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setIsAdding(true); setNewTitle(''); }}
          className="p-2 rounded-lg transition-transform active:scale-95 hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-800 dark:text-slate-200"
          title="Add Habit"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="relative" ref={optionsRef}>
          <button 
            onClick={() => setShowOptions(!showOptions)}
            className="p-2 rounded-lg transition-transform active:scale-95 hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-800 dark:text-slate-200"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showOptions && (
            <div className="absolute right-0 mt-2 w-48 bg-slate-50 dark:bg-[#191922] border border-slate-200/80 dark:border-white/[0.06] rounded-xl shadow-lg overflow-hidden z-10">
              <button 
                onClick={() => {
                  if (confirm('Are you sure you want to reset all streaks?')) {
                    useHabitStore.setState(s => ({ 
                      habits: s.habits.map(h => ({ ...h, currentStreak: 0, longestStreak: 0 })) 
                    }));
                  }
                  setShowOptions(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors active:bg-slate-200 dark:active:bg-[#444444]"
              >
                Reset Streaks
              </button>
              <button 
                onClick={() => {
                  alert('Archived habits feature coming soon!');
                  setShowOptions(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors active:bg-slate-200 dark:active:bg-[#444444]"
              >
                Archive Habits
              </button>
              <div className="px-4 py-2 text-sm text-slate-700 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors flex items-center justify-between">
                <span>Reminders</span>
                <input 
                  type="time" 
                  value={reminderTime}
                  onChange={(e) => {
                    setReminderTime(e.target.value);
                    localStorage.setItem('habit-reminder-time', e.target.value);
                    alert(`Reminder set for ${e.target.value}`);
                    setShowOptions(false);
                  }}
                  className="bg-transparent border border-slate-300 dark:border-[#444] rounded px-1 text-xs outline-none w-20"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Week Header Strip (only in 7day view) */}
      {viewMode === '7day' && (
        <div className="flex border-b border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-[#161622]">
          <div className="flex-1 min-w-[220px] px-6 py-3 border-r border-slate-200/80 dark:border-white/[0.06]">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Habit</span>
          </div>
          {past7Days.map((day) => {
            const isTodayCol = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className="w-16 shrink-0 flex flex-col items-center justify-center py-3 border-r border-slate-200/80 dark:border-white/[0.06] last:border-r-0"
              >
                <span className={`text-[11px] font-semibold uppercase ${
                  isTodayCol ? 'text-blue-500 dark:text-blue-400' : 'text-slate-500'
                }`}>
                  {format(day, 'EEE')}
                </span>
                <span className={`text-[15px] font-bold mt-0.5 ${
                  isTodayCol ? 'text-blue-500 dark:text-blue-400' : 'text-slate-700 dark:text-slate-700 dark:text-slate-300'
                }`}>
                  {format(day, 'd')}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Habit Form */}
      {isAdding && (
        <div className="border-b border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-[#161622] px-6 py-3">
          <form onSubmit={handleCreate} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-7 h-7 rounded-full border-none cursor-pointer bg-transparent"
              />
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Habit name (e.g. Drink Water, Read 30 mins)..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setIsAdding(false)}
              className="flex-1 bg-[#F4F5F8] dark:bg-[#121217] border border-slate-200/80 dark:border-white/[0.06] rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
            <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-transform active:scale-95">Save</button>
            <button type="button" onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-700 dark:text-slate-300 transition-transform active:scale-95">
              <X className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Habits List */}
      <div className={`flex-1 overflow-y-auto ${viewMode === 'grid' ? 'p-6' : ''}`}>
        {habits.length === 0 && !isAdding ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-600">
            <LayoutGrid className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No habits yet</p>
            <p className="text-xs mt-1">Click + to add your first habit</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : ''}>
            {habits.map((habit) => (
              <div
                key={habit.id}
                className={
                  viewMode === '7day'
                    ? 'flex border-b border-slate-200/80 dark:border-white/[0.06] hover:bg-white dark:bg-[#161622] transition-colors group'
                    : 'bg-slate-50 dark:bg-[#191922] border border-slate-200/80 dark:border-white/[0.06] hover:border-blue-500 transition-colors rounded-2xl p-4 shadow-sm flex flex-col group relative'
                }
              >
                {/* Habit Info */}
                <div className={
                  viewMode === '7day'
                    ? 'flex-1 min-w-[220px] px-6 py-4 border-r border-slate-200/80 dark:border-white/[0.06] flex items-center gap-3'
                    : 'flex items-center gap-3 mb-4'
                }>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: `${habit.color}22`, border: `1.5px solid ${habit.color}44` }}
                  >
                    {getHabitEmoji(habit.title)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[13px] font-semibold text-slate-700 dark:text-slate-800 dark:text-slate-200 truncate uppercase tracking-wide">{habit.title}</h3>
                      <button
                        onClick={() => deleteHabit(habit.id)}
                        className={`p-1 text-slate-500 dark:text-slate-400 hover:text-red-500 transition-transform active:scale-95 ${viewMode === '7day' ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-[11px] text-blue-500 dark:text-blue-400 font-semibold">
                        <Zap className="w-3 h-3" />
                        {habit.completedCount || 0} Days
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-orange-500 dark:text-orange-400 font-semibold">
                        <Flame className="w-3 h-3" />
                        {habit.currentStreak || 0} Days
                      </span>
                    </div>
                  </div>
                </div>

                {/* Check-in Buttons per Day (7day view) */}
                {viewMode === '7day' && past7Days.map((day) => {
                  const dStr = format(day, 'yyyy-MM-dd');
                  const isChecked = habit.logs?.some((l) => l.date === dStr && l.completed);
                  const isTodayCol = isToday(day);

                  return (
                    <div
                      key={dStr}
                      className={`w-16 shrink-0 flex items-center justify-center border-r border-slate-200/80 dark:border-white/[0.06] last:border-r-0 ${
                        isTodayCol ? 'bg-blue-50 dark:bg-blue-500/5' : ''
                      }`}
                    >
                      <button
                        onClick={() => toggleCheckin(habit.id, dStr)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                          isChecked
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 hover:bg-blue-700'
                            : 'bg-transparent border-2 border-slate-200/80 dark:border-white/[0.06] text-slate-600 hover:border-blue-500 hover:text-blue-400'
                        }`}
                      >
                        {isChecked ? (
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-current opacity-20" />
                        )}
                      </button>
                    </div>
                  );
                })}

                {/* Grid view only button (Today checkin) */}
                {viewMode === 'grid' && (
                  <div className="mt-auto flex justify-between items-center border-t border-slate-100 dark:border-[#333333] pt-3">
                    <span className="text-xs text-slate-500">Today</span>
                    <button
                      onClick={() => toggleCheckin(habit.id, format(today, 'yyyy-MM-dd'))}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                        habit.logs?.some((l) => l.date === format(today, 'yyyy-MM-dd') && l.completed)
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                          : 'bg-slate-100 dark:bg-[#333333] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#444444]'
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
