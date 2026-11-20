import React, { useState } from 'react';
import { LogOut, Save, BookOpen, CheckCircle2, Award, Flame, Loader2 } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase.ts';
import { apiFetch } from '../lib/api.ts';
import { TabView, UserProfile } from '../types/app.ts';

interface ProfileViewProps {
  profile: UserProfile;
  onProfileUpdated: (name: string) => void;
  onNavigate: (tab: TabView) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  onProfileUpdated,
  onNavigate,
}) => {
  const [nameInput, setNameInput] = useState(profile.name);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setSaving(true);
    setSavedNotice(false);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ name: string }>('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed }),
      });
      onProfileUpdated(res.name);
      setSavedNotice(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not update display name.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <section className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.name}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-2xl object-cover border border-slate-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 text-white font-display font-bold text-2xl flex items-center justify-center">
              {profile.name.slice(0, 1).toUpperCase()}
            </div>
          )}

          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">{profile.name}</h1>
            <p className="text-sm text-slate-500">{profile.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-blue-600" />
              <span>Level</span>
            </div>
            <div className="font-display text-xl font-bold text-slate-900 tabular-nums mt-1">
              {profile.currentLevel}/10
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Streak</span>
            </div>
            <div className="font-display text-xl font-bold text-slate-900 tabular-nums mt-1">
              {profile.streakCount} Days
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Avg Score</div>
            <div className="font-display text-xl font-bold text-slate-900 tabular-nums mt-1">
              {profile.averageScore > 0 ? `${profile.averageScore}/10` : '—'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveName} className="space-y-3 pt-2 border-t border-slate-100">
          <label className="block text-sm font-semibold text-slate-900">Display Name</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={60}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
            />
            <button
              type="submit"
              disabled={saving || !nameInput.trim()}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Name</span>
            </button>
          </div>
          {savedNotice && (
            <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Profile updated and saved.</span>
            </p>
          )}
          {errorMsg && <p className="text-xs text-rose-600">{errorMsg}</p>}
        </form>
      </section>

      <section className="rounded-3xl bg-white border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="font-display text-base font-bold text-slate-900">
            Personal Vocabulary Notebook
          </h2>
          <p className="text-xs text-slate-600">
            Review saved English words, Hindi meanings, and pronunciation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('vocabulary')}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold cursor-pointer"
        >
          <BookOpen className="w-4 h-4" />
          <span>Open Vocabulary</span>
        </button>
      </section>

      <section className="rounded-3xl bg-white border border-slate-200 p-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900">Sign Out</h2>
          <p className="text-xs text-slate-600">
            Your progress, level unlocks, and question history remain safely saved.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </section>
    </div>
  );
};
