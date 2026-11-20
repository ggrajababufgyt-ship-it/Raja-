import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { and, desc, eq, asc } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import {
  conversationMessages,
  conversations,
  dailyChallenges,
  practiceSessions,
  questionHistory,
  users,
  vocabularyHistory,
} from './src/db/schema.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { AuthRequest, requireAuth } from './src/middleware/auth.ts';
import {
  evaluateSpeakingAnswer,
  generateConversationTurn,
  generateSpeechAudio,
  generateUniqueQuestions,
  generateVocabularyBatch,
  normalizeQuestionText,
  transcribeUserAudio,
} from './src/lib/gemini.ts';
import { getLevelDefinition } from './src/lib/levels.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const app = express();
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'SpeakUp AI' });
});

app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.user!;
    const user = await getOrCreateUser(
      authUser.uid,
      authUser.email || '',
      authUser.name,
      authUser.picture
    );

    const today = getTodayDateString();
    const todayChallenges = await db
      .select()
      .from(dailyChallenges)
      .where(
        and(eq(dailyChallenges.userId, user.id), eq(dailyChallenges.challengeDate, today))
      )
      .limit(1);

    const activeSessions = await db
      .select()
      .from(practiceSessions)
      .where(
        and(eq(practiceSessions.userId, user.id), eq(practiceSessions.status, 'active'))
      )
      .orderBy(desc(practiceSessions.createdAt))
      .limit(1);

    const avgScore =
      user.totalQuestionsAnswered > 0
        ? Math.round((user.totalScoreSum / user.totalQuestionsAnswered) * 10) / 10
        : 0;

    res.json({
      profile: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        currentLevel: user.currentLevel,
        completedLevels: user.completedLevels || [],
        streakCount: user.streakCount,
        lastPracticeDate: user.lastPracticeDate,
        totalQuestionsAnswered: user.totalQuestionsAnswered,
        averageScore: avgScore,
      },
      todayChallenge: todayChallenges[0] || null,
      activeSession: activeSessions[0] || null,
    });
  } catch (error: any) {
    console.error('Error in GET /api/me:', error);
    res.status(500).json({ error: error.message || 'Failed to load profile' });
  }
});

