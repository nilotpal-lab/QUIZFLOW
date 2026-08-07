import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, Flag, FolderOpen, Tag, Timer, 
  Repeat, CheckSquare, X, Plus 
} from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { useTaskParser } from '../../hooks/useTaskParser';

interface OmniModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OmniModal: React.FC<OmniModalProps> = ({ isOpen, onClose }) => {
  const [inputText, setInputText] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  
  // New States
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [activePopover, setActivePopover] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const parsedTask = useTaskParser(inputText);

  useEffect(() => {
    if (isOpen) {
      setInputText('');
      setNotes('');
      setSubtasks([]);
      setShowNotes(false);
      setShowSubtasks(false);
      setDueDate(null);
      setPriority(null);
      setListId(null);
      setSelectedTags([]);
      setEstimate(null);
      setRecurrence(null);
      setActivePopover(null);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const togglePopover = (name: string) => {
    setActivePopover(prev => prev === name ? null : name);
  };

  const handleSubmit = (keepOpen: boolean) => {
    const finalTitle = parsedTask?.cleanTitle?.trim() || inputText.trim();
    if (!finalTitle) return;
    
    const { createTask, addSubtask } = useTaskStore.getState();
    
    // Fire optimistically with 0ms UI delay!
    createTask(finalTitle, {
      priority: (priority || parsedTask?.priority || 'P4') as any,
      dueDate: dueDate || (parsedTask?.dueDate ? new Date(parsedTask.dueDate).toISOString() : undefined),
      tagIds: Array.from(new Set([...(parsedTask?.tags || []), ...selectedTags])),
      recurrence: (recurrence || parsedTask?.recurrence || 'NONE') as any,
      notes,
      listId: listId || undefined,
    }).then((task) => {
      if (task && subtasks.length > 0) {
        subtasks.forEach((st) => {
          if (st.trim()) addSubtask(task.id, st.trim());
        });
      }
    }).catch((err) => console.error('Error creating task:', err));

    if (keepOpen) {
      setInputText('');
      setNotes('');
      setSubtasks([]);
      setDueDate(null);
      setPriority(null);
      setListId(null);
      setSelectedTags([]);
      setEstimate(null);
      setRecurrence(null);
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSubmit(false);
      } else if (e.shiftKey) {
        e.preventDefault();
        handleSubmit(true);
      }
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };
  
  const handleNotesKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit(false);
      } else if (e.key === 'Escape') {
          onClose();
      }
  }

  const addSubtaskField = () => {
    setSubtasks([...subtasks, '']);
  };

  const updateSubtask = (index: number, val: string) => {
    const newSt = [...subtasks];
    newSt[index] = val;
    setSubtasks(newSt);
  };
  
  const handlePasteSubtasks = (index: number, e: React.ClipboardEvent) => {
      const paste = e.clipboardData.getData('text');
      if (paste.includes('\n')) {
          e.preventDefault();
          const lines = paste.split('\n').filter(l => l.trim() !== '');
          const newSt = [...subtasks];
          newSt.splice(index, 1, ...lines);
          setSubtasks(newSt);
      }
  }

  // Priority colors map
  const priorityColor: Record<string, string> = {
    P1: 'bg-red-500/20 text-red-400',
    P2: 'bg-orange-500/20 text-orange-400',
    P3: 'bg-blue-500/20 text-blue-400',
    P4: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      ></div>
      
      <div className="relative w-full max-w-2xl mx-4 bg-[#18181b]/95 backdrop-blur-2xl border border-white/[0.06] rounded-2xl shadow-2xl overflow-hidden flex flex-col slide-in-from-bottom-4 duration-200">
        
        {/* Main Input Area */}
        <div className="p-4 flex flex-col gap-3">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What needs to get done?"
            className="w-full bg-transparent border-none outline-none resize-none text-lg font-medium text-[#F8FAFC] placeholder-[#64748B] min-h-[44px]"
            rows={1}
          />
          
          {/* Notes */}
          {showNotes && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={handleNotesKeyDown}
              placeholder="Add notes... (Shift+↓)"
              className="w-full bg-transparent border-none outline-none resize-none text-sm text-[#CBD5E1] placeholder-[#64748B] min-h-[60px]"
            />
          )}

          {/* Subtasks */}
          {showSubtasks && (
            <div className="flex flex-col gap-2">
              {subtasks.map((st, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border border-[#64748B]" />
                  <input
                    value={st}
                    onChange={(e) => updateSubtask(i, e.target.value)}
                    onPaste={(e) => handlePasteSubtasks(i, e)}
                    placeholder="Subtask..."
                    className="flex-1 bg-transparent border-none outline-none text-sm text-[#F8FAFC] placeholder-[#64748B]"
                  />
                </div>
              ))}
              <button 
                onClick={addSubtaskField}
                className="flex items-center gap-1 text-sm text-[#64748B] hover:text-[#F8FAFC] transition-colors self-start mt-1"
              >
                <Plus size={14} /> Add subtask
              </button>
            </div>
          )}

          {/* Explicit Form Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/[0.06] text-xs text-[#CBD5E1]">
            {/* Date & Time Picker */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} /> Due Date & Time
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="datetime-local"
                  value={dueDate ? dueDate.slice(0, 16) : ''}
                  onChange={(e) => setDueDate(e.target.value ? new Date(e.target.value).toISOString() : null)}
                  className="bg-[#111113] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#F8FAFC] focus:outline-none focus:border-blue-500 flex-1"
                />
                <button
                  type="button"
                  onClick={() => { const d = new Date(); d.setHours(23,59,59,999); setDueDate(d.toISOString()); }}
                  className="px-2 py-1.5 rounded-lg bg-white/[0.04] hover:bg-blue-600 hover:text-white text-[11px] font-medium transition"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(23,59,59,999); setDueDate(d.toISOString()); }}
                  className="px-2 py-1.5 rounded-lg bg-white/[0.04] hover:bg-blue-600 hover:text-white text-[11px] font-medium transition"
                >
                  Tomorrow
                </button>
              </div>
            </div>

