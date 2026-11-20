export type TabView = 'home' | 'practice' | 'conversation' | 'progress' | 'profile' | 'vocabulary';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  currentLevel: number;
  completedLevels: number[];
  streakCount: number;
  lastPracticeDate: string | null;
  totalQuestionsAnswered: number;
  averageScore: number;
}

export interface PracticeSession {
  id: number;
  userId: number;
  level: number;
  mode: 'level' | 'daily' | 'random';
  status: 'active' | 'completed';
  questionsCount: number;
  completedCount: number;
  averageScore: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface IncorrectWordItem {
  wrong: string;
  correct: string;
  reason: string;
}

export interface AiFeedback {
  understandingNote: string;
  correctedSentence: string;
  incorrectWords: IncorrectWordItem[];
  hindiExplanation: string;
  naturalVersion: string;
  betterAnswer: string;
  encouragement: string;
}

export interface QuestionItem {
  id: number;
  userId: number;
  sessionId: number;
  questionUid: string;
  level: number;
  topic: string;
  questionText: string;
  hintText: string | null;
  exampleAnswer: string | null;
  orderIndex: number;
  userAnswer: string | null;
  inputMode: 'voice' | 'text' | null;
  grammarScore: number | null;
  vocabularyScore: number | null;
  structureScore: number | null;
  overallScore: number | null;
  aiFeedback: AiFeedback | null;
  answeredAt: string | null;
}

export interface DailyChallengeInfo {
  id: number;
  challengeDate: string;
  sessionId: number;
  completed: boolean;
  averageScore: number | null;
}

export interface ConversationThread {
  id: number;
  userId: number;
  topic: string;
  level: number;
  createdAt: string;
}

export interface ConversationMessage {
  id: number;
  conversationId: number;
  role: 'ai' | 'user';
  content: string;
  correction: string | null;
  hindiTip: string | null;
  createdAt: string;
}

export interface VocabWord {
  id: number;
  userId: number;
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  englishMeaning: string;
  hindiMeaning: string;
  exampleSentence: string;
  level: number;
  mastered: boolean;
  practiceDate: string;
}

export interface ProgressReport {
  skills: {
    grammar: number;
    vocabulary: number;
    structure: number;
    confidence: number;
    overall: number;
    voiceRatio: number;
  };
  sessions: PracticeSession[];
  recentQuestions: QuestionItem[];
}