app.patch('/api/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.user!;
    const user = await getOrCreateUser(authUser.uid, authUser.email || '', authUser.name);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';
    if (!name) {
      return res.status(400).json({ error: 'Display name is required.' });
    }
    const updated = await db
      .update(users)
      .set({ name, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();

    res.json({ name: updated[0].name });
  } catch (error: any) {
    console.error('Error in PATCH /api/me:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.post('/api/sessions/start', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.user!;
    const user = await getOrCreateUser(authUser.uid, authUser.email || '', authUser.name);

    const mode: 'level' | 'daily' | 'random' =
      req.body?.mode === 'daily' || req.body?.mode === 'random' ? req.body.mode : 'level';
    const requestedLevel = Number(req.body?.level || user.currentLevel || 1);
    const level = Math.max(1, Math.min(10, Math.floor(requestedLevel)));

    const completedSet = new Set<number>(user.completedLevels || []);
    if (mode === 'level' && level > user.currentLevel && !completedSet.has(level)) {
      return res.status(403).json({
        error: `Level ${level} is locked. Complete Level ${user.currentLevel} first to unlock it.`,
      });
    }

    const today = getTodayDateString();
    if (mode === 'daily') {
      const existingDaily = await db
        .select()
        .from(dailyChallenges)
        .where(
          and(eq(dailyChallenges.userId, user.id), eq(dailyChallenges.challengeDate, today))
        )
        .limit(1);

      if (existingDaily.length > 0 && !req.body?.forceNew) {
        const existingQuestions = await db
          .select()
          .from(questionHistory)
          .where(eq(questionHistory.sessionId, existingDaily[0].sessionId))
          .orderBy(asc(questionHistory.orderIndex));
        const existingSession = await db
          .select()
          .from(practiceSessions)
          .where(eq(practiceSessions.id, existingDaily[0].sessionId))
          .limit(1);

        if (existingSession.length > 0 && existingQuestions.length > 0) {
          return res.json({
            session: existingSession[0],
            questions: existingQuestions,
          });
        }
      }
    }

    const pastRows = await db
      .select({ questionText: questionHistory.questionText })
      .from(questionHistory)
      .where(eq(questionHistory.userId, user.id));

    const previousQuestions = pastRows.map((r) => r.questionText);

    const generated = await generateUniqueQuestions({
      level,
      count: 5,
      previousQuestions,
      mode,
    });

    const createdSessions = await db
      .insert(practiceSessions)
      .values({
        userId: user.id,
        level,
        mode,
        status: 'active',
        questionsCount: 5,
        completedCount: 0,
      })
      .returning();

    const session = createdSessions[0];

    const questionValues = generated.map((q, idx) => ({
      userId: user.id,
      sessionId: session.id,
      questionUid: crypto.randomUUID(),
      level,
      topic: q.topic,
      questionText: q.questionText,
      normalizedHash: normalizeQuestionText(q.questionText),
      hintText: q.hintText,
      exampleAnswer: q.exampleAnswer,
      orderIndex: idx,
    }));

    const insertedQuestions = await db
      .insert(questionHistory)
      .values(questionValues)
      .returning();

    if (mode === 'daily') {
      await db.insert(dailyChallenges).values({
        userId: user.id,
        challengeDate: today,
        sessionId: session.id,
        completed: false,
      });
    }

    res.json({
      session,
      questions: insertedQuestions.sort((a, b) => a.orderIndex - b.orderIndex),
    });
  } catch (error: any) {
    console.error('Error in POST /api/sessions/start:', error);
    res.status(500).json({ error: error.message || 'Failed to start practice session' });
  }
});

app.get('/api/sessions/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.user!;
    const user = await getOrCreateUser(authUser.uid, authUser.email || '', authUser.name);
    const sessionId = Number(req.params.id);
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const sessions = await db
      .select()
      .from(practiceSessions)
      .where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, user.id)))
      .limit(1);

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Practice session not found' });
    }

    const questions = await db
      .select()
      .from(questionHistory)
      .where(eq(questionHistory.sessionId, sessionId))
      .orderBy(asc(questionHistory.orderIndex));

    res.json({ session: sessions[0], questions });
  } catch (error: any) {
    console.error('Error in GET /api/sessions/:id:', error);
    res.status(500).json({ error: 'Failed to load practice session' });
  }
});

