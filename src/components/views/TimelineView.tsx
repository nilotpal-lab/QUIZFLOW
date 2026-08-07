'use client';

import React, { useState } from 'react';
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, isWithinInterval } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';

export const TimelineView: React.FC = () => {
  const { tasks, setSelectedTaskId } = useTaskStore();
  const [weekOffset, setWeekOffset] = useState(0);

  const baseDate = addWeeks(new Date(), weekOffset);
  const startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
  const endDate = addDays(startDate, 13); // 14 days total (2 weeks)
  
  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const goPrevWeek = () => setWeekOffset(o => o - 1);
  const goNextWeek = () => setWeekOffset(o => o + 1);
  const goToday = () => setWeekOffset(0);

  return (
    <div className="h-full bg-[#F4F5F8] dark:bg-[#121217] rounded-2xl border border-slate-200/80 dark:border-white/[0.06] shadow-sm overflow-hidden flex flex-col">
      {/* Header Navigation */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-[#161622]">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-blue-500" />
          Timeline ({format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')})
        </h2>
        <div className="flex items-center gap-1 bg-[#F4F5F8] dark:bg-[#121217] p-1 rounded-lg border border-slate-200/80 dark:border-white/[0.06] shadow-sm">
          <button 
            onClick={goPrevWeek}
            className="p-1 rounded hover:bg-white dark:bg-[#161622] text-slate-500 dark:text-slate-500 dark:text-slate-400 transition active:scale-95"
            title="Previous Week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button 
            onClick={goToday}
            className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-200 dark:bg-[#303030] rounded transition active:scale-95"
          >
            Today
          </button>
          <button 
            onClick={goNextWeek}
            className="p-1 rounded hover:bg-white dark:bg-[#161622] text-slate-500 dark:text-slate-500 dark:text-slate-400 transition active:scale-95"
            title="Next Week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Date Axis Header */}
      <div className="flex border-b border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-[#161622] sticky top-0 z-10">
        <div className="w-64 shrink-0 p-3 font-semibold text-xs text-slate-500 dark:text-slate-500 dark:text-slate-400 uppercase tracking-wider border-r border-slate-200/80 dark:border-white/[0.06]">
          Task
        </div>
        <div className="flex-1 grid auto-cols-fr divide-x divide-white/[0.06] text-center text-xs py-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day) => {
            const isToday = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className="px-1 relative flex flex-col items-center">
                <div className={`w-7 h-7 flex items-center justify-center rounded-full font-bold mb-0.5 ${isToday ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-700 dark:text-slate-800 dark:text-slate-200'}`}>
                  {format(day, 'dd')}
                </div>
                <div className={`text-[10px] font-medium ${isToday ? 'text-blue-500' : 'text-slate-500 dark:text-slate-400'}`}>
                  {format(day, 'EEE')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Gantt Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06] bg-[#F4F5F8] dark:bg-[#121217]">
        {tasks.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400 italic">No tasks available for timeline</div>
        ) : (
          tasks.map((task) => {
            // Compute start and end for the task duration
            const taskStart = task.timeStart ? new Date(task.timeStart) : (task.createdAt ? new Date(task.createdAt) : new Date());
            const taskEnd = task.dueDate ? new Date(task.dueDate) : (task.timeEnd ? new Date(task.timeEnd) : taskStart);

            // Normalize time to compare days correctly
            taskStart.setHours(0, 0, 0, 0);
            taskEnd.setHours(23, 59, 59, 999);

            return (
              <div key={task.id} className="flex items-stretch hover:bg-white dark:bg-[#161622] transition group">
                <div
                  onClick={() => setSelectedTaskId(task.id)}
                  className="w-64 shrink-0 p-3 border-r border-slate-200/80 dark:border-white/[0.06] cursor-pointer flex items-center overflow-hidden active:bg-slate-100 dark:active:bg-[#2a2a2a]"
                >
                  <p className={`text-xs font-semibold truncate ${task.status === 'COMPLETED' ? 'line-through text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-800 dark:text-slate-200 group-hover:text-blue-500 dark:group-hover:text-blue-400'}`}>
                    {task.title}
                  </p>
                </div>

                <div className="flex-1 grid auto-cols-fr divide-x divide-white/[0.06] items-center px-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
                  {days.map((day) => {
                    // Check if this day is within the task's start/end duration
                    const isWithinDuration = isWithinInterval(day, { start: taskStart, end: taskEnd });
                    const isDue = task.dueDate ? isSameDay(day, new Date(task.dueDate)) : false;

                    return (
                      <div key={day.toISOString()} className="h-full min-h-[44px] flex items-center justify-center p-1 relative">
                        {isWithinDuration && (
                          <div
                            onClick={() => setSelectedTaskId(task.id)}
                            className={`absolute inset-x-0 mx-0.5 h-6 rounded-md cursor-pointer transition active:scale-[0.98] shadow-sm z-10 flex items-center px-2 text-[10px] font-bold overflow-hidden
                              ${task.status === 'COMPLETED' ? 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30' : 'bg-blue-500 text-white border border-blue-600'}
                            `}
                          >
                            <span className="truncate">{task.title}</span>
                          </div>
                        )}
                        {/* Show small indicator if it's explicitly due on this day but duration isn't showing or to highlight due day */}
                        {!isWithinDuration && isDue && (
                          <div className="w-2 h-2 rounded-full bg-red-500 shadow-sm z-0"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
