'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, CheckCircle, Clock, Maximize, Minimize, Volume2 } from 'lucide-react';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { useTaskStore } from '../../store/useTaskStore';

export const PomodoroView: React.FC = () => {
  const {
    mode,
    timeLeft,
    isRunning,
    activeTaskId,
    history,
    totalWorkMins,
    totalSessions,
    setMode,
    setActiveTaskId,
    startTimer,
    pauseTimer,
    resetTimer,
    tick,
    fetchStats,
    setTimeLeft,
  } = usePomodoroStore();

  const { tasks } = useTaskStore();

  const [zenMode, setZenMode] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editMinutes, setEditMinutes] = useState('');
  
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (isRunning) {
          pauseTimer();
        } else {
          startTimer();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, pauseTimer, startTimer]);

  useEffect(() => {
    let interval: any = null;
    if (isRunning) {
      interval = setInterval(() => {
        tick();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, tick]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-[#F4F5F8] dark:bg-[#121217] text-slate-900 dark:text-slate-100 select-none overflow-hidden">
      {zenMode && (
        <div className="fixed inset-0 z-50 bg-[#09090b] flex flex-col items-center justify-center space-y-12 select-none">
          <button 
            onClick={() => setZenMode(false)} 
            className="absolute top-8 right-8 p-3 text-slate-500 dark:text-slate-400 hover:text-white bg-[#282828] hover:bg-[#333] rounded-full transition-colors"
          >
            <Minimize className="w-6 h-6" />
          </button>
          <div className="text-sm text-slate-500 tracking-[0.2em] uppercase font-medium">Zen Mode</div>
          <div className="text-[12rem] md:text-[15rem] leading-none font-extrabold tracking-tight font-sans text-slate-900 dark:text-slate-100 drop-shadow-2xl">
            {formatTime(timeLeft)}
          </div>
          <div className="text-slate-500 text-lg flex items-center gap-2">
            Press <kbd className="px-2 py-1 bg-[#222] border border-[#333] rounded text-sm font-mono text-slate-700 dark:text-slate-300 shadow">Space</kbd> to {isRunning ? 'Pause' : 'Start'}
          </div>
        </div>
      )}

      {/* Left Workspace: Main Timer */}
      <div className="relative flex-1 flex flex-col justify-between items-center p-8 border-r border-slate-200/80 dark:border-white/[0.06]">
        <button
          onClick={() => setZenMode(true)}
          className="absolute top-6 right-6 p-2 text-slate-500 dark:text-slate-400 hover:text-white bg-[#282828] hover:bg-[#333] rounded-full transition-colors shadow"
          title="Zen Mode"
        >
          <Maximize className="w-5 h-5" />
        </button>

        {/* Header Pomo / Stopwatch Pill */}
        <div className="flex items-center gap-1 bg-white dark:bg-[#161622] p-1 rounded-full border border-slate-200/80 dark:border-white/[0.06]">
          <button
            onClick={() => setMode('WORK')}
            className={`px-5 py-1.5 rounded-full text-xs font-semibold transition ${
              mode === 'WORK' ? 'bg-[#383838] text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'
            }`}
          >
            Pomo
          </button>
          <button
            onClick={() => setMode('SHORT_BREAK')}
            className={`px-5 py-1.5 rounded-full text-xs font-semibold transition ${
              mode === 'SHORT_BREAK' ? 'bg-[#383838] text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'
            }`}
          >
            Stopwatch
          </button>
        </div>

        {/* Circular Timer Display */}
        <div className="flex flex-col items-center justify-center space-y-8 my-auto relative">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium cursor-pointer hover:text-slate-800 dark:text-slate-200 flex items-center gap-1">
            Focus &gt;
          </div>

          <div
            onClick={() => {
              if (!isRunning) {
                setIsEditingTime(true);
                setEditMinutes(String(Math.round(timeLeft / 60)));
              }
            }}
            className="w-72 h-72 rounded-full border-4 border-slate-200/80 dark:border-white/[0.06] hover:border-blue-500/50 flex flex-col items-center justify-center bg-[#1a1a1a]/50 shadow-inner cursor-pointer group transition-all"
            title="Click to adjust duration"
          >
            {isEditingTime ? (
              <input
                autoFocus
                type="number"
                min="1"
                max="180"
                value={editMinutes}
                onChange={(e) => setEditMinutes(e.target.value)}
                onBlur={() => {
                  const mins = parseInt(editMinutes, 10);
                  if (!isNaN(mins) && mins > 0) setTimeLeft(mins * 60);
                  setIsEditingTime(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const mins = parseInt(editMinutes, 10);
                    if (!isNaN(mins) && mins > 0) setTimeLeft(mins * 60);
                    setIsEditingTime(false);
                  }
                  if (e.key === 'Escape') {
                    setIsEditingTime(false);
                  }
                }}
                className="bg-transparent text-5xl font-extrabold text-center text-white w-24 focus:outline-none"
              />
            ) : (
              <span className="text-5xl font-extrabold tracking-tight font-sans text-slate-900 dark:text-slate-100 group-hover:scale-105 transition-transform">
                {formatTime(timeLeft)}
              </span>
            )}
            {!isEditingTime && (
              <span className="text-[10px] font-semibold text-slate-500 group-hover:text-blue-400 mt-2 transition-colors">
                ✏️ Click to change duration
              </span>
            )}
          </div>

          {/* Quick Duration Presets */}
          <div className="flex items-center gap-2">
            {[15, 25, 45, 60, 90].map((mins) => (
              <button
                key={mins}
                onClick={() => setTimeLeft(mins * 60)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition active:scale-95 ${
                  Math.round(timeLeft / 60) === mins
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-[#161622] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:bg-[#191922]'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={isRunning ? pauseTimer : startTimer}
              className="px-10 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg transition transform active:scale-95"
            >
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={resetTimer}
              className="p-3 rounded-full bg-white dark:bg-[#161622] hover:bg-slate-50 dark:bg-[#191922] text-slate-700 dark:text-slate-300 transition"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task Selector Dropdown at bottom of Left Pane */}
        <div className="w-full max-w-xs">
          <select
            value={activeTaskId || ''}
            onChange={(e) => setActiveTaskId(e.target.value || null)}
            className="w-full text-xs bg-white dark:bg-[#161622] border border-slate-200/80 dark:border-white/[0.06] rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">(No Task Selected)</option>
            {tasks
              .filter((t) => t.status !== 'COMPLETED')
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Right Workspace: Overview & Stats */}
      <div className="w-full md:w-80 h-full bg-white dark:bg-[#161622] p-6 flex flex-col space-y-6 overflow-y-auto shrink-0">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Overview</h2>

        {/* 4 Stat Boxes Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 dark:bg-[#191922] p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.06]">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Today's Pomo</div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalSessions}</div>
          </div>

          <div className="bg-slate-50 dark:bg-[#191922] p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.06]">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Today's Focus</div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalWorkMins}m</div>
          </div>

          <div className="bg-slate-50 dark:bg-[#191922] p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.06]">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Total Pomo</div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalSessions}</div>
          </div>

          <div className="bg-slate-50 dark:bg-[#191922] p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.06]">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Total Focus Duration</div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalWorkMins}m</div>
          </div>
        </div>

 

        {/* Focus Record Empty State */}
        <div className="pt-4 flex-1 flex flex-col justify-center items-center text-center space-y-3 min-h-[120px]">
          <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#191922] flex items-center justify-center text-slate-500">
            <Clock className="w-8 h-8" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">No focus record yet</p>
        </div>
      </div>
    </div>
  );
};