app.post('/api/questions/:id/answer', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.user!;
    const user = await getOrCreateUser(authUser.uid, authUser.email || '', authUser.name);
    const questionId = Number(req.params.id);
    const userAnswer = typeof req.body?.userAnswer === 'string' ? req.body.userAnswer.trim() : '';
    const inputMode: 'voice' | 'text' = req.body?.inputMode === 'voice' ? 'voice' : 'text';

    if (!Number.isFinite(questionId) || !userAnswer) {
      return res.status(400).json({ error: 'Please provide an answer before submitting.' });
    }

    const qRows = await db
      .select()
      .from(questionHistory)
      .where(and(eq(questionHistory.id, questionId), eq(questionHistory.userId, user.id)))
      .limit(1);

    if (qRows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const question = qRows[0];
    const wasAlreadyAnswered = question.answeredAt !== null;

    const evaluation = await evaluateSpeakingAnswer({
      questionText: question.questionText,
      userAnswer,
      level: question.level,
    });

    const feedbackPayload = {
      understandingNote: evaluation.understandingNote,
      correctedSentence: evaluation.correctedSentence,
      incorrectWords: evaluation.incorrectWords,
      hindiExplanation: evaluation.hindiExplanation,
      naturalVersion: evaluation.naturalVersion,
      betterAnswer: evaluation.betterAnswer,
      encouragement: evaluation.encouragement,
    };

    const updatedQuestionRows = await db
      .update(questionHistory)
      .set({
        userAnswer,
        inputMode,
        grammarScore: evaluation.grammarScore,
        vocabularyScore: evaluation.vocabularyScore,
        structureScore: evaluation.structureScore,
        overallScore: evaluation.overallScore,
        aiFeedback: feedbackPayload,
        answeredAt: new Date(),
      })
      .where(eq(questionHistory.id, question.id))
      .returning();

    const sessionQuestions = await db
      .select()
      .from(questionHistory)
      .where(eq(questionHistory.sessionId, question.sessionId))
      .orderBy(asc(questionHistory.orderIndex));

    const answeredList = sessionQuestions.filter((q) => q.overallScore !== null);
    const completedCount = answeredList.length;
    const sessionAvg =
      completedCount > 0
        ? Math.round(
            (answeredList.reduce((acc, q) => acc + (q.overallScore || 0), 0) / completedCount) * 10
          ) / 10
        : 0;

    const sessionRows = await db
      .select()
      .from(practiceSessions)
      .where(eq(practiceSessions.id, question.sessionId))
      .limit(1);
    const session = sessionRows[0];
    const isNowComplete = completedCount >= (session?.questionsCount || 5);

    const updatedSessions = await db
      .update(practiceSessions)
      .set({
        completedCount,
        averageScore: sessionAvg,
        status: isNowComplete ? 'completed' : 'active',
        completedAt: isNowComplete ? new Date() : null,
      })
      .where(eq(practiceSessions.id, question.sessionId))
      .returning();

    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();
    let nextStreak = user.streakCount;
    if (user.lastPracticeDate !== today) {
      nextStreak = user.lastPracticeDate === yesterday ? user.streakCount + 1 : 1;
    }

    let nextTotalAnswered = user.totalQuestionsAnswered;
    let nextTotalScoreSum = user.totalScoreSum;
    if (!wasAlreadyAnswered) {
      nextTotalAnswered += 1;
      nextTotalScoreSum += evaluation.overallScore;
    } else if (question.overallScore !== null) {
      nextTotalScoreSum = nextTotalScoreSum - question.overallScore + evaluation.overallScore;
    }

    let nextCompletedLevels = Array.isArray(user.completedLevels) ? [...user.completedLevels] : [];
    let nextCurrentLevel = user.currentLevel;
    let unlockedLevel: number | null = null;

    if (isNowComplete && session && session.mode === 'level') {
      if (!nextCompletedLevels.includes(session.level)) {
        nextCompletedLevels.push(session.level);
        nextCompletedLevels.sort((a, b) => a - b);
      }
      if (session.level >= user.currentLevel && user.currentLevel < 10) {
        nextCurrentLevel = session.level + 1;
        unlockedLevel = nextCurrentLevel;
      }
    }

    if (isNowComplete && session && session.mode === 'daily') {
      await db
        .update(dailyChallenges)
        .set({ completed: true, averageScore: sessionAvg })
        .where(eq(dailyChallenges.sessionId, session.id));
    }

    await db
      .update(users)
      .set({
        streakCount: nextStreak,
        lastPracticeDate: today,
        totalQuestionsAnswered: nextTotalAnswered,
        totalScoreSum: nextTotalScoreSum,
        completedLevels: nextCompletedLevels,
        currentLevel: nextCurrentLevel,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    res.json({
      question: updatedQuestionRows[0],
      session: updatedSessions[0],
      unlockedLevel,
      profileUpdate: {
        currentLevel: nextCurrentLevel,
        completedLevels: nextCompletedLevels,
        streakCount: nextStreak,
        totalQuestionsAnswered: nextTotalAnswered,
        averageScore:
          nextTotalAnswered > 0 ? Math.round((nextTotalScoreSum / nextTotalAnswered) * 10) / 10 : 0,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/questions/:id/answer:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate answer' });
  }
});

app.get('/api/progress', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.user!;
    const user = await getOrCreateUser(authUser.uid, authUser.email || '', authUser.name);

    const sessions = await db
      .select()
      .from(practiceSessions)
      .where(eq(practiceSessions.userId, user.id))
      .orderBy(desc(practiceSessions.createdAt))
      .limit(20);

    const answeredQuestions = await db
      .select()
      .from(questionHistory)
      .where(eq(questionHistory.userId, user.id))
      .orderBy(desc(questionHistory.createdAt))
      .limit(100);

    const completedQs = answeredQuestions.filter((q) => q.overallScore !== null);
    const count = completedQs.length;
    const avg = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

    const grammarAvg = avg(completedQs.map((q) => q.grammarScore || 0));
    const vocabularyAvg = avg(completedQs.map((q) => q.vocabularyScore || 0));
    const structureAvg = avg(completedQs.map((q) => q.structureScore || 0));
    const overallAvg = avg(completedQs.map((q) => q.overallScore || 0));
    const voiceCount = completedQs.filter((q) => q.inputMode === 'voice').length;
    const confidenceScore =
      count > 0 ? Math.min(10, Math.round((overallAvg * 0.8 + (voiceCount / count) * 2) * 10) / 10) : 0;

    res.json({
      skills: {
        grammar: grammarAvg,
        vocabulary: vocabularyAvg,
        structure: structureAvg,
        confidence: confidenceScore,
        overall: overallAvg,
        voiceRatio: count > 0 ? Math.round((voiceCount / count) * 100) : 0,
      },
      sessions,
      recentQuestions: completedQs.slice(0, 15),
    });
  } catch (error: any) {
    console.error('Error in GET /api/progress:', error);
    res.status(500).json({ error: 'Failed to load progress report' });
  }
});

app.get('/api/conversations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.user!;
    const user = await getOrCreateUser(authUser.uid, authUser.email || '', authUser.name);

    const list = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, user.id))
      .orderBy(desc(conversations.createdAt))
      .limit(15);

    res.json({ conversations: list });
  } catch (error: any) {
    console.error('Error in GET /api/conversations:', error);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

app.post('/api/conversations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.user!;
    const user = await getOrCreateUser(authUser.uid, authUser.email || '', authUser.name);
    const topic =
      typeof req.body?.topic === 'string' && req.body.topic.trim()
        ? req.body.topic.trim()
        : 'Everyday Life & Hobbies';
    const level = Math.max(1, Math.min(10, Number(req.body?.level || user.currentLevel || 3)));
    const levelDef = getLevelDefinition(level);

    const created = await db
      .insert(conversations)
      .values({
        userId: user.id,
        topic,
        level,
      })
      .returning();

    const conversation = created[0];

    const openingTurn = await generateConversationTurn({
      topic,
      level,
      history: [],
      userMessage: `Start a warm, natural conversation on "${topic}" tailored to Level ${levelDef.level} (${levelDef.title}). Greet briefly and ask an open opening question.`,
    });

    const insertedMsg = await db
      .insert(conversationMessages)
      .values({
        conversationId: conversation.id,
        role: 'ai',
        content: openingTurn.reply,
        correction: null,
        hindiTip: null,
      })
      .returning();

    res.json({ conversation, messages: insertedMsg });
  } catch (error: any) {
    console.error('Error in POST /api/conversations:', error);
    res.status(500).json({ error: error.message || 'Failed to start conversation' });
  }
});

