'use client';

import React, { useState } from 'react';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfDay,
  getHours,
  getMinutes,
  eachMonthOfInterval,
  startOfYear,
  endOfYear,
  isSameWeek,
  getDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Check } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';

const TASK_COLORS = [
  { bg: 'rgba(106,135,89,0.4)', border: '#6a8759', hex: '#6a8759' },
  { bg: 'rgba(152,118,84,0.4)', border: '#987654', hex: '#987654' },
  { bg: 'rgba(86,116,139,0.4)', border: '#56748b', hex: '#56748b' },
  { bg: 'rgba(139,89,106,0.4)', border: '#8b596a', hex: '#8b596a' },
  { bg: 'rgba(139,126,89,0.4)', border: '#8b7e59', hex: '#8b7e59' },
  { bg: 'rgba(89,106,139,0.4)', border: '#596a8b', hex: '#596a8b' },
  { bg: 'rgba(106,89,139,0.4)', border: '#6a598b', hex: '#6a598b' },
  { bg: 'rgba(89,139,126,0.4)', border: '#598b7e', hex: '#598b7e' },
];

const PASTEL_PALETTE = ['#2a3a4a', '#3a2a2a', '#2a3a2a', '#3a3020', '#2d2540', '#2a3a3a', '#3a2a3a', '#303a2a'];

type CalendarMode = 'Year' | 'Month' | 'Week' | 'Day' | 'Agenda' | 'Multi-Day' | 'Multi-Week';

const DraggableUnscheduledItem = ({ task, updateTask, currentDate }: { task: any, updateTask: any, currentDate: Date }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
  });
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 9999,
  } : undefined;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => updateTask(task.id, { dueDate: currentDate.toISOString() })}
      className="px-2.5 py-1 bg-white dark:bg-[#161622] hover:bg-blue-600 hover:text-white border border-slate-200/80 dark:border-white/[0.06] rounded-lg text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition active:scale-95 group"
    >
      <span>{task.title}</span>
      <span className="text-[10px] text-blue-400 group-hover:text-white font-semibold">+ Schedule</span>
    </button>
  );
};

const MonthDroppableDayCell = ({ day, inMonth, onClick, children }: { day: Date, inMonth: boolean, onClick: () => void, children: React.ReactNode }) => {
  const { isOver, setNodeRef } = useDroppable({ id: format(day, 'yyyy-MM-dd') });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`p-1.5 bg-[#F4F5F8] dark:bg-[#121217] border flex flex-col group cursor-pointer hover:bg-white dark:bg-[#161622] transition ${
        !inMonth ? 'opacity-30' : ''
      } ${isOver ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-slate-200/80 dark:border-white/[0.06]'}`}
    >
      {children}
    </div>
  );
};

const TimeGridDroppableDayColumn = ({ day, onClick, children }: { day: Date, onClick: () => void, children: React.ReactNode }) => {
  const { isOver, setNodeRef } = useDroppable({ id: format(day, 'yyyy-MM-dd') });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`flex-1 border-r relative z-10 ${isOver ? 'bg-blue-500/10 border-blue-500' : 'border-slate-200/80 dark:border-white/[0.06]'}`}
    >
      {children}
    </div>
  );
};

