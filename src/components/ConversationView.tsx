import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Send,
  Volume2,
  Plus,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { LEVELS } from '../lib/levels.ts';
import { speakEnglishText } from '../lib/speech.ts';
import { ConversationMessage, ConversationThread, UserProfile } from '../types/app.ts';
import { VoiceRecorder } from './VoiceRecorder.tsx';

interface ConversationViewProps {
  profile: UserProfile;
}

const PRESET_TOPICS = [
  'Everyday Life & Hobbies',
  'Job Interview & Career Goals',
  'Ordering Food & Travel Stories',
  'Technology & Modern Habits',
  'Movies, Music & Books',
  'Handling Difficult Situations',
];

export const ConversationView: React.FC<ConversationViewProps> = ({ profile }) => {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [activeThread, setActiveThread] = useState<ConversationThread | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [topicInput, setTopicInput] = useState(PRESET_TOPICS[0]);
  const [selectedLevel, setSelectedLevel] = useState(profile.currentLevel || 3);
  const [userInput, setUserInput] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const loadThreads = async () => {
    setLoadingThreads(true);
    try {
      const res = await apiFetch<{ conversations: ConversationThread[] }>('/api/conversations');
      setThreads(res.conversations);
      if (res.conversations.length > 0 && !activeThread) {
        await openThread(res.conversations[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not load conversation history.');
    } finally {
      setLoadingThreads(false);
    }
  };

  const openThread = async (id: number) => {
    setErrorMsg(null);
    try {
      const res = await apiFetch<{
        conversation: ConversationThread;
        messages: ConversationMessage[];
      }>(`/api/conversations/${id}`);
      setActiveThread(res.conversation);
      setMessages(res.messages);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to open conversation.');
    }
  };

  const startConversation = async (customTopic?: string) => {
    setStarting(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{
        conversation: ConversationThread;
        messages: ConversationMessage[];
      }>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({
          topic: (customTopic || topicInput).trim() || 'Everyday Life & Hobbies',
          level: selectedLevel,
        }),
      });
      setThreads((prev) => [res.conversation, ...prev]);
      setActiveThread(res.conversation);
      setMessages(res.messages);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start AI conversation.');
    } finally {
      setStarting(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeThread || !userInput.trim() || sending) return;

    const text = userInput.trim();
    setUserInput('');
    setSending(true);
    setErrorMsg(null);

    try {
      const res = await apiFetch<{
        userMessage: ConversationMessage;
        aiMessage: ConversationMessage;
      }>(`/api/conversations/${activeThread.id}/message`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });

      setMessages((prev) => [...prev, res.userMessage, res.aiMessage]);
    } catch (err: any) {
      setUserInput(text);
      setErrorMsg(err.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Sidebar: New Conversation & Past Chats */}
      <aside className="lg:col-span-4 space-y-4">
        <div className="rounded-3xl bg-white border border-slate-200 p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-slate-900">
              New AI Conversation
            </h2>
            <p className="text-xs text-slate-600">
              Speak naturally with an AI partner who remembers context, corrects mistakes politely,
              and asks smart follow-ups.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Conversation Topic
              </label>
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="e.g. Weekend plans, Job interview..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESET_TOPICS.slice(0, 4).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopicInput(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    topicInput === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Speaking Level
              </label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
              >
                {LEVELS.map((l) => (
                  <option key={l.level} value={l.level}>
                    Level {l.level} – {l.title} ({l.cefr})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={starting}
              onClick={() => startConversation()}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:brightness-105 transition-all cursor-pointer disabled:opacity-60"
            >
              {starting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>{starting ? 'Starting Chat...' : 'Start New Conversation'}</span>
            </button>
          </div>
        </div>

        {/* Saved Threads */}
        <div className="rounded-3xl bg-white border border-slate-200 p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-slate-900">Recent Conversations</h3>
          {loadingThreads ? (
            <div className="text-xs text-slate-500 py-3">Loading conversations...</div>
          ) : threads.length === 0 ? (
            <div className="text-xs text-slate-500 py-2">
              No conversations yet. Start your first natural English chat above.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
              {threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openThread(t.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    activeThread?.id === t.id
                      ? 'bg-blue-50 text-blue-900 border border-blue-200 font-semibold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="truncate">{t.topic}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Level {t.level}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Conversation Stream */}
      <section className="lg:col-span-8 rounded-3xl bg-white border border-slate-200 flex flex-col min-h-[540px] max-h-[75vh]">
        {activeThread ? (
          <>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-indigo-700">
                  AI Conversation Partner · Level {activeThread.level}
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {activeThread.topic}
                </h2>
              </div>
              <MessageSquare className="w-5 h-5 text-blue-600 shrink-0" />
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  } space-y-1.5`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    <p>{msg.content}</p>

                    {msg.role === 'ai' && (
                      <button
                        type="button"
                        onClick={() => speakEnglishText(msg.content)}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Listen</span>
                      </button>
                    )}
                  </div>

                  {msg.role === 'ai' && (msg.correction || msg.hindiTip) && (
                    <div className="max-w-[85%] rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-950 space-y-1">
                      {msg.correction && (
                        <div>
                          <span className="font-semibold text-amber-900">Polite Correction: </span>
                          <span>{msg.correction}</span>
                        </div>
                      )}
                      {msg.hindiTip && <div className="text-amber-800">{msg.hindiTip}</div>}
                    </div>
                  )}
                </div>
              ))}

              {sending && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Teacher is replying...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={handleSendMessage}
              className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 rounded-b-3xl space-y-3"
            >
              {errorMsg && (
                <div className="flex items-center gap-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <VoiceRecorder
                  compact
                  currentText={userInput}
                  onTranscriptUpdate={(txt) => setUserInput(txt)}
                  disabled={sending}
                />

                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Speak or type your reply in full sentences..."
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 outline-none"
                />

                <button
                  type="submit"
                  disabled={sending || !userInput.trim()}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md">
              <h2 className="font-display text-xl font-bold text-slate-900">
                Real-Time AI English Conversation
              </h2>
              <p className="text-sm text-slate-600">
                Pick a topic on the left and start speaking. Your AI conversation partner listens,
                remembers your answers, and naturally guides you toward longer sentences.
              </p>
            </div>
            <button
              type="button"
              disabled={starting}
              onClick={() => startConversation()}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Start Conversation Now</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
