'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus, MoreHorizontal, Check, X, Trash2, Edit2, CheckCircle2, Circle } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';

const priorityStyles: Record<string, string> = {
  P1: 'bg-red-500/10 text-red-600 dark:text-red-400',
  P2: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  P3: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  P4: 'bg-slate-500/10 text-slate-600 dark:text-slate-500 dark:text-slate-400',
};

const DraggableTaskCard = ({ task, toggleTask }: { task: any; toggleTask: (id: string) => void }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group bg-slate-50 dark:bg-[#191922] p-3.5 rounded-xl shadow-sm border border-slate-200/80 dark:border-white/[0.06] hover:border-blue-300 transition cursor-grab active:cursor-grabbing flex flex-col gap-3 ${
        isDragging ? 'rotate-2 scale-105 shadow-xl border-blue-500/50' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleTask(task.id);
          }}
          className="mt-0.5 text-slate-500 dark:text-slate-400 hover:text-blue-500 transition shrink-0 active:scale-95"
        >
          {task.status === 'COMPLETED' ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <Circle className="w-4 h-4" />
          )}
        </button>
        <p
          className={`text-sm font-medium leading-tight ${
            task.status === 'COMPLETED'
              ? 'line-through text-slate-500'
              : 'text-slate-900 dark:text-slate-100'
          }`}
        >
          {task.title}
        </p>
      </div>

      <div className="flex items-center gap-2 mt-auto">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
            priorityStyles[task.priority] || priorityStyles.P4
          }`}
        >
          {task.priority}
        </span>
        {task.list && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-[#303030] text-slate-500 dark:text-slate-400 truncate max-w-[120px] font-medium border border-transparent">
            {task.list.name}
          </span>
        )}
      </div>
    </div>
  );
};

const DroppableColumn = ({ col, children }: { col: string; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: col });

  return (
    <div
      ref={setNodeRef}
      id={col}
      className={`w-72 shrink-0 bg-white dark:bg-[#161622] rounded-2xl p-3 border ${
        isOver ? 'border-blue-500 bg-blue-900/10' : 'border-slate-200/80 dark:border-white/[0.06]'
      } flex flex-col max-h-full transition-colors duration-200`}
    >
      {children}
    </div>
  );
};

export const KanbanView: React.FC = () => {
  const {
    tasks,
    updateTask,
    createTask,
    deleteTask,
    toggleTask,
    kanbanColumns = ['To Do', 'In Progress', 'Done'],
    addKanbanColumn,
    removeKanbanColumn,
    renameKanbanColumn,
  } = useTaskStore();

  const [newColName, setNewColName] = useState('');
  const [isAddingCol, setIsAddingCol] = useState(false);

  // Inline add task
  const [addingTaskToCol, setAddingTaskToCol] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Column Dropdown Options
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Column Inline Editing
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [editColName, setEditColName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overColumn = over.id as string;

    const task = tasks.find((t) => t.id === taskId);
    if (task && task.kanbanCol !== overColumn) {
      updateTask(taskId, {
        kanbanCol: overColumn,
        status: overColumn === 'Done' ? 'COMPLETED' : 'TODO',
      });
    }
  };

  const submitNewTask = (col: string) => {
    if (newTaskTitle.trim()) {
      createTask(newTaskTitle.trim(), {
        kanbanCol: col,
        status: col === 'Done' ? 'COMPLETED' : 'TODO',
      });
    }
    setNewTaskTitle('');
    setAddingTaskToCol(null);
  };

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (newColName.trim() && !kanbanColumns.includes(newColName.trim())) {
      addKanbanColumn?.(newColName.trim());
      setNewColName('');
      setIsAddingCol(false);
    }
  };

  const handleRenameSubmit = (oldCol: string) => {
    if (editColName.trim() && editColName.trim() !== oldCol) {
      renameKanbanColumn?.(oldCol, editColName.trim());
    }
    setEditingCol(null);
  };

  const clearCompleted = (col: string) => {
    const colTasks = tasks.filter((t) => (t.kanbanCol || 'To Do') === col && t.status === 'COMPLETED');
    colTasks.forEach((t) => deleteTask(t.id));
    setActiveDropdown(null);
  };

  const deleteColumn = (col: string) => {
    const colTasks = tasks.filter((t) => (t.kanbanCol || 'To Do') === col);
    if (colTasks.length > 0) {
      if (!window.confirm(`Column "${col}" has ${colTasks.length} tasks. Delete anyway?`)) return;
    }
    removeKanbanColumn?.(col);
    setActiveDropdown(null);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="h-full flex gap-4 overflow-x-auto pb-4 select-none bg-[#F4F5F8] dark:bg-[#121217] p-4">
        {kanbanColumns.map((col) => {
          const colTasks = tasks.filter((t) => (t.kanbanCol || 'To Do') === col);

          return (
            <DroppableColumn key={col} col={col}>
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80 dark:border-white/[0.06] relative">
                {editingCol === col ? (
                  <input
                    autoFocus
                    value={editColName}
                    onChange={(e) => setEditColName(e.target.value)}
                    onBlur={() => handleRenameSubmit(col)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(col)}
                    className="font-bold text-sm bg-[#F4F5F8] dark:bg-[#121217] text-slate-900 dark:text-slate-100 rounded px-2 py-0.5 outline-none w-full mr-2"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">{col}</h3>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#303030] text-slate-500 dark:text-slate-400">
                      {colTasks.length}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setAddingTaskToCol(col)}
                    className="p-1 rounded-lg hover:bg-slate-200 dark:bg-[#303030] text-slate-500 dark:text-slate-400 hover:text-white transition active:scale-95"
                    title="Add Task"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === col ? null : col)}
                      className="p-1 rounded-lg hover:bg-slate-200 dark:bg-[#303030] text-slate-500 dark:text-slate-400 hover:text-white transition active:scale-95"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    
                    {activeDropdown === col && (
                      <div ref={dropdownRef} className="absolute right-0 top-full mt-1 w-44 bg-slate-50 dark:bg-[#191922] border border-slate-200/80 dark:border-white/[0.06] shadow-lg rounded-xl overflow-hidden z-10 py-1">
                        <button
                          onClick={() => { setEditingCol(col); setEditColName(col); setActiveDropdown(null); }}
                          className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-200 dark:bg-[#303030] flex items-center gap-2 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Rename Column
                        </button>
                        <button
                          onClick={() => clearCompleted(col)}
                          className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:bg-[#303030] flex items-center gap-2 transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Clear Completed
                        </button>
                        <div className="h-px bg-white/[0.06] my-1"></div>
                        <button
                          onClick={() => deleteColumn(col)}
                          className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-500/10 flex items-center gap-2 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Column
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Task Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-[150px] scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-[#3a3a3a]">
                {colTasks.map((t) => (
                  <DraggableTaskCard key={t.id} task={t} toggleTask={toggleTask} />
                ))}

                {addingTaskToCol === col && (
                  <div className="bg-slate-50 dark:bg-[#191922] p-3 rounded-xl border border-blue-500 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                    <input
                      autoFocus
                      type="text"
                      placeholder="What needs to be done?"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitNewTask(col);
                        if (e.key === 'Escape') setAddingTaskToCol(null);
                      }}
                      className="w-full text-sm bg-transparent outline-none text-slate-800 dark:text-slate-200 mb-3"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setAddingTaskToCol(null)}
                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition active:scale-95"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => submitNewTask(col)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition active:scale-95"
                      >
                        Add Task
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {!addingTaskToCol && (
                <button
                  onClick={() => setAddingTaskToCol(col)}
                  className="mt-2 w-full py-2 px-3 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#2a2a2a] transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" /> Add task
                </button>
              )}
            </DroppableColumn>
          );
        })}

        {/* Add Section Button */}
        <div className="w-72 shrink-0">
          {isAddingCol ? (
            <form
              onSubmit={handleAddColumn}
              className="bg-white dark:bg-[#161622] p-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] shadow-sm animate-in fade-in zoom-in-95 duration-200"
            >
              <input
                type="text"
                autoFocus
                placeholder="Section name..."
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                className="w-full text-sm bg-[#F4F5F8] dark:bg-[#121217] border border-slate-200/80 dark:border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition mb-3"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingCol(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition active:scale-95"
                >
                  Add Section
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingCol(true)}
              className="w-full py-3 px-4 border border-dashed border-slate-200/80 dark:border-white/[0.06] hover:border-[#444444] hover:bg-[#1e1e1e] rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New section</span>
            </button>
          )}
        </div>
      </div>
    </DndContext>
  );
};
