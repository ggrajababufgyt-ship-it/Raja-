import React, { useState } from 'react';
import { Mic, BookOpen, MessageSquare, Sparkles, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export const AuthGate: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [logoImgFailed, setLogoImgFailed] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      setError(err?.message || 'Sign in failed. Please allow popups and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="w-full bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            {!logoImgFailed ? (
              <img
                src="/src/assets/images/speakup_emblem_1795169162013.jpg"
                alt="SpeakUp AI emblem"
                referrerPolicy="no-referrer"
                onError={() => setLogoImgFailed(true)}
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
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <span className="whitespace-nowrap shrink-0">10 Fluency Levels</span>
            <span className="whitespace-nowrap shrink-0">Voice &amp; Text Coach</span>
            <span className="whitespace-nowrap shrink-0">Hindi Explanations</span>
            <span className="whitespace-nowrap shrink-0">Live Conversation</span>
          </nav>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <div className="text-sm font-medium text-blue-700 flex items-center gap-2">
                <span>English Speaking Challenge</span>
                <span aria-hidden="true">·</span>
                <span>Levels 1 to 10</span>
              </div>

              <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 text-balance leading-[1.12]">
                Speak English. Think Better. Become Fluent.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                Practice with your personal AI English-speaking teacher. Every session generates 5
                completely fresh questions, listens to your voice or typed answers, explains grammar
                mistakes in simple Hindi, and unlocks new fluency levels as you grow.
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="min-h-[48px] inline-flex items-center justify-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-semibold text-base shadow-lg shadow-blue-600/20 hover:shadow-xl hover:brightness-105 transition-all cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5" />
                  )}
                  <span>{loading ? 'Connecting Account...' : 'Continue with Google to Start'}</span>
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 max-w-xl">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Mic className="w-4 h-4 text-blue-600" />
                    <span>Zero Repeat Questions</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Database-tracked question history guarantees 5 fresh prompts every session.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    <span>Simple Hindi Feedback</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Grammar corrections, natural phrasing, and score breakdowns out of 10.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    <span>AI Conversation Mode</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Natural multi-turn speaking practice with smart follow-up questions.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 flex">
              <div className="w-full rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-sm flex flex-col">
                <div className="relative flex-1 min-h-[240px] bg-slate-100">
                  {!heroImgFailed ? (
                    <img
                      src="/src/assets/images/fluency_studio_hero_1795169161598.jpg"
                      alt="SpeakUp AI acoustic studio illustration"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 text-center">
                      <Sparkles className="w-10 h-10 text-blue-600 mb-3" />
                      <p className="font-display font-bold text-slate-900">SpeakUp AI Studio</p>
                    </div>
                  )}
                </div>
                <div className="p-6 space-y-3 bg-white border-t border-slate-100">
                  <div className="text-xs font-medium text-slate-500">
                    Sample Teacher Correction
                  </div>
                  <div className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Your Answer:</span> I am watching
                    movie in free time.
                  </div>
                  <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                    <span className="font-semibold">Correct:</span> I watch movies in my free time.
                    <div className="text-xs text-emerald-700 mt-1">
                      Regular habits ke liye simple present tense use hota hai.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
