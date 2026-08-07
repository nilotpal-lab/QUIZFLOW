'use client';

import React from 'react';
import { Plus, CornerDownLeft } from 'lucide-react';

import { useTaskStore } from '../../store/useTaskStore';

interface QuickAddBarProps {
  onOpenOmni?: () => void;
}

export const QuickAddBar: React.FC<QuickAddBarProps> = ({ onOpenOmni }) => {
  const { openOmniModal } = useTaskStore();
  const handleClick = () => {
    if (onOpenOmni) onOpenOmni();
    else openOmniModal();
  };

  return (
    <button
      id="quick-add-task-input"
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.1] rounded-xl text-left transition-all active:scale-[0.99] group"
    >
      <div className="w-6 h-6 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-600/20 transition-colors">
        <Plus className="w-3.5 h-3.5 text-blue-400" />
      </div>
      <span className="flex-1 text-sm text-[#64748B] group-hover:text-[#94A3B8] transition-colors">
        New task...
      </span>
      <kbd className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] font-mono text-[#475569]">
        C
      </kbd>
    </button>
  );
};
