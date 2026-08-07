'use client';

import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { CheckCircle2, Lock, Mail, User as UserIcon } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { login, register, error } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || submitting) return;

    setSubmitting(true);
    try {
      if (isRegister) {
        await register({ username, password, name });
      } else {
        await login({ username, password });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#09090B]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#121217] border border-white/[0.06] rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-white">Welcome to TaskFlow</h1>
          <p className="text-xs text-slate-400">Your personal unlocked task & productivity workspace</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:bg-white/[0.05] transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Username</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:bg-white/[0.05] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:bg-white/[0.05] transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20"
          >
            {submitting ? 'Please wait...' : isRegister ? 'Create Personal Account' : 'Sign In'}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-blue-400 hover:text-blue-300 hover:underline font-semibold"
          >
            {isRegister ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>
      </div>
    </div>
  );
};
