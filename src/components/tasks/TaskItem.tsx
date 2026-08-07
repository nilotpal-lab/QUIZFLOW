'use client';

import React from 'react';
import { CheckCircle2, Circle, Calendar, Flag, Tag, ChevronRight, CheckSquare } from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { Task, Priority } from '../../types';
import { useTaskStore } from '../../store/useTaskStore';

interface TaskItemProps {
  task: Task;
}

const PRIORITY_COLORS: Record<Priority, { border: string; bg: string; text: string }> = {
  P1: { border: 'border-red-500', bg: 'bg-red-500/10', text: 'text-red-500' },
  P2: { border: 'border-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-500' },
  P3: { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-500' },
  P4: { border: 'border-slate-300 dark:border-slate-600', bg: 'bg-transparent', text: 'text-slate-400' },
};

export const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const { toggleTask, selectedTaskId, setSelectedTaskId } = useTaskStore();
  const isSelected = selectedTaskId === task.id;
  const isCompleted = task.status === 'COMPLETED';

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    return format(d, 'MMM d, h:mm a');
  };

  const dueLabel = formatDueDate(task.dueDate);
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && !isCompleted;

  const completedSubtasks = task.subtasks?.filter((s) => s.isCompleted).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <div
      onClick={() => setSelectedTaskId(task.id)}
      className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-blue-500/10 border-blue-500/50 shadow-sm'
          : 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Toggle Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleTask(task.id);
          }}
          className="shrink-0 focus:outline-none transition transform active:scale-95"
        >
          {isCompleted ? (
            <div className="w-4 h-4 rounded bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">
              ✓
            </div>
          ) : (
            <div
              className={`w-4 h-4 rounded border ${
                PRIORITY_COLORS[task.priority].border
              } hover:border-blue-500 transition`}
            />
          )}
        </button>

        {/* Task Title & Badges */}
        <div className="overflow-hidden space-y-0.5">
          <p
            className={`text-sm font-medium truncate transition ${
              isCompleted
                ? 'line-through text-slate-400 dark:text-slate-500'
                : 'text-slate-800 dark:text-slate-100'
            }`}
          >
            {task.title}
          </p>

          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
            {/* Due Date */}
            {dueLabel && (
              <span
                className={`flex items-center gap-1 font-medium ${
                  isOverdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>{dueLabel}</span>
              </span>
            )}

            {/* List Badge */}
            {task.list && (
              <span className="flex items-center gap-1 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.list.color }} />
                <span>{task.list.name}</span>
              </span>
            )}

            {/* Subtask count */}
            {totalSubtasks > 0 && (
              <span className="flex items-center gap-1 text-slate-400">
                <CheckSquare className="w-3 h-3" />
                <span>
                  {completedSubtasks}/{totalSubtasks}
                </span>
              </span>
            )}

            {/* Tags */}
            {task.tags &&
              task.tags.map(({ tag }) => (
                <span key={tag.id} className="text-slate-400 hover:text-blue-500">
                  #{tag.name}
                </span>
              ))}
          </div>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition" />
    </div>
  );
};
