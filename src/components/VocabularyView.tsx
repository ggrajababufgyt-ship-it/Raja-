import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Volume2,
  Sparkles,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { LEVELS } from '../lib/levels.ts';
import { speakEnglishText } from '../lib/speech.ts';
import { UserProfile, VocabWord } from '../types/app.ts';

interface VocabularyViewProps {
  profile: UserProfile;
  onBackHome: () => void;
}

export const VocabularyView: React.FC<VocabularyViewProps> = ({ profile, onBackHome }) => {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [selectedLevel, setSelectedLevel] = useState(profile.currentLevel || 1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ words: VocabWord[] }>('/api/vocabulary');
      setWords(res.words);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load vocabulary list.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate5Words = async () => {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ words: VocabWord[] }>('/api/vocabulary/generate', {
        method: 'POST',
        body: JSON.stringify({ level: selectedLevel }),
      });
      setWords((prev) => [...res.words, ...prev]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate new vocabulary words.');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleMastered = async (wordId: number) => {
    try {
      const res = await apiFetch<{ word: VocabWord }>(`/api/vocabulary/${wordId}/toggle`, {
        method: 'PATCH',
      });
      setWords((prev) => prev.map((w) => (w.id === wordId ? res.word : w)));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update word status.');
    }
  };

  const masteredCount = words.filter((w) => w.mastered).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Vocabulary Practice
            </h1>
            <p className="text-sm text-slate-600">
              Learn 5 practical English words at a time with pronunciation audio, simple Hindi
              meanings, and real-life example sentences.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(Number(e.target.value))}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 outline-none"
            >
              {LEVELS.map((l) => (
                <option key={l.level} value={l.level}>
                  Level {l.level} – {l.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={generating}
              onClick={handleGenerate5Words}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold shadow-sm hover:brightness-105 transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{generating ? 'Generating 5 Words...' : 'Learn 5 New Words'}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 pt-2 border-t border-slate-100 text-xs text-slate-600 tabular-nums">
          <span>Total Saved Words: {words.length}</span>
          <span aria-hidden="true">·</span>
          <span>Mastered: {masteredCount}</span>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </section>

      {loading ? (
        <div className="rounded-3xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-500">
          Loading your vocabulary notebook...
        </div>
      ) : words.length === 0 ? (
        <div className="rounded-3xl bg-white border border-slate-200 p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Start Your Vocabulary Builder
            </h2>
            <p className="text-sm text-slate-600">
              Tap &ldquo;Learn 5 New Words&rdquo; above to generate your first 5 English words with
              Hindi meanings and audio pronunciation.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {words.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border p-5 space-y-3 transition-all ${
                item.mastered ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-slate-500">
                    {item.partOfSpeech} · {item.pronunciation} · Level {item.level}
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                    {item.word}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => speakEnglishText(item.word)}
                    aria-label={`Pronounce ${item.word}`}
                    className="min-h-[40px] min-w-[40px] rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleMastered(item.id)}
                    className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      item.mastered
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {item.mastered ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mastered</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-3.5 h-3.5" />
                        <span>Mark Learned</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                <p className="text-slate-700">
                  <span className="font-semibold text-slate-900">Meaning: </span>
                  {item.englishMeaning}
                </p>
                <p className="text-indigo-900 bg-indigo-50/70 border border-indigo-100 rounded-xl px-3 py-2">
                  <span className="font-semibold">Hindi: </span>
                  {item.hindiMeaning}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-start justify-between gap-3">
                <p className="text-xs text-slate-600 italic leading-relaxed">
                  &ldquo;{item.exampleSentence}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => speakEnglishText(item.exampleSentence)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Hear</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
