import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface AiFeedbackPayload {
  understandingNote: string;
  correctedSentence: string;
  incorrectWords: Array<{
    wrong: string;
    correct: string;
    reason: string;
  }>;
  hindiExplanation: string;
  naturalVersion: string;
  betterAnswer: string;
  encouragement: string;
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull().default('Learner'),
  avatarUrl: text('avatar_url'),
  currentLevel: integer('current_level').notNull().default(1),
  completedLevels: jsonb('completed_levels').$type<number[]>().notNull().default([]),
  streakCount: integer('streak_count').notNull().default(0),
  lastPracticeDate: text('last_practice_date'),
  totalQuestionsAnswered: integer('total_questions_answered').notNull().default(0),
  totalScoreSum: real('total_score_sum').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const practiceSessions = pgTable('practice_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  level: integer('level').notNull(),
  mode: text('mode').notNull().default('level'), // 'level' | 'daily' | 'random'
  status: text('status').notNull().default('active'), // 'active' | 'completed'
  questionsCount: integer('questions_count').notNull().default(5),
  completedCount: integer('completed_count').notNull().default(0),
  averageScore: real('average_score'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const questionHistory = pgTable('question_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  sessionId: integer('session_id')
    .references(() => practiceSessions.id, { onDelete: 'cascade' })
    .notNull(),
  questionUid: text('question_uid').notNull(),
  level: integer('level').notNull(),
  topic: text('topic').notNull(),
  questionText: text('question_text').notNull(),
  normalizedHash: text('normalized_hash').notNull(),
  hintText: text('hint_text'),
  exampleAnswer: text('example_answer'),
  orderIndex: integer('order_index').notNull().default(0),
  userAnswer: text('user_answer'),
  inputMode: text('input_mode'), // 'voice' | 'text'
  grammarScore: real('grammar_score'),
  vocabularyScore: real('vocabulary_score'),
  structureScore: real('structure_score'),
  overallScore: real('overall_score'),
  aiFeedback: jsonb('ai_feedback').$type<AiFeedbackPayload | null>(),
  answeredAt: timestamp('answered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  topic: text('topic').notNull(),
  level: integer('level').notNull().default(3),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const conversationMessages = pgTable('conversation_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(), // 'ai' | 'user'
  content: text('content').notNull(),
  correction: text('correction'),
  hindiTip: text('hindi_tip'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const vocabularyHistory = pgTable('vocabulary_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  word: text('word').notNull(),
  partOfSpeech: text('part_of_speech').notNull(),
  pronunciation: text('pronunciation').notNull(),
  englishMeaning: text('english_meaning').notNull(),
  hindiMeaning: text('hindi_meaning').notNull(),
  exampleSentence: text('example_sentence').notNull(),
  level: integer('level').notNull().default(1),
  mastered: boolean('mastered').notNull().default(false),
  practiceDate: text('practice_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const dailyChallenges = pgTable('daily_challenges', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  challengeDate: text('challenge_date').notNull(),
  sessionId: integer('session_id')
    .references(() => practiceSessions.id, { onDelete: 'cascade' })
    .notNull(),
  completed: boolean('completed').notNull().default(false),
  averageScore: real('average_score'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(practiceSessions),
  questions: many(questionHistory),
  conversations: many(conversations),
  vocabulary: many(vocabularyHistory),
  dailyChallenges: many(dailyChallenges),
}));

export const practiceSessionsRelations = relations(practiceSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [practiceSessions.userId],
    references: [users.id],
  }),
  questions: many(questionHistory),
}));

export const questionHistoryRelations = relations(questionHistory, ({ one }) => ({
  user: one(users, {
    fields: [questionHistory.userId],
    references: [users.id],
  }),
  session: one(practiceSessions, {
    fields: [questionHistory.sessionId],
    references: [practiceSessions.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(conversationMessages),
}));

export const conversationMessagesRelations = relations(conversationMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationMessages.conversationId],
    references: [conversations.id],
  }),
}));
