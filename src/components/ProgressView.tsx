import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Award,
  Mic,
  Volume2,
  ChevronDown,
  ChevronUp,
  Play,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { speakEnglishText } from '../lib/speech.ts';
import { ProgressReport, UserProfile } from '../types/app.ts';

interface ProgressViewProps {
  profile: UserProfile;
  onOpenSession: (sessionId: number) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ profile, onOpenSession }) => {
  const [report, setReport] = useState<ProgressReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiFetch<ProgressReport>('/api/progress');
      setReport(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not load progress report.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-500">
        Calculating your fluency metrics...
      </div>
    );
  }

  if (errorMsg || !report) {
    return (
      <div className="rounded-3xl bg-rose-50 border border-rose-200 p-6 flex items-center gap-3 text-sm text-rose-800">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>{errorMsg || 'Unable to load progress report.'}</span>
      </div>
    );
  }

  const skillBars = [
    { label: 'Grammar Accuracy', value: report.skills.grammar, color: 'from-blue-600 to-blue-500' },
    { label: 'Vocabulary Richness', value: report.skills.vocabulary, color: 'from-indigo-600 to-indigo-500' },
    { label: 'Sentence Structure', value: report.skills.structure, color: 'from-purple-600 to-purple-500' },
    { label: 'Speaking Confidence', value: report.skills.confidence, color: 'from-emerald-600 to-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-blue-700">
              Performance Analytics · Level {profile.currentLevel}
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Fluency Progress Report
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-700 tabular-nums">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Award className="w-4 h-4 text-indigo-600" />
              <span>Overall {report.skills.overall}/10</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-blue-600" />
              <span>Voice Answers: {report.skills.voiceRatio}%</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {skillBars.map((bar) => (
            <div key={bar.label} className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-900">{bar.label}</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {bar.value}/10
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${bar.color} transition-all duration-500`}
                  style={{ width: `${Math.min(100, bar.value * 10)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Practice Sessions */}
      <section className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Practice Session History
          </h2>
          <TrendingUp className="w-5 h-5 text-blue-600" />
        </div>

        {report.sessions.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">
            Complete your first 5-question practice session to see your session history here.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {report.sessions.map((sess) => (
              <div
                key={sess.id}
                className="py-3.5 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-900">
                    Level {sess.level} ·{' '}
                    {sess.mode === 'daily'
                      ? 'Daily Challenge'
                      : sess.mode === 'random'
                        ? 'Random Practice'
                        : 'Level Practice'}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {sess.completedCount}/{sess.questionsCount} answered ·{' '}
                    {new Date(sess.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {sess.averageScore !== null ? `${sess.averageScore}/10` : 'In Progress'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenSession(sess.id)}
                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>{sess.status === 'completed' ? 'Review' : 'Resume'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Answered Questions & Saved Teacher Feedback */}
      <section className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900">
          Answered Questions &amp; AI Feedback Archive
        </h2>

        {report.recentQuestions.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">
            Your answered questions and Hindi grammar explanations will appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {report.recentQuestions.map((q) => {
              const isOpen = expandedQ === q.id;
              return (
                <div key={q.id} className="rounded-2xl border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedQ(isOpen ? null : q.id)}
                    className="w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs text-slate-500">
                        Level {q.level} · {q.topic} · {q.inputMode === 'voice' ? 'Voice' : 'Text'}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {q.questionText}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-sm font-bold text-blue-700 tabular-nums">
                        {q.overallScore}/10
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {isOpen && q.aiFeedback && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/60 space-y-2.5 text-xs sm:text-sm">
                      <div>
                        <span className="font-semibold text-slate-700">Your Answer: </span>
                        <span className="text-slate-800">{q.userAnswer}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                        <div>
                          <span className="font-semibold">Correct: </span>
                          <span>{q.aiFeedback.correctedSentence}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => speakEnglishText(q.aiFeedback!.correctedSentence)}
                          className="text-emerald-800 hover:text-emerald-950 p-1 cursor-pointer shrink-0"
                          aria-label="Listen corrected sentence"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-blue-950 bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <span className="font-semibold">Hindi Tip: </span>
                        <span>{q.aiFeedback.hindiExplanation}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