app.get('/api/conversations/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.user!;
    const user = await getOrCreateUser(authUser.uid, authUser.email || '', authUser.name);
    const convId = Number(req.params.id);
    if (!Number.isFinite(convId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const convRows = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, convId), eq(conversations.userId, user.id)))
      .limit(1);

    if (convRows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const msgs = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, convId))
      .orderBy(asc(conversationMessages.createdAt));

    res.json({ conversation: convRows[0], messages: msgs });
  } catch (error: any) {
    console.error('Error in GET /api/conversations/:id:', error);
    res.status(500).json({ error: 'Failed to load conversation' });
  }
});

app.post('/api/conversations/:id/message', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.user!;
    const user = await getOrCreateUser(authUser.uid, authUser.email || '', authUser.name);
    const convId = Number(req.params.id);
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';

    if (!Number.isFinite(convId) || !content) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const convRows = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, convId), eq(conversations.userId, user.id)))
      .limit(1);

    if (convRows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conv = convRows[0];
    const history = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, convId))
      .orderBy(asc(conversationMessages.createdAt));

    const userMsgRows = await db
      .insert(conversationMessages)
      .values({
        conversationId: convId,
        role: 'user',
        content,
      })
      .returning();

    const aiTurn = await generateConversationTurn({
      topic: conv.topic,
      level: conv.level,
      history: history.map((m) => ({
        role: m.role === 'ai' ? 'ai' : 'user',
        content: m.content,
      })),
      userMessage: content,
    });

    const aiMsgRows = await db
      .insert(conversationMessages)
      .values({
        conversationId: convId,
        role: 'ai',
        content: aiTurn.reply,
        correction: aiTurn.correction,
        hindiTip: aiTurn.hindiTip,
      })
      .returning();

    res.json({
      userMessage: userMsgRows[0],
      aiMessage: aiMsgRows[0],
    });
  } catch (error: any) {
    console.error('Error in POST /api/conversations/:id/message:', error);
    res.status(500).json({ error: error.message || 'Failed to continue conversation' });
  }
});