export const CalendarView: React.FC = () => {
  const { tasks, setSelectedTaskId, createTask, updateTask } = useTaskStore();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('Month');
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalDate, setCreateModalDate] = useState(new Date());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTimeStart, setNewTaskTimeStart] = useState('');
  const [newTaskTimeEnd, setNewTaskTimeEnd] = useState('');

  const unscheduledTasks = tasks.filter((t) => !t.dueDate && t.status !== 'COMPLETED');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id) {
      updateTask(active.id, { dueDate: new Date(over.id).toISOString() });
    }
  };

  // Helpers
  const getTasksForDay = (day: Date) => {
    return tasks.filter((t) => {
      if (!t.dueDate) return false;
      const taskDate = new Date(t.dueDate);
      if (isSameDay(taskDate, day)) return true;

      // Handle Recurrence Projections
      if (t.recurrence && t.recurrence !== 'NONE' && day >= taskDate) {
        if (t.recurrence === 'DAILY') return true;
        if (t.recurrence === 'WEEKLY' && day.getDay() === taskDate.getDay()) return true;
        if (t.recurrence === 'MONTHLY' && day.getDate() === taskDate.getDate()) return true;
      }
      return false;
    });
  };

  const getTaskColor = (index: number) => PASTEL_PALETTE[index % PASTEL_PALETTE.length];
  const getTaskBorder = (index: number) => TASK_COLORS[index % TASK_COLORS.length].border;
  const getTaskBlockColor = (index: number) => TASK_COLORS[index % TASK_COLORS.length];

  const handleDayClick = (day: Date) => {
    useTaskStore.getState().openOmniModal();
  };

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) return;
    
    createTask(newTaskTitle.trim(), {
      dueDate: createModalDate.toISOString(),
      timeStart: newTaskTimeStart || undefined,
      timeEnd: newTaskTimeEnd || undefined,
    });
    setShowCreateModal(false);
  };

  // Navigation
  const navigatePrevious = () => {
    if (calendarMode === 'Year') setCurrentDate(subMonths(currentDate, 12));
    else if (calendarMode === 'Month' || calendarMode === 'Multi-Week') setCurrentDate(subMonths(currentDate, 1));
    else if (calendarMode === 'Week') setCurrentDate(subWeeks(currentDate, 1));
    else if (calendarMode === 'Multi-Day') setCurrentDate(subDays(currentDate, 3));
    else if (calendarMode === 'Day' || calendarMode === 'Agenda') setCurrentDate(subDays(currentDate, 1));
  };

  const navigateNext = () => {
    if (calendarMode === 'Year') setCurrentDate(addMonths(currentDate, 12));
    else if (calendarMode === 'Month' || calendarMode === 'Multi-Week') setCurrentDate(addMonths(currentDate, 1));
    else if (calendarMode === 'Week') setCurrentDate(addWeeks(currentDate, 1));
    else if (calendarMode === 'Multi-Day') setCurrentDate(addDays(currentDate, 3));
    else if (calendarMode === 'Day' || calendarMode === 'Agenda') setCurrentDate(addDays(currentDate, 1));
  };

  const navigateToday = () => setCurrentDate(new Date());

  // Render specific views
  const renderYearView = () => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(yearStart);
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

    return (
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {months.map((month) => {
            const mStart = startOfMonth(month);
            const mEnd = endOfMonth(mStart);
            const startDate = startOfWeek(mStart);
            const endDate = endOfWeek(mEnd);
            const days = eachDayOfInterval({ start: startDate, end: endDate });

            return (
              <div 
                key={month.toISOString()} 
                className="bg-white dark:bg-[#161622] border border-slate-200/80 dark:border-white/[0.08] hover:border-purple-500/40 rounded-2xl p-3 flex flex-col justify-between shadow-lg hover:shadow-purple-500/10 transition-all duration-200 cursor-pointer group"
                onClick={() => {
                  setCurrentDate(month);
                  setCalendarMode('Month');
                }}
              >
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-purple-400 transition mb-2 flex items-center justify-between">
                  <span>{format(month, 'MMMM')}</span>
                </div>
                <div className="grid grid-cols-7 text-center text-[10px] font-mono font-semibold text-slate-500 mb-1.5 border-b border-white/[0.04] pb-1">
                  <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                </div>
                <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center">
                  {days.map((day, idx) => {
                    const inMonth = isSameMonth(day, month);
                    const isCurrDay = isToday(day);
                    const dayTasks = getTasksForDay(day);
                    const hasTasks = dayTasks.length > 0;
                    
                    return (
                      <div key={idx} className="flex justify-center items-center py-0.5">
                        <div className={`
                          w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium transition
                          ${!inMonth ? 'opacity-20 text-slate-500' : ''}
                          ${isCurrDay ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-500/40' : ''}
                          ${!isCurrDay && hasTasks ? 'bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30' : ''}
                          ${!isCurrDay && !hasTasks && inMonth ? 'text-slate-700 dark:text-slate-300 hover:bg-white/[0.06]' : ''}
                        `}>
                          {format(day, 'd')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonthGrid = (numWeeks: number = 5) => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    
    let daysToRender: Date[] = [];
    if (numWeeks === 4) {
      // Multi-week view
      const wStart = startOfWeek(currentDate);
      daysToRender = eachDayOfInterval({ start: wStart, end: addDays(wStart, 27) });
    } else {
      const endDate = endOfWeek(monthEnd);
      daysToRender = eachDayOfInterval({ start: startDate, end: endDate });
    }

    return (
      <>
        <div className="grid grid-cols-7 border-b border-slate-200/80 dark:border-white/[0.06] bg-[#F4F5F8] dark:bg-[#121217] text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 py-2">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>
        <div className="grid grid-cols-7 flex-1 auto-rows-fr gap-px bg-white/[0.06]">
          {daysToRender.map((day) => {
            const dayTasks = getTasksForDay(day);
            const inMonth = numWeeks === 4 ? true : isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);

            return (
              <MonthDroppableDayCell
                key={day.toISOString()}
                day={day}
                inMonth={inMonth}
                onClick={() => handleDayClick(day)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                      isCurrentDay ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="space-y-0.5 overflow-y-auto flex-1 custom-scrollbar">
                  {dayTasks.slice(0, 4).map((t, idx) => (
                    <div
                      key={t.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTaskId(t.id);
                      }}
                      style={{ backgroundColor: getTaskColor(idx) }}
                      className="text-[10px] px-1 py-0.5 rounded flex items-center justify-between hover:brightness-110"
                    >
                      <div className="flex items-center gap-1 overflow-hidden">
                        <div className="w-1.5 h-1.5 rounded-full min-w-[6px]" style={{ backgroundColor: getTaskBorder(idx) }} />
                        <span className="truncate text-slate-900 dark:text-slate-100">{t.title}</span>
                      </div>
                      {t.timeStart && (
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 shrink-0 ml-1">{t.timeStart}</span>
                      )}
                    </div>
                  ))}
                  {dayTasks.length > 4 && (
                    <div className="text-[10px] text-slate-500 pl-1 font-medium">
                      +{dayTasks.length - 4} more
                    </div>
                  )}
                </div>
              </MonthDroppableDayCell>
            );
          })}
        </div>
      </>
    );
  };

  const renderTimeGrid = (days: Date[]) => {
    const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 to 22:00
    
    return (
      <div className="flex-1 flex flex-col overflow-y-auto bg-[#F4F5F8] dark:bg-[#121217]">
        <div className="flex border-b border-slate-200/80 dark:border-white/[0.06] sticky top-0 bg-[#F4F5F8] dark:bg-[#121217] z-20">
          <div className="w-12 shrink-0 border-r border-slate-200/80 dark:border-white/[0.06]"></div>
          {days.map((day) => {
            const isCurrDay = isToday(day);
            return (
              <div key={day.toISOString()} className="flex-1 text-center py-2 border-r border-slate-200/80 dark:border-white/[0.06]">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase">{format(day, 'EEE')}</div>
                <div className="flex justify-center mt-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    isCurrDay ? 'bg-blue-600 text-white' : 'text-slate-800 dark:text-slate-200'
                  }`}>
                    {format(day, 'd')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* All day section */}
        <div className="flex border-b border-slate-200/80 dark:border-white/[0.06]">
          <div className="w-12 shrink-0 border-r border-slate-200/80 dark:border-white/[0.06] text-[10px] text-slate-500 flex items-center justify-center py-1">
            All-day
          </div>
          {days.map((day) => {
            const dayTasks = getTasksForDay(day).filter(t => !t.timeStart);
            return (
              <div key={day.toISOString()} className="flex-1 border-r border-slate-200/80 dark:border-white/[0.06] p-1 space-y-1 bg-white dark:bg-[#161622]">
                {dayTasks.map((t, idx) => (
                  <div 
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    style={{ backgroundColor: getTaskColor(idx) }}
                    className="text-[10px] px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200 truncate cursor-pointer"
                  >
                    {t.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Time Grid */}
        <div className="flex relative">
          <div className="w-12 shrink-0 border-r border-slate-200/80 dark:border-white/[0.06] bg-[#F4F5F8] dark:bg-[#121217] relative z-10">
            {hours.map(hour => (
              <div key={hour} className="h-[60px] text-right pr-2 text-[11px] text-slate-500 relative">
                <span className="absolute top-0 right-2 -translate-y-1/2 bg-[#F4F5F8] dark:bg-[#121217] px-1">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>
          <div className="flex-1 flex relative">
            {/* Grid lines */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              {hours.map(hour => (
                <div key={hour} className="h-[60px] border-b border-slate-200/80 dark:border-white/[0.06]" />
              ))}
            </div>
            
            {/* Day columns */}
            {days.map((day, dIdx) => {
              const dayTasks = getTasksForDay(day).filter(t => t.timeStart);
              return (
                <TimeGridDroppableDayColumn
                  key={day.toISOString()}
                  day={day}
                  onClick={() => handleDayClick(day)}
                >
                  {dayTasks.map((t, idx) => {
                    const [h, m] = t.timeStart!.split(':').map(Number);
                    const startMins = h * 60 + m;
                    const baseMins = 6 * 60;
                    if (startMins < baseMins || startMins > 22*60) return null; // out of bounds
                    
                    const top = startMins - baseMins;
                    let dur = 60; // default 1 hour
                    if (t.timeEnd) {
                      const [eh, em] = t.timeEnd.split(':').map(Number);
                      dur = (eh * 60 + em) - startMins;
                    }
                    dur = Math.max(20, dur); // min 20px
                    
                    const color = getTaskBlockColor(idx);
                    
                    return (
                      <div 
                        key={t.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedTaskId(t.id); }}
                        className="absolute w-[calc(100%-8px)] left-1 rounded-lg border border-white/10 p-1.5 flex flex-col overflow-hidden cursor-pointer hover:brightness-110 shadow-sm"
                        style={{ 
                          top: `${top}px`, 
                          height: `${dur}px`,
                          backgroundColor: color.bg,
                          borderLeftWidth: '4px',
                          borderLeftColor: color.border
                        }}
                      >
                        <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
                          <span className="text-[10px]">□</span> {t.title}
                        </div>
                        {dur >= 40 && (
                          <div className="text-[9px] text-slate-700 dark:text-slate-300 mt-0.5">
                            {t.timeStart} {t.timeEnd ? `- ${t.timeEnd}` : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </TimeGridDroppableDayColumn>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderAgendaView = () => {
    // Show next 14 days or days in month with tasks
    const mStart = startOfMonth(currentDate);
    const mEnd = endOfMonth(mStart);
    const days = eachDayOfInterval({ start: mStart, end: mEnd }).filter(d => getTasksForDay(d).length > 0);

    return (
      <div className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar">
        {days.map((day) => {
          const dayTasks = getTasksForDay(day).sort((a, b) => (a.timeStart || '24:00').localeCompare(b.timeStart || '24:00'));
          const isCurrDay = isToday(day);

          return (
            <div key={day.toISOString()} className="flex gap-4">
              <div className="w-16 shrink-0 pt-2 text-right">
                <div className={`text-xl font-bold ${isCurrDay ? 'text-blue-500' : 'text-slate-800 dark:text-slate-200'}`}>
                  {format(day, 'd')}
                </div>
                <div className={`text-[11px] font-semibold ${isCurrDay ? 'text-blue-400' : 'text-slate-500'}`}>
                  {format(day, 'EEE')}
                </div>
              </div>
              
              <div className="flex-1 space-y-2 border-l-2 border-slate-200/80 dark:border-white/[0.06] pl-4 pb-4">
                {dayTasks.map((t, idx) => {
                  const color = getTaskBlockColor(idx);
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="bg-white dark:bg-[#161622] hover:bg-slate-50 dark:bg-[#191922] rounded-lg p-3 flex items-start gap-3 cursor-pointer shadow-sm transition"
                      style={{ borderLeft: `4px solid ${color.border}` }}
                    >
                      <div className="w-10 pt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                        {t.timeStart || 'All day'}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.title}</div>
                        {(t.timeStart && t.timeEnd) && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1" style={{ color: color.hex }}>
                            {t.timeStart} - {t.timeEnd}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {days.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
            <div>No tasks scheduled for this month.</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
    <div className="h-full flex flex-col space-y-3 bg-[#F4F5F8] dark:bg-[#121217] text-slate-900 dark:text-slate-100 p-4 relative select-none overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>📅</span>
          <span>{calendarMode === 'Year' ? format(currentDate, 'yyyy') : format(currentDate, 'MMMM yyyy')}</span>
        </h2>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUnscheduled((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition flex items-center gap-1.5 ${
              showUnscheduled
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-white dark:bg-[#161622] hover:bg-slate-50 dark:bg-[#191922] border-slate-200/80 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:text-white'
            }`}
          >
            <span>Unscheduled ({unscheduledTasks.length})</span>
          </button>

          <button
            onClick={() => handleDayClick(new Date())}
            className="p-1.5 rounded-lg bg-white dark:bg-[#161622] hover:bg-slate-50 dark:bg-[#191922] border border-slate-200/80 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:text-white transition flex items-center"
          >
            <Plus className="w-4 h-4" />
          </button>

          <select
            value={calendarMode}
            onChange={(e: any) => setCalendarMode(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#161622] hover:bg-slate-50 dark:bg-[#191922] border border-slate-200/80 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 text-sm font-semibold focus:outline-none cursor-pointer"
          >
            <option value="Year">Year</option>
            <option value="Month">Month</option>
            <option value="Week">Week</option>
            <option value="Day">Day</option>
            <option value="Agenda">Agenda</option>
            <option value="Multi-Day">3 Days</option>
            <option value="Multi-Week">4 Weeks</option>
          </select>

          <div className="flex items-center bg-white dark:bg-[#161622] border border-slate-200/80 dark:border-white/[0.06] rounded-lg">
            <button onClick={navigatePrevious} className="p-1.5 hover:bg-slate-50 dark:bg-[#191922] text-slate-700 dark:text-slate-300 hover:text-white rounded-l-lg transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={navigateToday} className="px-3 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-white border-x border-slate-200/80 dark:border-white/[0.06] transition">
              Today
            </button>
            <button onClick={navigateNext} className="p-1.5 hover:bg-slate-50 dark:bg-[#191922] text-slate-700 dark:text-slate-300 hover:text-white rounded-r-lg transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Unscheduled Tasks Drawer */}
      {showUnscheduled && (
        <div className="bg-white dark:bg-[#161622] border border-slate-200/80 dark:border-white/[0.06] rounded-xl p-4 mb-2 max-h-48 overflow-y-auto animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Unscheduled Tasks ({unscheduledTasks.length})</h4>
            <span className="text-[11px] text-slate-500">Click a task to schedule onto {format(currentDate, 'MMM d')}</span>
          </div>
          {unscheduledTasks.length === 0 ? (
            <div className="text-xs text-slate-500 italic py-2">All tasks are scheduled!</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unscheduledTasks.map((t) => (
                <DraggableUnscheduledItem
                  key={t.id}
                  task={t}
                  updateTask={updateTask}
                  currentDate={currentDate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main View Area */}
      <div className="flex-1 bg-[#F4F5F8] dark:bg-[#121217] border border-slate-200/80 dark:border-white/[0.06] rounded-xl overflow-hidden flex flex-col pb-16">
        {calendarMode === 'Year' && renderYearView()}
        {calendarMode === 'Month' && renderMonthGrid(5)}
        {calendarMode === 'Multi-Week' && renderMonthGrid(4)}
        
        {calendarMode === 'Week' && renderTimeGrid(eachDayOfInterval({ 
          start: startOfWeek(currentDate), 
          end: endOfWeek(currentDate) 
        }))}
        
        {calendarMode === 'Multi-Day' && renderTimeGrid([
          subDays(currentDate, 1),
          currentDate,
          addDays(currentDate, 1)
        ])}
        
        {calendarMode === 'Day' && renderTimeGrid([currentDate])}
        
        {calendarMode === 'Agenda' && renderAgendaView()}
      </div>

      {/* Floating Mode Selector */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-[#161622]/95 backdrop-blur-md border border-slate-200/80 dark:border-white/[0.06] shadow-2xl rounded-full px-4 py-1.5 flex items-center gap-1 z-30">
        {(['Year', 'Month', 'Week', 'Day', 'Agenda', 'Multi-Day', 'Multi-Week'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setCalendarMode(mode)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
              calendarMode === mode
                ? 'bg-slate-50 dark:bg-[#191922] text-white shadow'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'
            }`}
          >
            {mode === 'Multi-Day' ? '3-Day' : mode === 'Multi-Week' ? '4-Week' : mode}
          </button>
        ))}
      </div>

      {/* Task Creation Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="bg-white dark:bg-[#161622] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl w-96 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Add Task for {format(createModalDate, 'MMM d, yyyy')}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-500 dark:text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Task Title</label>
                <input
                  autoFocus
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-[#F4F5F8] dark:bg-[#121217] border border-slate-200/80 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Team meeting"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Start Time</label>
                  <input
                    type="time"
                    value={newTaskTimeStart}
                    onChange={(e) => setNewTaskTimeStart(e.target.value)}
                    className="w-full bg-[#F4F5F8] dark:bg-[#121217] border border-slate-200/80 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">End Time</label>
                  <input
                    type="time"
                    value={newTaskTimeEnd}
                    onChange={(e) => setNewTaskTimeEnd(e.target.value)}
                    className="w-full bg-[#F4F5F8] dark:bg-[#121217] border border-slate-200/80 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-[#191922] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1"
              >
                <Check className="w-4 h-4" />
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </DndContext>
  );
};
