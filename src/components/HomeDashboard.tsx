import React, { useState } from 'react';
import {
  Play,
  Flame,
  CheckCircle2,
  Lock,
  RotateCcw,
  Calendar,
  MessageSquare,
  BookOpen,
  Shuffle,
  ArrowRight,
  Award,
  Loader2,
} from 'lucide-react';
import { LEVELS, getLevelDefinition } from '../lib/levels.ts';
import { DailyChallengeInfo, PracticeSession, TabView, UserProfile } from '../types/app.ts';

interface HomeDashboardProps {
  profile: UserProfile;
  todayChallenge: DailyChallengeInfo | null;
  activeSession: PracticeSession | null;
  startingSession: boolean;
  onStartSession: (mode: 'level' | 'daily' | 'random', level: number) => void;
  onResumeSession: (sessionId: number) => void;
  onNavigate: (tab: TabView) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  profile,
  todayChallenge,
  activeSession,
  startingSession,
  onStartSession,
  onResumeSession,
  onNavigate,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const currentLevelDef = getLevelDefinition(profile.currentLevel);
  const completedSet = new Set(profile.completedLevels || []);
  const overallProgressPercent = Math.round((completedSet.size / 10) * 100);

  return (
    <div className="space-y-8">
      {/* Hero Banner & Primary CTA */}
      <section className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="text-xs sm:text-sm font-medium text-blue-700 flex flex-wrap items-center gap-2">
                <span>Level {currentLevelDef.level} · {currentLevelDef.title}</span>
                <span aria-hidden="true">·</span>
                <span>CEFR {currentLevelDef.cefr}</span>
              </div>

              <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 text-balance">
                Welcome back, {profile.name}
              </h1>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                Speak English. Think Better. Become Fluent. Practice 5 fresh AI-generated questions
                for <span className="font-semibold text-slate-900">{currentLevelDef.title}</span>{' '}
                and get instant grammar feedback in simple Hindi.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Overall Mastery Progress</span>
                <span className="tabular-nums font-semibold text-slate-900">
                  {completedSet.size}/10 Levels ({overallProgressPercent}%)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 transition-all duration-500"
                  style={{ width: `${Math.max(6, overallProgressPercent)}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                disabled={startingSession}
                onClick={() => onStartSession('level', profile.currentLevel)}
                className="min-h-[48px] inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-semibold text-sm sm:text-base shadow-md shadow-blue-600/20 hover:brightness-105 transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {startingSession ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>
                  {startingSession
                    ? 'Generating Fresh Questions...'
                    : `Start Level ${profile.currentLevel} Practice`}
                </span>
              </button>

              {activeSession && activeSession.status === 'active' && (
                <button
                  type="button"
                  onClick={() => onResumeSession(activeSession.id)}
                  className="min-h-[48px] inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>
                    Resume Level {activeSession.level} ({activeSession.completedCount}/5)
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[200px] bg-slate-100 border-t lg:border-t-0 lg:border-l border-slate-100">
            {!heroImgFailed ? (
              <img
                src="/src/assets/images/fluency_studio_hero_1795169161598.jpg"
                alt="SpeakUp AI studio microphone visual"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-6">
                <Award className="w-12 h-12 text-indigo-600" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4-Column Metric Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">Current Level</div>
          <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            Level {profile.currentLevel}
          </div>
          <div className="text-xs text-blue-700 font-medium truncate">{currentLevelDef.title}</div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span>Daily Streak</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {profile.streakCount} {profile.streakCount === 1 ? 'Day' : 'Days'}
          </div>
          <div className="text-xs text-slate-500">Practice daily to grow</div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">Questions Answered</div>
          <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {profile.totalQuestionsAnswered}
          </div>
          <div className="text-xs text-slate-500">Saved in your history</div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">Average Score</div>
          <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {profile.averageScore > 0 ? `${profile.averageScore}/10` : '—'}
          </div>
          <div className="text-xs text-slate-500">Grammar, Vocab &amp; Flow</div>
        </div>
      </section>

      {/* Feature Modes Row */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-slate-900">
            Daily &amp; Guided Modes
          </h2>
          <span className="text-xs text-slate-500">AI-powered English fluency tools</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            disabled={startingSession}
            onClick={() => onStartSession('daily', profile.currentLevel)}
            className="text-left rounded-2xl bg-white border border-slate-200 p-5 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-4 disabled:opacity-60"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="font-display text-base font-bold text-slate-900">
                Daily English Challenge
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                5 fresh real-world speaking prompts generated for today.
              </p>
            </div>
            <div className="text-xs font-semibold text-blue-600 flex items-center gap-1">
              <span>
                {todayChallenge?.completed
                  ? `Completed (${todayChallenge.averageScore ?? 0}/10)`
                  : todayChallenge
                    ? 'Continue Today’s 5 Questions'
                    : 'Start Today’s Challenge'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('conversation')}
            className="text-left rounded-2xl bg-white border border-slate-200 p-5 hover:border-indigo-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="font-display text-base font-bold text-slate-900">
                AI Conversation Mode
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Have a natural back-and-forth chat with smart follow-up questions.
              </p>
            </div>
            <div className="text-xs font-semibold text-indigo-600 flex items-center gap-1">
              <span>Open Conversation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('vocabulary')}
            className="text-left rounded-2xl bg-white border border-slate-200 p-5 hover:border-purple-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="font-display text-base font-bold text-slate-900">
                Vocabulary Practice
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Learn 5 new English words with Hindi meanings, audio &amp; examples.
              </p>
            </div>
            <div className="text-xs font-semibold text-purple-600 flex items-center gap-1">
              <span>Learn 5 Words</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          <button
            type="button"
            disabled={startingSession}
            onClick={() => onStartSession('random', profile.currentLevel)}
            className="text-left rounded-2xl bg-white border border-slate-200 p-5 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-4 disabled:opacity-60"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                <Shuffle className="w-5 h-5" />
              </div>
              <div className="font-display text-base font-bold text-slate-900">
                Random Practice
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Surprise mix of 5 fresh questions at Level {profile.currentLevel} difficulty.
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
              <span>Generate Random Mix</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      </section>

      {/* 10 Level Progression Grid */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              10-Level Fluency Roadmap
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Complete 5 unique questions in each level to unlock the next tier. Retry completed
              levels anytime with fresh questions.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {completedSet.size} of 10 Completed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {LEVELS.map((lvl) => {
            const isCompleted = completedSet.has(lvl.level);
            const isUnlocked = lvl.level <= profile.currentLevel || isCompleted;
            const isCurrent = lvl.level === profile.currentLevel && !isCompleted;

            return (
              <div
                key={lvl.level}
                className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all ${
                  isCurrent
                    ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500/15'
                    : isUnlocked
                      ? 'bg-white border-slate-200'
                      : 'bg-slate-100/70 border-slate-200/80 opacity-80'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-medium">
                    <span className="text-slate-500 tabular-nums">
                      Level {lvl.level} · CEFR {lvl.cefr} · 5 Questions
                    </span>
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Completed</span>
                      </span>
                    ) : isUnlocked ? (
                      <span className="text-blue-700 font-semibold">
                        {isCurrent ? 'Current' : 'Unlocked'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Locked</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900">{lvl.title}</h3>
                    <div className="text-xs font-medium text-indigo-700 mt-0.5">{lvl.subtitle}</div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{lvl.description}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500 truncate">
                    {lvl.topics.slice(0, 2).join(' · ')}
                  </span>

                  {isUnlocked ? (
                    <button
                      type="button"
                      disabled={startingSession}
                      onClick={() => onStartSession('level', lvl.level)}
                      className={`min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                        isCompleted
                          ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry Fresh</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Start Practice</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-slate-400 whitespace-nowrap shrink-0">
                      Complete Level {lvl.level - 1}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
