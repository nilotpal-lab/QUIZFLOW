'use client';

import React, { useState } from 'react';
import { Sun, Moon, Bell, MessageSquare, ShieldCheck, Check } from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';

export const SettingsView: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { user, loadUser } = useAuthStore();
  const [reminderLeadMins, setReminderLeadMins] = useState(user?.reminderLeadMins || 15);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveSettings = async () => {
    try {
      await api.updateSettings({ reminderLeadMins });
      await loadUser();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Settings</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Configure your personal preferences & integrations</p>
      </div>

      {/* Theme Card */}
      <div className="bg-white dark:bg-[#161622] p-5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Appearance Mode</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Toggle between Light and Dark interface styles</p>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold transition text-slate-800 dark:text-slate-200"
        >
          {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        </button>
      </div>

      {/* Reminder Timing Card */}
      <div className="bg-white dark:bg-[#161622] p-5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Task Reminder Lead Time</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose how early reminders are dispatched before task due time</p>
            </div>
          </div>

          {savedSuccess && (
            <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
              <Check className="w-4 h-4" /> Saved!
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          {[15, 30, 60].map((mins) => (
            <button
              key={mins}
              onClick={() => setReminderLeadMins(mins)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition ${
                reminderLeadMins === mins
                  ? 'bg-blue-600 border-blue-600 text-white shadow'
                  : 'border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-white/[0.04]'
              }`}
            >
              {mins} Minutes Before
            </button>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveSettings}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition"
          >
            Save Preferences
          </button>
        </div>
      </div>

      {/* WhatsApp Integration UI Placeholder Card */}
      <div className="bg-white dark:bg-[#161622] p-5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm space-y-3 opacity-90">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">WhatsApp Integration</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Coming Soon
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect your Meta WhatsApp Cloud API number to send "task: ..." messages & receive reminders
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-white/[0.02] rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <p className="font-medium text-slate-700 dark:text-slate-300">Feature Highlights (Phase 2):</p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px]">
            <li>Incoming parsing: Send "task: Hashtable practice tomorrow at 5pm" to create task via chrono-node NLP</li>
            <li>Outgoing reminders: Automated node-cron scheduled WhatsApp message when task is due</li>
          </ul>
        </div>
      </div>

      {/* System Status Card */}
      <div className="bg-white dark:bg-[#161622] p-5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            TaskFlow Privacy & API Status: Secure & Online (Port 5000)
          </span>
        </div>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      {/* Danger Zone: Account & Personal Data Deletion Card (Privacy Compliance) */}
      <div className="bg-red-500/5 dark:bg-red-500/10 p-5 rounded-2xl border border-red-500/20 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-500 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-red-700 dark:text-red-400">Danger Zone: Data Privacy & Account Deletion</h3>
              <p className="text-xs text-red-600/80 dark:text-red-300/70">Permanently delete your account and cascade-purge all tasks, habits, lists, and personal data</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-red-500/10">
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Logged in as <strong className="text-slate-900 dark:text-slate-200">{user?.username}</strong></span>
          <button
            onClick={async () => {
              if (window.confirm('⚠️ ARE YOU ABSOLUTELY SURE?\n\nThis action is permanent and cannot be undone. All your tasks, lists, habits, pomodoros, and account credentials will be permanently erased from the database.')) {
                const authStore = useAuthStore.getState();
                await authStore.deleteAccount();
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-red-500/20 active:scale-95"
          >
            Delete My Account & Purge Data
          </button>
        </div>
      </div>
    </div>
  );
};
