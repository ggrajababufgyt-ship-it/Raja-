import React, { useEffect, useState } from 'react';
import {
  Volume2,
  Lightbulb,
  BookOpenCheck,
  Send,
  RotateCcw,
  Trash2,
  ArrowRight,
  CheckCircle2,
  Award,
  Loader2,
  Sparkles,
  AlertCircle,
  Play,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { getLevelDefinition, LEVELS } from '../lib/levels.ts';
import { speakEnglishText } from '../lib/speech.ts';
import { PracticeSession, QuestionItem, UserProfile } from '../types/app.ts';
import { VoiceRecorder } from './VoiceRecorder.tsx';

interface PracticeWorkspaceProps {
  profile: UserProfile;
  session: PracticeSession | null;
  questions: QuestionItem[];
  startingSession: boolean;
  onStartSession: (mode: 'level' | 'daily' | 'random', level: number) => void;
  onSessionUpdated: (
    updatedSession: PracticeSession,
    updatedQuestion: QuestionItem,
    unlockedLevel: number | null,
    profilePatch: Partial<UserProfile>
  ) => void;
}

export const PracticeWorkspace: React.FC<PracticeWorkspaceProps> = ({
  profile,
  session,
  questions,
  startingSession,
  onStartSession,
  onSessionUpdated,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [usedVoice, setUsedVoice] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unlockedNotice, setUnlockedNotice] = useState<number | null>(null);

  const currentQuestion = questions[selectedIndex] || null;

  useEffect(() => {
    if (questions.length > 0) {
      const firstUnanswered = questions.findIndex((q) => !q.answeredAt);
      const nextIdx = firstUnanswered >= 0 ? firstUnanswered : 0;
      setSelectedIndex(nextIdx);
    }
  }, [session?.id]);

  useEffect(() => {
    if (currentQuestion) {
      setAnswerText(currentQuestion.userAnswer || '');
      setUsedVoice(currentQuestion.inputMode === 'voice');
      setShowHint(false);
      setShowExample(false);
      setErrorMsg(null);
    }
  }, [currentQuestion?.id]);

  const handleListen = async (text: string, idKey: string) => {
    setSpeakingText(idKey);
    try {
      await speakEnglishText(text);
    } finally {
      setSpeakingText(null);
    }
  };

  const handleSubmit = async () => {
    if (!currentQuestion) return;
    const trimmed = answerText.trim();
    if (!trimmed) {
      setErrorMsg('Please speak or type your English answer before submitting.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await apiFetch<{
        question: QuestionItem;
        session: PracticeSession;
        unlockedLevel: number | null;
        profileUpdate: Partial<UserProfile>;
      }>(`/api/questions/${currentQuestion.id}/answer`, {
        method: 'POST',
        body: JSON.stringify({
          userAnswer: trimmed,
          inputMode: usedVoice ? 'voice' : 'text',
        }),
      });

      if (result.unlockedLevel) {
        setUnlockedNotice(result.unlockedLevel);
      }

      onSessionUpdated(
        result.session,
        result.question,
        result.unlockedLevel,
        result.profileUpdate
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not evaluate your answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!session || questions.length === 0) {
    const unlockedLevels = LEVELS.filter(
      (l) => l.level <= profile.currentLevel || (profile.completedLevels || []).includes(l.level)
    );

    return (
      <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 space-y-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-medium text-blue-700">
            5 Unique Questions Per Session · Never Repeated
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Choose a Speaking Session
          </h1>
          <p className="text-sm text-slate-600">
            Every time you start, your AI teacher generates 5 brand-new questions tailored to your
            level and checks your history so you never repeat old prompts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {unlockedLevels.map((lvl) => (
            <button
              key={lvl.level}
              type="button"
              disabled={startingSession}
              onClick={() => onStartSession('level', lvl.level)}
              className="text-left rounded-2xl border border-slate-200 hover:border-blue-500 p-4 transition-all cursor-pointer flex items-center justify-between gap-3 disabled:opacity-60"
            >
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Level {lvl.level} · {lvl.cefr}
                </div>
                <div className="font-display font-bold text-slate-900">{lvl.title}</div>
              </div>
              <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                {startingSession ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const levelDef = getLevelDefinition(session.level);
  const completedCount = questions.filter((q) => q.answeredAt !== null).length;
  const sessionComplete = completedCount >= questions.length;
  const feedback = currentQuestion?.aiFeedback;

  return (
    <div className="space-y-6">
      {/* Session Header & Question Stepper */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-blue-700 flex items-center gap-2">
              <span>
                {session.mode === 'daily'
                  ? 'Daily English Challenge'
                  : session.mode === 'random'
                    ? 'Random Practice'
                    : `Level ${levelDef.level} · ${levelDef.title}`}
              </span>
              <span aria-hidden="true">·</span>
              <span>CEFR {levelDef.cefr}</span>
            </div>
            <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              Question {selectedIndex + 1} of {questions.length}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-600 tabular-nums">
              {completedCount}/{questions.length} Completed
            </span>
            <button
              type="button"
              disabled={startingSession}
              onClick={() => {
                setUnlockedNotice(null);
                onStartSession(session.mode, session.level);
              }}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {startingSession ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>New 5 Questions</span>
            </button>
          </div>
        </div>

        {/* 5-Question Stepper */}
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, idx) => {
            const isAnswered = q.answeredAt !== null;
            const isActive = idx === selectedIndex;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`min-h-[40px] rounded-xl px-2 py-2 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 tabular-nums ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                    : isAnswered
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Q{idx + 1}</span>
                {isAnswered && !isActive && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Session Complete Celebration Banner */}
      {sessionComplete && (
        <section className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-6 sm:p-7 shadow-lg shadow-blue-600/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-100">
                <Award className="w-4 h-4" />
                <span>Session Complete</span>
                {unlockedNotice && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Level {unlockedNotice} Unlocked!</span>
                  </>
                )}
              </div>
              <h2 className="font-display text-2xl font-bold">
                Great effort! Average Score: {session.averageScore ?? '—'}/10
              </h2>
              <p className="text-sm text-blue-100">
                Your answers, grammar feedback, and level progress are saved to your account.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {session.level < 10 &&
                (profile.currentLevel > session.level || unlockedNotice) && (
                  <button
                    type="button"
                    disabled={startingSession}
                    onClick={() => {
                      setUnlockedNotice(null);
                      onStartSession('level', Math.min(10, session.level + 1));
                    }}
                    className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-indigo-700 font-semibold text-sm hover:bg-blue-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>Start Level {Math.min(10, session.level + 1)}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

              <button
                type="button"
                disabled={startingSession}
                onClick={() => {
                  setUnlockedNotice(null);
                  onStartSession(session.mode, session.level);
                }}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry with Fresh Questions</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Question & Input Workspace */}
      {currentQuestion && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Question + Voice/Text Input */}
          <div className="lg:col-span-7 space-y-5">
            <section className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-500">
                  Topic: <span className="text-slate-800 font-semibold">{currentQuestion.topic}</span>
                </span>

                <button
                  type="button"
                  onClick={() => handleListen(currentQuestion.questionText, 'question')}
                  className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{speakingText === 'question' ? 'Playing...' : 'Listen Question'}</span>
                </button>
              </div>

              <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                {currentQuestion.questionText}
              </h2>

              {/* Hint & Optional Example Answer Toggles */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {currentQuestion.hintText && (
                  <button
                    type="button"
                    onClick={() => setShowHint((v) => !v)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    <span>{showHint ? 'Hide Hint' : 'Need a Hint?'}</span>
                  </button>
                )}

                {currentQuestion.exampleAnswer && (
                  <button
                    type="button"
                    onClick={() => setShowExample((v) => !v)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <BookOpenCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{showExample ? 'Hide Example' : 'Example Answer'}</span>
                  </button>
                )}
              </div>

              {showHint && currentQuestion.hintText && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-950">
                  <div className="text-xs font-semibold text-amber-800 mb-1">Speaking Hint</div>
                  <p>{currentQuestion.hintText}</p>
                </div>
              )}

              {showExample && currentQuestion.exampleAnswer && (
                <div className="rounded-2xl bg-indigo-50 border border-indigo-200 p-4 text-sm text-indigo-950 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-indigo-800">
                      Sample Answer (Speak in your own words!)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleListen(currentQuestion.exampleAnswer!, 'example')}
                      className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Listen</span>
                    </button>
                  </div>
                  <p>{currentQuestion.exampleAnswer}</p>
                </div>
              )}
            </section>

            {/* Voice & Text Answer Box */}
            <section className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 space-y-5">
              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Your Spoken or Written Answer
                </h3>
                <p className="text-xs text-slate-500">
                  Tap the microphone to speak in English, edit any recognized words if needed, or
                  type your answer directly.
                </p>
              </div>

              <VoiceRecorder
                currentText={answerText}
                onTranscriptUpdate={(txt, voiceFlag) => {
                  setAnswerText(txt);
                  if (voiceFlag) setUsedVoice(true);
                }}
                disabled={submitting}
              />

              <div className="space-y-2">
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  rows={5}
                  placeholder="Speak using the microphone above, or type your English answer here..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none p-4 text-base text-slate-900 placeholder:text-slate-400 transition-all resize-y"
                />
                <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
                  <span>{answerText.length} characters</span>
                  <span>
                    {answerText.trim()
                      ? `${answerText.trim().split(/\s+/).length} words`
                      : '0 words'}
                  </span>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  disabled={submitting || !answerText}
                  onClick={() => {
                    setAnswerText('');
                    setUsedVoice(false);
                    setErrorMsg(null);
                  }}
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Answer</span>
                </button>

                <button
                  type="button"
                  disabled={submitting || !answerText.trim()}
                  onClick={handleSubmit}
                  className="min-h-[48px] inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-md shadow-blue-600/20 hover:brightness-105 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>AI Teacher Checking...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{feedback ? 'Re-Check Answer' : 'Submit Answer'}</span>
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>

          {/* Right Column: AI Teacher Feedback Panel */}
          <div className="lg:col-span-5">
            {feedback ? (
              <section className="rounded-3xl bg-white border border-slate-200 p-6 space-y-5">
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <div className="text-xs font-medium text-indigo-700">AI Teacher Evaluation</div>
                    <h3 className="font-display text-xl font-bold text-slate-900">
                      Overall Score: <span className="tabular-nums">{currentQuestion.overallScore}/10</span>
                    </h3>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center font-display font-bold text-lg tabular-nums">
                    {currentQuestion.overallScore}
                  </div>
                </div>

                {/* 3 Sub-Scores */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                    <div className="text-[11px] font-medium text-slate-500">Grammar</div>
                    <div className="font-display text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                      {currentQuestion.grammarScore}/10
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                    <div className="text-[11px] font-medium text-slate-500">Vocabulary</div>
                    <div className="font-display text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                      {currentQuestion.vocabularyScore}/10
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                    <div className="text-[11px] font-medium text-slate-500">Structure</div>
                    <div className="font-display text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                      {currentQuestion.structureScore}/10
                    </div>
                  </div>
                </div>

                <div className="space-y-4 text-sm">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-1">
                      What You Meant
                    </div>
                    <p className="text-slate-700 leading-relaxed">{feedback.understandingNote}</p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-1">
                    <div className="text-xs font-semibold text-slate-500">Your Original Answer</div>
                    <p className="text-slate-800">{currentQuestion.userAnswer}</p>
                  </div>

                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-emerald-800">Correct Sentence</span>
                      <button
                        type="button"
                        onClick={() => handleListen(feedback.correctedSentence, 'corrected')}
                        className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{speakingText === 'corrected' ? 'Playing...' : 'Pronounce'}</span>
                      </button>
                    </div>
                    <p className="font-medium text-emerald-950">{feedback.correctedSentence}</p>
                  </div>

                  {feedback.incorrectWords && feedback.incorrectWords.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-500">Word Corrections</div>
                      <div className="space-y-2">
                        {feedback.incorrectWords.map((item, i) => (
                          <div
                            key={i}
                            className="rounded-xl border border-slate-200 p-3 text-xs space-y-1"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="line-through text-rose-700 font-medium">
                                {item.wrong}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="text-emerald-700 font-semibold">{item.correct}</span>
                            </div>
                            <p className="text-slate-600">{item.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 space-y-1">
                    <div className="text-xs font-semibold text-blue-800">
                      Explanation (Simple Hindi)
                    </div>
                    <p className="text-blue-950 leading-relaxed">{feedback.hindiExplanation}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">
                        More Natural English Version
                      </span>
                      <button
                        type="button"
                        onClick={() => handleListen(feedback.naturalVersion, 'natural')}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Listen</span>
                      </button>
                    </div>
                    <p className="text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      {feedback.naturalVersion}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">
                        Example of a Better Answer
                      </span>
                      <button
                        type="button"
                        onClick={() => handleListen(feedback.betterAnswer, 'better')}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Listen</span>
                      </button>
                    </div>
                    <p className="text-slate-800 bg-indigo-50/70 border border-indigo-200 rounded-xl p-3">
                      {feedback.betterAnswer}
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 italic pt-1">{feedback.encouragement}</p>
                </div>

                {selectedIndex < questions.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIndex(selectedIndex + 1)}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <span>Next Question (Q{selectedIndex + 2})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </section>
            ) : (
              <section className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  AI Teacher Feedback Ready
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Speak or write your answer and tap <span className="font-semibold">Submit Answer</span>.
                  Your teacher will analyze:
                </p>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li>1. Meaning &amp; clear communication (not memorized scripts)</li>
                  <li>2. Grammar, tense &amp; word corrections</li>
                  <li>3. Easy-to-read explanation in simple Hindi</li>
                  <li>4. Natural English &amp; higher-fluency example answers</li>
                  <li>5. Grammar, Vocabulary &amp; Structure scores out of 10</li>
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