            {/* Priority / Eisenhower Matrix Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                <Flag size={12} /> Priority & Eisenhower Matrix
              </label>
              <div className="flex items-center gap-1">
                {[
                  { id: 'P1', label: '🔴 P1 (Q1 Urgent)', color: 'border-red-500/50 bg-red-500/10 text-red-400' },
                  { id: 'P2', label: '🟠 P2 (Q2 High)', color: 'border-orange-500/50 bg-orange-500/10 text-orange-400' },
                  { id: 'P3', label: '🔵 P3 (Q3 Med)', color: 'border-blue-500/50 bg-blue-500/10 text-blue-400' },
                  { id: 'P4', label: '⚪ P4 (Q4 Low)', color: 'border-slate-500/50 bg-slate-500/10 text-slate-400' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold border transition active:scale-95 ${
                      (priority || parsedTask.priority) === p.id ? `${p.color} ring-1 ring-white/20` : 'border-white/[0.06] bg-[#111113] text-[#64748B] hover:text-[#CBD5E1]'
                    }`}
                  >
                    {p.id}
                  </button>
                ))}
              </div>
            </div>

            {/* List & Recurrence */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                  <FolderOpen size={12} /> List
                </label>
                <select
                  value={listId || ''}
                  onChange={(e) => setListId(e.target.value || null)}
                  className="bg-[#111113] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#F8FAFC] focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">(Inbox)</option>
                  {useTaskStore.getState().lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                  <Repeat size={12} /> Repeat / Recurrence
                </label>
                <select
                  value={recurrence || parsedTask.recurrence || 'NONE'}
                  onChange={(e) => setRecurrence(e.target.value)}
                  className="bg-[#111113] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#F8FAFC] focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="NONE">None</option>
                  <option value="DAILY">🔁 Daily (Every Day)</option>
                  <option value="WEEKLY">🔁 Weekly</option>
                  <option value="MONTHLY">🔁 Monthly</option>
                </select>
              </div>
            </div>

            {/* Tags Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                <Tag size={12} /> Tags
              </label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value && !selectedTags.includes(e.target.value)) {
                    setSelectedTags([...selectedTags, e.target.value]);
                  }
                }}
                className="bg-[#111113] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#F8FAFC] focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">+ Add Tag...</option>
                {useTaskStore.getState().tags.map((t) => (
                  <option key={t.id} value={t.name}>#{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Tag Badges */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-purple-500/20 text-purple-400">
                  #{tag}
                  <button type="button" onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))} className="hover:text-white">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* NLP Pills Track */}
          <div className="flex flex-wrap gap-2 mt-1">
            {parsedTask.priority && (
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono cursor-pointer transition-all active:scale-95 ${priorityColor[parsedTask.priority]}`}>
                <Flag size={12} /> {parsedTask.priority}
              </span>
            )}
            {parsedTask.dueDate && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono bg-blue-500/20 text-blue-400 cursor-pointer transition-all active:scale-95">
                <Calendar size={12} /> {parsedTask.dueDate}
              </span>
            )}
            {parsedTask.tags.map((tag: string) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono bg-purple-500/20 text-purple-400 cursor-pointer transition-all active:scale-95">
                <Tag size={12} /> {tag}
              </span>
            ))}
            {parsedTask.estimate && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono bg-green-500/20 text-green-400 cursor-pointer transition-all active:scale-95">
                <Timer size={12} /> {parsedTask.estimate}m
              </span>
            )}
            {parsedTask.listName && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono bg-yellow-500/20 text-yellow-400 cursor-pointer transition-all active:scale-95">
                <FolderOpen size={12} /> {parsedTask.listName}
              </span>
            )}
            {parsedTask.recurrence && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono bg-indigo-500/20 text-indigo-400 cursor-pointer transition-all active:scale-95">
                <Repeat size={12} /> {parsedTask.recurrence}
              </span>
            )}
          </div>
        </div>

        {/* Bottom Dock */}
        <div className="flex items-center justify-between p-3 bg-[#111113] border-t border-white/[0.06]">
          <div className="flex items-center gap-1 text-[#64748B]">
            {/* Date */}
            <div className="relative">
              <button onClick={() => togglePopover('date')} className={`p-1.5 rounded-lg transition-all active:scale-95 ${activePopover === 'date' || dueDate ? 'bg-white/[0.1] text-blue-400' : 'hover:bg-white/[0.06] hover:text-[#F8FAFC]'}`} title="Date">
                <Calendar size={16} />
              </button>
              {activePopover === 'date' && (
                <div className="absolute bottom-full mb-2 left-0 w-48 bg-[#1f1f23] border border-white/[0.1] rounded-lg shadow-xl p-2 flex flex-col gap-1 z-50">
                  <button onClick={() => { setDueDate(new Date().toISOString()); setActivePopover(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-[#F8FAFC]">Today</button>
                  <button onClick={() => { const d = new Date(); d.setDate(d.getDate()+1); setDueDate(d.toISOString()); setActivePopover(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-[#F8FAFC]">Tomorrow</button>
                  <button onClick={() => { const d = new Date(); d.setDate(d.getDate()+7); setDueDate(d.toISOString()); setActivePopover(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-[#F8FAFC]">Next Week</button>
                  <input type="date" onChange={(e) => { setDueDate(e.target.value ? new Date(e.target.value).toISOString() : null); setActivePopover(null); }} className="mt-1 bg-black/20 border border-white/[0.1] rounded px-2 py-1 text-sm text-[#F8FAFC]" />
                </div>
              )}
            </div>
            
            {/* Priority */}
            <div className="relative">
              <button onClick={() => togglePopover('priority')} className={`p-1.5 rounded-lg transition-all active:scale-95 ${activePopover === 'priority' || priority ? 'bg-white/[0.1] text-orange-400' : 'hover:bg-white/[0.06] hover:text-[#F8FAFC]'}`} title="Priority">
                <Flag size={16} />
              </button>
              {activePopover === 'priority' && (
                <div className="absolute bottom-full mb-2 left-0 w-36 bg-[#1f1f23] border border-white/[0.1] rounded-lg shadow-xl p-2 flex flex-col gap-1 z-50">
                  <button onClick={() => { setPriority('P1'); setActivePopover(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-red-400">🔴 P1 Urgent</button>
                  <button onClick={() => { setPriority('P2'); setActivePopover(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-orange-400">🟠 P2 High</button>
                  <button onClick={() => { setPriority('P3'); setActivePopover(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-blue-400">🔵 P3 Medium</button>
                  <button onClick={() => { setPriority('P4'); setActivePopover(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-gray-400">⚪ P4 Low</button>
                </div>
              )}
            </div>

            {/* List */}
            <div className="relative">
              <button onClick={() => togglePopover('list')} className={`p-1.5 rounded-lg transition-all active:scale-95 ${activePopover === 'list' || listId ? 'bg-white/[0.1] text-yellow-400' : 'hover:bg-white/[0.06] hover:text-[#F8FAFC]'}`} title="List">
                <FolderOpen size={16} />
              </button>
              {activePopover === 'list' && (
                <div className="absolute bottom-full mb-2 left-0 w-48 bg-[#1f1f23] border border-white/[0.1] rounded-lg shadow-xl p-2 flex flex-col gap-1 z-50 max-h-48 overflow-y-auto">
                  {useTaskStore.getState().lists?.map(l => (
                    <button key={l.id} onClick={() => { setListId(l.id); setActivePopover(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-[#F8FAFC] truncate">{l.name}</button>
                  ))}
                  {(!useTaskStore.getState().lists || useTaskStore.getState().lists.length === 0) && (
                    <div className="px-2 py-1.5 text-sm text-gray-500">No lists</div>
                  )}
                </div>
              )}
            </div>

            {/* Tag */}
            <div className="relative">
              <button onClick={() => togglePopover('tag')} className={`p-1.5 rounded-lg transition-all active:scale-95 ${activePopover === 'tag' || selectedTags.length > 0 ? 'bg-white/[0.1] text-purple-400' : 'hover:bg-white/[0.06] hover:text-[#F8FAFC]'}`} title="Tag">
                <Tag size={16} />
              </button>
              {activePopover === 'tag' && (
                <div className="absolute bottom-full mb-2 left-0 w-48 bg-[#1f1f23] border border-white/[0.1] rounded-lg shadow-xl p-2 flex flex-col gap-1 z-50 max-h-48 overflow-y-auto">
                  {useTaskStore.getState().tags?.map(t => (
                    <button key={t.id} onClick={() => { 
                      setSelectedTags(prev => prev.includes(t.name) ? prev.filter(x => x !== t.name) : [...prev, t.name]);
                    }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-[#F8FAFC] flex justify-between">
                      <span className="truncate">{t.name}</span>
                      {selectedTags.includes(t.name) && <CheckSquare size={14} className="text-blue-400" />}
                    </button>
                  ))}
                  {(!useTaskStore.getState().tags || useTaskStore.getState().tags.length === 0) && (
                    <div className="px-2 py-1.5 text-sm text-gray-500">No tags</div>
                  )}
                </div>
              )}
            </div>

            {/* Estimate */}
            <div className="relative">
              <button onClick={() => togglePopover('estimate')} className={`p-1.5 rounded-lg transition-all active:scale-95 ${activePopover === 'estimate' || estimate ? 'bg-white/[0.1] text-green-400' : 'hover:bg-white/[0.06] hover:text-[#F8FAFC]'}`} title="Estimate">
                <Timer size={16} />
              </button>
              {activePopover === 'estimate' && (
                <div className="absolute bottom-full mb-2 left-0 w-32 bg-[#1f1f23] border border-white/[0.1] rounded-lg shadow-xl p-2 flex flex-col gap-1 z-50">
                  {[15, 30, 45, 60, 90].map(mins => (
                    <button key={mins} onClick={() => { setEstimate(mins); setActivePopover(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-[#F8FAFC]">{mins}m</button>
                  ))}
                </div>
              )}
            </div>

            {/* Repeat */}
            <div className="relative">
              <button onClick={() => togglePopover('repeat')} className={`p-1.5 rounded-lg transition-all active:scale-95 ${activePopover === 'repeat' || recurrence ? 'bg-white/[0.1] text-indigo-400' : 'hover:bg-white/[0.06] hover:text-[#F8FAFC]'}`} title="Repeat">
                <Repeat size={16} />
              </button>
              {activePopover === 'repeat' && (
                <div className="absolute bottom-full mb-2 left-0 w-32 bg-[#1f1f23] border border-white/[0.1] rounded-lg shadow-xl p-2 flex flex-col gap-1 z-50">
                  <button onClick={() => { setRecurrence(null); setActivePopover(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-[#F8FAFC]">None</button>
                  <button onClick={() => { setRecurrence('DAILY'); setActivePopover(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-[#F8FAFC]">Daily</button>
                  <button onClick={() => { setRecurrence('WEEKLY'); setActivePopover(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-[#F8FAFC]">Weekly</button>
                  <button onClick={() => { setRecurrence('MONTHLY'); setActivePopover(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-white/[0.06] rounded text-[#F8FAFC]">Monthly</button>
                </div>
              )}
            </div>
            
            <div className="w-px h-4 bg-white/[0.06] mx-1"></div>
            <button 
              className={`p-1.5 rounded-lg transition-all active:scale-95 ${showNotes ? 'bg-white/[0.1] text-[#F8FAFC]' : 'hover:bg-white/[0.06] hover:text-[#F8FAFC]'}`}
              onClick={() => setShowNotes(!showNotes)}
              title="Notes"
            >
              Notes
            </button>
            <button 
              className={`p-1.5 rounded-lg transition-all active:scale-95 ${showSubtasks ? 'bg-white/[0.1] text-[#F8FAFC]' : 'hover:bg-white/[0.06] hover:text-[#F8FAFC]'}`}
              onClick={() => {
                setShowSubtasks(!showSubtasks);
                if (!showSubtasks && subtasks.length === 0) setSubtasks(['']);
              }}
              title="Subtasks"
            >
              <CheckSquare size={16} />
            </button>
          </div>
          
          <button 
            onClick={() => handleSubmit(false)}
            className="flex items-center gap-2 bg-[#3B82F6] hover:bg-blue-500 text-white font-semibold rounded-lg px-4 py-2 transition-all active:scale-95"
          >
            Create Task
            <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded ml-1 font-mono">Ctrl+Enter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
