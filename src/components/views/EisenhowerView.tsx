'use client';

import React, { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { Task, EisenhowerQuadrant } from '../../types';
import { format } from 'date-fns';

const QUADRANTS: {
  id: EisenhowerQuadrant;
  label: string;
  badgeColor: string;
  badgeBg: string;
  headerBg: string;
  textColor: string;
  number: string;
}[] = [
  {
    id: 'Q1',
    label: 'Urgent & Important',
    badgeColor: '#ef4444',
    badgeBg: 'bg-red-500 text-white',
    headerBg: 'bg-red-50/80 dark:bg-[#221414] border-b border-red-200/80 dark:border-red-500/20',
    textColor: 'text-red-700 dark:text-red-300',
    number: '①',
  },
  {
    id: 'Q2',
    label: 'Not Urgent & Important',
    badgeColor: '#eab308',
    badgeBg: 'bg-amber-500 text-white',
    headerBg: 'bg-amber-50/80 dark:bg-[#222014] border-b border-amber-200/80 dark:border-amber-500/20',
    textColor: 'text-amber-800 dark:text-amber-300',
    number: '②',
  },
  {
    id: 'Q3',
    label: 'Urgent & Unimportant',
    badgeColor: '#3b82f6',
    badgeBg: 'bg-blue-500 text-white',
    headerBg: 'bg-blue-50/80 dark:bg-[#141a22] border-b border-blue-200/80 dark:border-blue-500/20',
    textColor: 'text-blue-700 dark:text-blue-300',
    number: '③',
  },
  {
    id: 'Q4',
    label: 'Not Urgent & Unimportant',
    badgeColor: '#22c55e',
    badgeBg: 'bg-emerald-500 text-white',
    headerBg: 'bg-emerald-50/80 dark:bg-[#142218] border-b border-emerald-200/80 dark:border-emerald-500/20',
    textColor: 'text-emerald-800 dark:text-emerald-300',
    number: '④',
  },
];

function groupByDate(tasks: Task[]): Record<string, Task[]> {
  const groups: Record<string, Task[]> = {};
  tasks.forEach((t) => {
    const key = t.dueDate
      ? format(new Date(t.dueDate), 'MMM d, yyyy')
      : 'No Date';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return groups;
}

export const EisenhowerView: React.FC = () => {
  const { tasks, createTask, setSelectedTaskId, selectedTaskId } = useTaskStore();
  const [quickAdd, setQuickAdd] = useState<EisenhowerQuadrant | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleQuickAdd = (e: React.FormEvent, qId: EisenhowerQuadrant) => {
    e.preventDefault();
    if (quickAddTitle.trim()) {
      createTask(quickAddTitle.trim(), {
        eisenhower: qId,
        priority: qId === 'Q1' ? 'P1' : qId === 'Q2' ? 'P2' : qId === 'Q3' ? 'P3' : 'P4',
      });
      setQuickAddTitle('');
    }
    setQuickAdd(null);
  };

  const toggleGroup = (key: string) =>
    setCollapsed((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="h-full grid grid-cols-2 grid-rows-2 bg-slate-200 dark:bg-white/[0.08] gap-[1px] p-[1px] select-none font-sans">
      {QUADRANTS.map((quad) => {
        const qTasks = tasks.filter(
          (t) => (t.eisenhower || 'Q4') === quad.id && t.status !== 'COMPLETED'
        );
        const groups = groupByDate(qTasks);

        return (
          <div key={quad.id} className="bg-white dark:bg-[#121217] flex flex-col overflow-hidden">
            {/* Quadrant Header */}
            <div className={`${quad.headerBg} px-4 py-2.5 flex items-center justify-between`}>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${quad.badgeBg} shadow-sm`}
                >
                  {quad.id.replace('Q', '')}
                </div>
                <span className={`text-xs font-bold ${quad.textColor}`}>{quad.label}</span>
              </div>
              <button
                onClick={() => { setQuickAdd(quad.id); setQuickAddTitle(''); }}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Task Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Quick Add Form */}
              {quickAdd === quad.id && (
                <form
                  onSubmit={(e) => handleQuickAdd(e, quad.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1A1A24] border border-slate-200 dark:border-white/[0.1] shadow-sm"
                >
                  <div className="w-3.5 h-3.5 rounded border border-slate-400 shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Add task to this quadrant..."
                    value={quickAddTitle}
                    onChange={(e) => setQuickAddTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setQuickAdd(null)}
                    className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
                  />
                  <button type="submit" className="text-xs px-2.5 py-1 bg-indigo-600 rounded-lg text-white font-bold shadow-sm">Add</button>
                  <button type="button" onClick={() => setQuickAdd(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                </form>
              )}

              {qTasks.length === 0 && quickAdd !== quad.id ? (
                <div className="h-40 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 font-medium italic">No tasks</div>
              ) : (
                Object.entries(groups).map(([dateKey, dateTasks]) => (
                  <div key={dateKey} className="mb-2">
                    {/* Date Group Header */}
                    <button
                      onClick={() => toggleGroup(`${quad.id}-${dateKey}`)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1 py-1 w-full text-left transition hover:text-slate-800 dark:hover:text-white"
                    >
                      {collapsed[`${quad.id}-${dateKey}`]
                        ? <ChevronRight className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />
                      }
                      <span>{dateKey}</span>
                      <span className="font-mono text-[10px] bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.2 rounded text-slate-500 dark:text-slate-400 ml-1">{dateTasks.length}</span>
                    </button>

                    {/* Tasks in Date Group */}
                    {!collapsed[`${quad.id}-${dateKey}`] && (
                      <div className="space-y-1 mt-1">
                        {dateTasks.map((task) => (
                          <EisenhowerTaskRow
                            key={task.id}
                            task={task}
                            isSelected={selectedTaskId === task.id}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const EisenhowerTaskRow: React.FC<{ task: Task; isSelected: boolean }> = ({ task, isSelected }) => {
  const { toggleTask, setSelectedTaskId } = useTaskStore();

  return (
    <div
      onClick={() => setSelectedTaskId(task.id)}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer group transition-all duration-150 border ${
        isSelected
          ? 'bg-indigo-50 dark:bg-[#1e2a3a] border-indigo-300/80 dark:border-blue-500/40 shadow-sm'
          : 'bg-slate-50/80 dark:bg-[#161622]/60 hover:bg-slate-100 dark:hover:bg-white/[0.04] border-slate-200/60 dark:border-white/[0.04]'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
        className="shrink-0 w-4 h-4 rounded-md border border-slate-300 dark:border-slate-500 hover:border-indigo-500 flex items-center justify-center focus:outline-none transition active:scale-95"
      />

      {/* Title */}
      <span className="flex-1 text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{task.title}</span>

      {/* List Badge */}
      {task.list && (
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] text-slate-600 dark:text-slate-400 bg-slate-200/60 dark:bg-white/[0.06] shrink-0 font-medium"
          style={{ borderLeft: `2px solid ${task.list.color}` }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.list.color }} />
          {task.list.name}
        </span>
      )}

      {/* Notes indicator */}
      {task.notes && (
        <span className="text-slate-400 text-[10px] opacity-0 group-hover:opacity-100 transition">💬</span>
      )}
    </div>
  );
};
