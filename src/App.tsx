import React, { useEffect, useState } from 'react';
import {
  Home,
  Mic,
  MessageSquare,
  BarChart3,
  User,
  Loader2,
  AlertCircle,
  Play,
} from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from './lib/firebase.ts';
import { apiFetch } from './lib/api.ts';
import {
  DailyChallengeInfo,
  PracticeSession,
  QuestionItem,
  TabView,
  UserProfile,
} from './types/app.ts';
import { AuthGate } from './components/AuthGate.tsx';
import { HomeDashboard } from './components/HomeDashboard.tsx';
import { PracticeWorkspace } from './components/PracticeWorkspace.tsx';
import { ConversationView } from './components/ConversationView.tsx';
import { ProgressView } from './components/ProgressView.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { VocabularyView } from './components/VocabularyView.tsx';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todayChallenge, setTodayChallenge] = useState<DailyChallengeInfo | null>(null);
  const [activeSession, setActiveSession] = useState<PracticeSession | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<QuestionItem[]>([]);

  const [activeTab, setActiveTab] = useState<TabView>('home');
  const [loadingApp, setLoadingApp] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        await loadUserData();
      } else {
        setProfile(null);
        setActiveSession(null);
        setSessionQuestions([]);
      }
    });
    return () => unsub();
  }, []);

  const loadUserData = async () => {
    setLoadingApp(true);
    setGlobalError(null);
    try {
      const data = await apiFetch<{
        profile: UserProfile;
        todayChallenge: DailyChallengeInfo | null;
        activeSession: PracticeSession | null;
      }>('/api/me');

      setProfile(data.profile);
      setTodayChallenge(data.todayChallenge);

      if (data.activeSession) {
        await loadSessionById(data.activeSession.id, false);
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Could not connect to SpeakUp AI backend.');
    } finally {
      setLoadingApp(false);
    }
  };

  const loadSessionById = async (sessionId: number, switchToPractice = true) => {
    setGlobalError(null);
    try {
      const res = await apiFetch<{ session: PracticeSession; questions: QuestionItem[] }>(
        `/api/sessions/${sessionId}`
      );
      setActiveSession(res.session);
      setSessionQuestions(res.questions);
      if (switchToPractice) {
        setActiveTab('practice');
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to load practice session.');
    }
  };

  const handleStartSession = async (
    mode: 'level' | 'daily' | 'random',
    level: number
  ) => {
    setStartingSession(true);
    setGlobalError(null);
    try {
      const res = await apiFetch<{ session: PracticeSession; questions: QuestionItem[] }>(
        '/api/sessions/start',
        {
          method: 'POST',
          body: JSON.stringify({ mode, level }),
        }
      );
      setActiveSession(res.session);
      setSessionQuestions(res.questions);
      setActiveTab('practice');
    } catch (err: any) {
      setGlobalError(err.message || 'Could not generate new practice questions.');
    } finally {
      setStartingSession(false);
    }
  };

  const handleSessionUpdated = (
    updatedSession: PracticeSession,
    updatedQuestion: QuestionItem,
    _unlockedLevel: number | null,
    profilePatch: Partial<UserProfile>
  ) => {
    setActiveSession(updatedSession);
    setSessionQuestions((prev) =>
      prev.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q))
    );
    setProfile((prev) => (prev ? { ...prev, ...profilePatch } : prev));
    if (updatedSession.mode === 'daily' && updatedSession.status === 'completed') {
      setTodayChallenge((prev) =>
        prev
          ? {
              ...prev,
              completed: true,
              averageScore: updatedSession.averageScore,
            }
          : prev
      );
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthGate />;
  }

  const navItems: Array<{ id: TabView; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'practice', label: 'Practice', icon: Mic },
    { id: 'conversation', label: 'Conversation', icon: MessageSquare },
    { id: 'progress', label: 'Progress', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-20 md:pb-8">
      {/* Clean 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {!logoFailed ? (
              <img
                src="/src/assets/images/speakup_emblem_1795169162013.jpg"
                alt="SpeakUp AI"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="w-9 h-9 rounded-xl object-cover border border-slate-200"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white">
                <Mic className="w-4 h-4" />
              </div>
            )}
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">
              SpeakUp AI
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => {
              const isActive =
                activeTab === item.id || (item.id === 'home' && activeTab === 'vocabulary');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 ${
                    isActive
                      ? 'text-blue-600 border-blue-600 font-semibold'
                      : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              disabled={startingSession || !profile}
              onClick={() =>
                profile && handleStartSession('level', profile.currentLevel)
              }
              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs sm:text-sm font-semibold hover:brightness-105 transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {startingSession ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Start Practice</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {globalError && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 flex items-center justify-between gap-3 text-sm text-rose-800">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{globalError}</span>
            </div>
            <button
              type="button"
              onClick={() => setGlobalError(null)}
              className="text-xs font-semibold text-rose-700 hover:underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {loadingApp || !profile ? (
          <div className="rounded-3xl bg-white border border-slate-200 p-12 flex flex-col items-center justify-center gap-3 text-slate-600">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
            <p className="text-sm font-medium">Loading your SpeakUp AI workspace...</p>
          </div>
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeDashboard
                profile={profile}
                todayChallenge={todayChallenge}
                activeSession={activeSession}
                startingSession={startingSession}
                onStartSession={handleStartSession}
                onResumeSession={(id) => loadSessionById(id, true)}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'practice' && (
              <PracticeWorkspace
                profile={profile}
                session={activeSession}
                questions={sessionQuestions}
                startingSession={startingSession}
                onStartSession={handleStartSession}
                onSessionUpdated={handleSessionUpdated}
              />
            )}

            {activeTab === 'conversation' && <ConversationView profile={profile} />}

            {activeTab === 'progress' && (
              <ProgressView
                profile={profile}
                onOpenSession={(id) => loadSessionById(id, true)}
              />
            )}

            {activeTab === 'vocabulary' && (
              <VocabularyView
                profile={profile}
                onBackHome={() => setActiveTab('home')}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                profile={profile}
                onProfileUpdated={(name) =>
                  setProfile((prev) => (prev ? { ...prev, name } : prev))
                }
                onNavigate={setActiveTab}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation (5 Tabs) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  isActive ? 'text-blue-600 font-semibold' : 'text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