app.get('/api/vocabulary', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.user!;
    const user = await getOrCreateUser(authUser.uid, authUser.email || '', authUser.name);

    const words = await db
      .select()
      .from(vocabularyHistory)
      .where(eq(vocabularyHistory.userId, user.id))
      .orderBy(desc(vocabularyHistory.createdAt))
      .limit(50);

    res.json({ words });
  } catch (error: any) {
    console.error('Error in GET /api/vocabulary:', error);
    res.status(500).json({ error: 'Failed to load vocabulary' });
  }
});

app.post('/api/vocabulary/generate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.user!;
    const user = await getOrCreateUser(authUser.uid, authUser.email || '', authUser.name);
    const level = Math.max(1, Math.min(10, Number(req.body?.level || user.currentLevel || 1)));

    const existing = await db
      .select({ word: vocabularyHistory.word })
      .from(vocabularyHistory)
      .where(eq(vocabularyHistory.userId, user.id));

    const batch = await generateVocabularyBatch({
      level,
      existingWords: existing.map((e) => e.word),
    });

    const today = getTodayDateString();
    const inserted = await db
      .insert(vocabularyHistory)
      .values(
        batch.map((w) => ({
          userId: user.id,
          word: w.word,
          partOfSpeech: w.partOfSpeech,
          pronunciation: w.pronunciation,
          englishMeaning: w.englishMeaning,
          hindiMeaning: w.hindiMeaning,
          exampleSentence: w.exampleSentence,
          level,
          mastered: false,
          practiceDate: today,
        }))
      )
      .returning();

    res.json({ words: inserted });
  } catch (error: any) {
    console.error('Error in POST /api/vocabulary/generate:', error);
    res.status(500).json({ error: error.message || 'Failed to generate vocabulary words' });
  }
});

app.patch('/api/vocabulary/:id/toggle', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.user!;
    const user = await getOrCreateUser(authUser.uid, authUser.email || '', authUser.name);
    const wordId = Number(req.params.id);
    if (!Number.isFinite(wordId)) {
      return res.status(400).json({ error: 'Invalid word ID' });
    }

    const existing = await db
      .select()
      .from(vocabularyHistory)
      .where(and(eq(vocabularyHistory.id, wordId), eq(vocabularyHistory.userId, user.id)))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Word not found' });
    }

    const updated = await db
      .update(vocabularyHistory)
      .set({ mastered: !existing[0].mastered })
      .where(eq(vocabularyHistory.id, wordId))
      .returning();

    res.json({ word: updated[0] });
  } catch (error: any) {
    console.error('Error in PATCH /api/vocabulary/:id/toggle:', error);
    res.status(500).json({ error: 'Failed to update word status' });
  }
});

app.post('/api/speech/transcribe', requireAuth, async (req: AuthRequest, res) => {
  try {
    const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64 : '';
    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'audio/webm';
    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio payload is required.' });
    }
    const transcript = await transcribeUserAudio(audioBase64, mimeType);
    res.json({ transcript });
  } catch (error: any) {
    console.error('Error in POST /api/speech/transcribe:', error);
    res.status(500).json({ error: error.message || 'Audio transcription failed' });
  }
});

app.post('/api/speech/tts', requireAuth, async (req: AuthRequest, res) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 600) : '';
    if (!text) {
      return res.status(400).json({ error: 'Text is required for pronunciation.' });
    }
    const audioBase64 = await generateSpeechAudio(text);
    if (!audioBase64) {
      return res.status(502).json({ error: 'Audio synthesis did not return audio.' });
    }
    res.json({ audioBase64, mimeType: 'audio/wav' });
  } catch (error: any) {
    console.error('Error in POST /api/speech/tts:', error);
    res.status(500).json({ error: error.message || 'Pronunciation generation failed' });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SpeakUp AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
