'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Calendar,
  Flag,
  Tag as TagIcon,
  List as ListIcon,
  CheckSquare,
  Plus,
  Clock,
  RotateCw,
  AlignLeft,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { useTaskStore } from '../../store/useTaskStore';
import { Priority, Recurrence } from '../../types';

export const DetailPanel: React.FC = () => {
  const {
    tasks,
    selectedTaskId,
    setSelectedTaskId,
    updateTask,
    deleteTask,
    lists,
    tags,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
  } = useTaskStore();

  const task = tasks.find((t) => t.id === selectedTaskId);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [newSubtask, setNewSubtask] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes || '');
    }
  }, [task?.id, task?.title, task?.notes]);

  if (!task) return null;

  const safeDate = (val: any): Date | null => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const handleTitleBlur = () => {
    if (title.trim() && title !== task.title) {
      updateTask(task.id, { title: title.trim() });
    }
  };

  const handleNotesBlur = () => {
    if (notes !== (task.notes || '')) {
      updateTask(task.id, { notes });
    }
  };

  const handleAddSubtaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubtask.trim()) {
      addSubtask(task.id, newSubtask.trim());
      setNewSubtask('');
    }
  };

  return (
    <aside className="w-80 h-screen bg-white dark:bg-[#111113] border-l border-slate-200 dark:border-white/[0.06] flex flex-col justify-between p-4 overflow-y-auto text-slate-900 dark:text-slate-100 transition-all animate-in slide-in-from-right duration-200">
      <div className="space-y-6">
        {/* Header bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateTask(task.id, { status: task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED' })}
              className="focus:outline-none"
            >
              <CheckCircle2
                className={`w-5 h-5 ${
                  task.status === 'COMPLETED' ? 'text-blue-500 fill-blue-500/20' : 'text-slate-400 hover:text-blue-500'
                }`}
              />
            </button>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Task Detail</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedTaskId(null)}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Title input */}
        <div>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            rows={2}
            className="w-full bg-transparent font-semibold text-lg focus:outline-none resize-none border-b border-transparent focus:border-blue-500 placeholder:text-slate-400"
            placeholder="Task title..."
          />
        </div>

        {/* Properties list */}
        <div className="space-y-3 text-xs">
          {/* Priority */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-slate-500">
              <Flag className="w-4 h-4" />
              <span>Priority</span>
            </div>
            <select
              value={task.priority}
              onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}
              className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded px-2 py-1 border-none focus:outline-none font-medium cursor-pointer"
            >
              <option value="P1">P1 (Urgent - Red)</option>
              <option value="P2">P2 (High - Orange)</option>
              <option value="P3">P3 (Medium - Blue)</option>
              <option value="P4">P4 (Low - Gray)</option>
            </select>
          </div>

          {/* Due Date */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-slate-500">
              <Calendar className="w-4 h-4" />
              <span>Due Date</span>
            </div>
            <input
              type="datetime-local"
              value={safeDate(task.dueDate)?.toISOString().slice(0, 16) ?? ''}
              onChange={(e) => updateTask(task.id, { dueDate: e.target.value ? (safeDate(e.target.value)?.toISOString() ?? null) : null })}
              className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded px-2 py-1 border-none focus:outline-none font-medium cursor-pointer"
            />
          </div>

          {/* Recurrence */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-slate-500">
              <RotateCw className="w-4 h-4" />
              <span>Repeat</span>
            </div>
            <select
              value={task.recurrence}
              onChange={(e) => updateTask(task.id, { recurrence: e.target.value as Recurrence })}
              className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded px-2 py-1 border-none focus:outline-none font-medium cursor-pointer"
            >
              <option value="NONE">None</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>

          {/* List Selection */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-slate-500">
              <ListIcon className="w-4 h-4" />
              <span>List</span>
            </div>
            <select
              value={task.listId || ''}
              onChange={(e) => updateTask(task.id, { listId: e.target.value || null })}
              className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded px-2 py-1 border-none focus:outline-none font-medium cursor-pointer"
            >
              <option value="">(No List / Inbox)</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tag Selection */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-slate-500">
              <TagIcon className="w-4 h-4" />
              <span>Tag</span>
            </div>
            <select
              value={task.tags?.[0]?.tag?.id || ''}
              onChange={(e) => {
                const tagId = e.target.value;
                updateTask(task.id, { tagIds: tagId ? [tagId] : [] });
              }}
              className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded px-2 py-1 border-none focus:outline-none font-medium cursor-pointer"
            >
              <option value="">(No Tag)</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subtasks Section */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Subtasks</span>
            </div>
            <span>
              {task.subtasks?.filter((s) => s.isCompleted).length || 0}/{task.subtasks?.length || 0}
            </span>
          </div>

          <div className="space-y-1">
            {task.subtasks?.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between group py-1 text-xs">
                <label className="flex items-center gap-2 flex-1 cursor-pointer overflow-hidden">
                  <input
                    type="checkbox"
                    checked={sub.isCompleted}
                    onChange={() => toggleSubtask(sub.id, sub.isCompleted)}
                    className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <span className={`truncate ${sub.isCompleted ? 'line-through text-slate-400' : ''}`}>
                    {sub.title}
                  </span>
                </label>
                <button
                  onClick={() => deleteSubtask(sub.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddSubtaskSubmit} className="flex items-center gap-2 mt-2">
            <Plus className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Add subtask..."
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none placeholder:text-slate-400"
            />
          </form>
        </div>

        {/* Notes Section */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Notes</span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            rows={4}
            placeholder="Add detailed notes..."
            className="w-full p-2 text-xs bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
      </div>

      {/* Footer & Safe Delete Button */}
      <div className="pt-3 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-[10px] text-slate-400">
        <div>Created: {safeDate(task.createdAt) ? format(safeDate(task.createdAt)!, 'MMM d, yyyy') : 'Unknown'}</div>
        <button
          onClick={() => deleteTask(task.id)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition active:scale-95"
          title="Delete Task"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>
      </div>
    </aside>
  );
};
