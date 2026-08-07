'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CalendarDays, Plus, MoreHorizontal, Trash2, Pin, X } from 'lucide-react';
import { useCountdownStore } from '../../store/useCountdownStore';

export const CountdownView: React.FC = () => {
  const { countdowns, createCountdown, deleteCountdown, togglePinCountdown } = useCountdownStore();
  const events = countdowns || [];
  const addEvent = createCountdown;
  const deleteEvent = deleteCountdown;
  const togglePin = togglePinCountdown;
  
  const [isAdding, setIsAdding] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'pinned'>('all');
  
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newCategory, setNewCategory] = useState('Birthday');
  const [newColor, setNewColor] = useState('#3b82f6');
  
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calculateDaysLeft = (targetDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDateStr);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays < 0) return `${Math.abs(diffDays)} Days ago`;
    return `${diffDays}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Birthday': return '🎂';
      case 'Launch': return '🚀';
      case 'Exam': return '📝';
      case 'Holiday': return '🏖️';
      default: return '🗓️';
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim() && newDate) {
      addEvent({
        title: newTitle.trim(),
        targetDate: newDate,
        category: newCategory,
        color: newColor,
      });
      setIsAdding(false);
      setNewTitle('');
      setNewDate('');
      setNewCategory('Birthday');
      setNewColor('#3b82f6');
    }
  };

  const filteredEvents = filterMode === 'pinned' ? events.filter(e => e.isPinned) : events;

  return (
    <div className="flex-1 bg-[#F4F5F8] dark:bg-[#121217] text-slate-900 dark:text-slate-100 p-6 flex flex-col space-y-6 select-none overflow-y-auto transition-colors relative">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          <h1 className="text-lg font-bold">Countdown</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAdding(true)}
            className="p-1.5 hover:bg-white dark:bg-[#161622] rounded-lg text-slate-500 dark:text-slate-400 hover:text-white transition-all active:scale-95"
            title="Add Countdown Event"
          >
            <Plus className="w-5 h-5" />
          </button>
          
          <div className="relative" ref={optionsRef}>
            <button 
              onClick={() => setShowOptions(!showOptions)}
              className="p-1.5 hover:bg-white dark:bg-[#161622] rounded-lg text-slate-500 dark:text-slate-400 hover:text-white transition-all active:scale-95"
              title="Options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            
            {showOptions && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-50 dark:bg-[#191922] border border-slate-200/80 dark:border-white/[0.06] rounded-xl shadow-lg overflow-hidden z-20">
                <button 
                  onClick={() => { setFilterMode('all'); setShowOptions(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors active:bg-slate-200 dark:active:bg-[#444444] ${filterMode === 'all' ? 'text-blue-500 font-semibold bg-blue-50 dark:bg-blue-500/10' : 'text-slate-700 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#333333]'}`}
                >
                  All Events
                </button>
                <button 
                  onClick={() => { setFilterMode('pinned'); setShowOptions(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors active:bg-slate-200 dark:active:bg-[#444444] ${filterMode === 'pinned' ? 'text-blue-500 font-semibold bg-blue-50 dark:bg-blue-500/10' : 'text-slate-700 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#333333]'}`}
                >
                  Pinned Events
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {isAdding && (
        <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-slate-50 dark:bg-[#191922] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">New Countdown</h3>
              <button 
                onClick={() => setIsAdding(false)}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-800 dark:text-slate-200 transition-transform active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-500 dark:text-slate-400 mb-1">Event Title</label>
                <input 
                  type="text" 
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#F4F5F8] dark:bg-[#121217] border border-slate-200/80 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="e.g. My Birthday"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-500 dark:text-slate-400 mb-1">Target Date</label>
                  <input 
                    type="date" 
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-[#F4F5F8] dark:bg-[#121217] border border-slate-200/80 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-500 dark:text-slate-400 mb-1">Category</label>
                  <select 
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-[#F4F5F8] dark:bg-[#121217] border border-slate-200/80 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                  >
                    <option value="Birthday">🎂 Birthday</option>
                    <option value="Launch">🚀 Launch</option>
                    <option value="Exam">📝 Exam</option>
                    <option value="Holiday">🏖️ Holiday</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-500 dark:text-slate-400 mb-1">Theme Color</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-8 h-8 rounded-full border-none cursor-pointer bg-transparent"
                  />
                  <span className="text-sm font-mono text-slate-500">{newColor}</span>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#333] rounded-lg transition-transform active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-transform active:scale-95"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid of Countdown Cards */}
      {!filteredEvents || filteredEvents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
          <CalendarDays className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm font-semibold">No countdowns yet</p>
          <p className="text-xs mt-1">Click + to add your first event</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEvents.map((item) => {
            const daysText = calculateDaysLeft(item.targetDate);
            const isToday = daysText === 'Today';

            return (
              <div
                key={item.id}
                className="bg-slate-50 dark:bg-[#191922] border border-slate-200/80 dark:border-white/[0.06] hover:border-blue-500/50 rounded-2xl p-5 flex flex-col space-y-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                style={{ borderTopWidth: '4px', borderTopColor: item.color }}
              >
                {/* Actions overlay */}
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => togglePin(item.id)}
                    className={`p-1.5 rounded-md transition-transform active:scale-95 ${item.isPinned ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#3a3a3a]'}`}
                    title={item.isPinned ? "Unpin" : "Pin"}
                  >
                    <Pin className={`w-3.5 h-3.5 ${item.isPinned ? 'fill-current' : ''}`} />
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm(`Delete countdown "${item.title}"?`)) {
                        deleteEvent(item.id);
                      }
                    }}
                    className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-transform active:scale-95"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-lg bg-white dark:bg-[#161622] w-8 h-8 rounded-lg flex items-center justify-center shadow-sm border border-slate-200/80 dark:border-white/[0.06]">
                    {getCategoryIcon(item.category || '')}
                  </span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-800 dark:text-slate-200 truncate pr-14">{item.title}</span>
                </div>

                <div className={`text-4xl font-extrabold tracking-tight pt-2 ${isToday ? 'text-blue-500 dark:text-blue-400' : 'text-slate-800 dark:text-slate-900 dark:text-slate-100'}`}>
                  {daysText}
                </div>

                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>{isToday ? 'Happening today!' : `Days until ${item.targetDate}`}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200/50 dark:bg-[#333] text-[10px]">{item.category}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
