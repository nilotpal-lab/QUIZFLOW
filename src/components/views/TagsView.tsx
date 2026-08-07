'use client';

import React, { useState } from 'react';
import { Tag as TagIcon, Trash2, Plus, X } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';

export const TagsView: React.FC = () => {
  const { tags, deleteTag, setActiveView, createTag } = useTaskStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagName.trim()) {
      await createTag(newTagName.trim(), newTagColor);
      setNewTagName('');
      setIsAdding(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-900 dark:text-slate-100">Tags Management</h2>
          <p className="text-xs text-slate-500">Filter and organize your task ecosystem with custom tags</p>
        </div>
        <button
          onClick={() => { setIsAdding(true); setNewTagName(''); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-transform active:scale-95 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Tag</span>
        </button>
      </div>

      {isAdding && (
        <div className="bg-slate-50 dark:bg-[#191922] p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] shadow-sm mb-6">
          <form onSubmit={handleCreate} className="flex items-center gap-4">
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="w-8 h-8 rounded-full border-none cursor-pointer bg-transparent shrink-0"
            />
            <input
              autoFocus
              type="text"
              placeholder="Enter tag name..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setIsAdding(false)}
              className="flex-1 bg-[#F4F5F8] dark:bg-[#121217] border border-slate-200/80 dark:border-white/[0.06] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button type="submit" className="px-4 py-2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:opacity-90 transition-transform active:scale-95">
              Create
            </button>
            <button type="button" onClick={() => setIsAdding(false)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-700 dark:text-slate-300 transition-transform active:scale-95">
              <X className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {tags.length === 0 && !isAdding ? (
          <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
            No tags created yet. Add tags from above or the sidebar!
          </div>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="bg-slate-50 dark:bg-[#191922] p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] shadow-sm flex items-center justify-between group hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
            >
              <button
                onClick={() => setActiveView('tags', null, tag.id)}
                className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-900 dark:text-slate-100 text-sm transition-transform active:scale-95"
              >
                <TagIcon className="w-4 h-4" style={{ color: tag.color || '#3b82f6' }} />
                <span>#{tag.name}</span>
              </button>

              <div className="flex items-center gap-2">
                {tag._count?.tasks !== undefined && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">
                    {tag._count.tasks}
                  </span>
                )}
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete the tag "${tag.name}"?`)) {
                      deleteTag(tag.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all active:scale-95"
                  title="Delete Tag"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
