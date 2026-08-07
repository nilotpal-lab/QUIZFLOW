'use client';

import React from 'react';
import { Trash2, RotateCcw, Trash, AlertCircle } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';

export const TrashView: React.FC = () => {
  const { trashTasks, restoreTask, emptyTrash } = useTaskStore();

  return (
    <div className="flex-1 bg-[#F4F5F8] dark:bg-[#121217] text-slate-900 dark:text-slate-100 p-6 flex flex-col space-y-6 select-none overflow-y-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.06] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Trash Bin</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tasks in trash can be restored anytime</p>
          </div>
        </div>

        {trashTasks.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Permanently delete all items in trash?')) {
                emptyTrash();
              }
            }}
            className="px-3.5 py-1.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 border border-red-500/20"
          >
            <Trash className="w-3.5 h-3.5" />
            <span>Empty Trash</span>
          </button>
        )}
      </div>

      {/* Trash Items List */}
      {trashTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 py-16">
          <Trash2 className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm font-semibold">Trash is empty</p>
          <p className="text-xs mt-1 text-slate-500">Deleted tasks will appear here</p>
        </div>
      ) : (
        <div className="space-y-2 max-w-3xl">
          {trashTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] rounded-xl p-3.5 flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                <span className="text-sm text-slate-500 dark:text-slate-400 line-through">{task.title}</span>
              </div>

              <button
                onClick={() => restoreTask(task.id)}
                className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center gap-1"
                title="Restore Task"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
