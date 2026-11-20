import { GoogleGenAI, Type } from '@google/genai';
import { getLevelDefinition } from './levels.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isQuestionTooSimilar(candidate: string, existingNormalized: string[]): boolean {
  const normCandidate = normalizeQuestionText(candidate);
  if (!normCandidate) return true;
  if (existingNormalized.includes(normCandidate)) return true;

  const candWords = new Set(normCandidate.split(' ').filter((w) => w.length > 2));
  if (candWords.size === 0) return true;

  for (const existing of existingNormalized) {
    const existingWords = new Set(existing.split(' ').filter((w) => w.length > 2));
    if (existingWords.size === 0) continue;
    let intersection = 0;
    for (const word of candWords) {
      if (existingWords.has(word)) intersection++;
    }
    const union = new Set([...candWords, ...existingWords]).size;
    const jaccard = intersection / union;
    if (jaccard >= 0.65) {
      return true;
    }
  }
  return false;
}

export interface GeneratedQuestion {
  questionText: string;
  topic: string;
  hintText: string;
  exampleAnswer: string;
}

export async function generateUniqueQuestions(params: {
  level: number;
  count: number;
  previousQuestions: string[];
  mode: 'level' | 'daily' | 'random';
}): Promise<GeneratedQuestion[]> {
  const ai = getAiClient();
  const levelDef = getLevelDefinition(params.level);
  const existingNormalized = params.previousQuestions.map(normalizeQuestionText);
  const accepted: GeneratedQuestion[] = [];
  const sessionNormalized = [...existingNormalized];

  for (let attempt = 0; attempt < 3 && accepted.length < params.count; attempt++) {
    const needed = params.count - accepted.length;
    const requestCount = attempt === 0 ? needed + 2 : needed + 3;
    const recentBlocklist = params.previousQuestions
      .slice(-80)
      .concat(accepted.map((a) => a.questionText));

    const modeNote =
      params.mode === 'daily'
        ? 'This is a Daily English Challenge: create engaging, timely real-world speaking prompts spanning practical daily life, opinions, and storytelling.'
        : params.mode === 'random'
          ? 'This is a Random Practice mix: surprise the learner with diverse, creative real-life scenarios and fresh topics.'
          : 'This is a structured level practice session.';

    const prompt = `Generate ${requestCount} genuinely distinct English speaking practice questions for:
Level ${levelDef.level}: ${levelDef.title} (CEFR ${levelDef.cefr})
Difficulty description: ${levelDef.description}
Suggested topic areas (vary across different real-life situations): ${levelDef.topics.join(', ')}, plus fresh everyday, cultural, career, or reflective topics matching ${levelDef.cefr}.
${modeNote}

STRICT RULES:
1. Every question MUST be genuinely different in meaning and structure from all previously asked questions below.
2. NEVER just swap 1 or 2 words of an existing question (e.g., do not change "What is your favorite food?" to "What is your favorite dish?").
3. Match the exact grammatical complexity and vocabulary depth of Level ${levelDef.level} (${levelDef.title}).
4. Include a helpful short speaking hint (hintText) and a natural, level-appropriate exampleAnswer for each question.

Previously asked questions to NEVER repeat or paraphrase:
${recentBlocklist.length > 0 ? recentBlocklist.map((q, i) => `${i + 1}. ${q}`).join('\n') : '(None yet - first session!)'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an expert ESL curriculum designer creating fresh, non-repetitive English speaking prompts.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              questionText: {
                type: Type.STRING,
                description: 'The fresh speaking question in clear English.',
              },
              topic: {
                type: Type.STRING,
                description: 'A short 2-3 word topic label.',
              },
              hintText: {
                type: Type.STRING,
                description: 'A helpful hint or sentence starter for the learner.',
              },
              exampleAnswer: {
                type: Type.STRING,
                description: 'A natural sample answer appropriate to the level.',
              },
            },
            required: ['questionText', 'topic', 'hintText', 'exampleAnswer'],
          },
        },
      },
    });

    const raw = (response.text ?? '[]').trim();
    const candidates: GeneratedQuestion[] = JSON.parse(raw);

    for (const candidate of candidates) {
      if (accepted.length >= params.count) break;
      if (!candidate.questionText) continue;
      if (!isQuestionTooSimilar(candidate.questionText, sessionNormalized)) {
        accepted.push({
          questionText: candidate.questionText.trim(),
          topic: (candidate.topic || 'General').trim(),
          hintText: (candidate.hintText || 'Speak naturally in 2-4 complete sentences.').trim(),
          exampleAnswer: (candidate.exampleAnswer || '').trim(),
        });
        sessionNormalized.push(normalizeQuestionText(candidate.questionText));
      }
    }
  }

  if (accepted.length < params.count) {
    throw new Error('Could not generate enough unique questions. Please try again.');
  }

  return accepted.slice(0, params.count);
}

export interface EvaluationResult {
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
  grammarScore: number;
  vocabularyScore: number;
  structureScore: number;
  overallScore: number;
}

export async function evaluateSpeakingAnswer(params: {
  questionText: string;
  userAnswer: string;
  level: number;
}): Promise<EvaluationResult> {
  const ai = getAiClient();
  const levelDef = getLevelDefinition(params.level);

  const prompt = `Evaluate this English learner's spoken/written answer.
Level: Level ${levelDef.level} - ${levelDef.title} (${levelDef.cefr})
Question asked: "${params.questionText}"
Learner's answer: "${params.userAnswer}"

CRITICAL EVALUATION RULES:
1. Understand what the learner wants to say first.
2. NEVER mark a grammatically correct and relevant answer wrong just because it differs from a sample answer or expresses a different personal opinion.
3. Identify grammar mistakes, vocabulary gaps, and sentence structure issues fairly according to their level.
4. Provide:
   - understandingNote: Briefly confirm what the learner meant.
   - correctedSentence: Fix any grammar/wording mistakes while keeping the learner's exact meaning. If already completely correct, keep it intact or polish punctuation.
   - incorrectWords: List specific wrong words/phrases and their corrections with short reasons (empty array if no errors).
   - hindiExplanation: Explain the mistakes (or praise what they did right) in simple, easy-to-understand Hinglish/Hindi (Roman script Hindi so every learner can read effortlessly, e.g., "Regular habits ke liye simple present tense use hota hai.").
   - naturalVersion: A smooth, natural everyday English way to say their exact answer.
   - betterAnswer: A richer, slightly more fluent example answer on this topic.
   - encouragement: Warm, motivating 1-sentence teacher feedback.
   - grammarScore, vocabularyScore, structureScore: Numbers from 1 to 10 (can have 1 decimal).
   - overallScore: Fair weighted average out of 10 (1 decimal).`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction:
        'You are SpeakUp AI, a supportive, accurate personal English speaking teacher who explains grammar clearly in simple Hindi (Hinglish) and evaluates meaning and fluency fairly.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          understandingNote: { type: Type.STRING },
          correctedSentence: { type: Type.STRING },
          incorrectWords: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                wrong: { type: Type.STRING },
                correct: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ['wrong', 'correct', 'reason'],
            },
          },
          hindiExplanation: { type: Type.STRING },
          naturalVersion: { type: Type.STRING },
          betterAnswer: { type: Type.STRING },
          encouragement: { type: Type.STRING },
          grammarScore: { type: Type.NUMBER },
          vocabularyScore: { type: Type.NUMBER },
          structureScore: { type: Type.NUMBER },
          overallScore: { type: Type.NUMBER },
        },
        required: [
          'understandingNote',
          'correctedSentence',
          'incorrectWords',
          'hindiExplanation',
          'naturalVersion',
          'betterAnswer',
          'encouragement',
          'grammarScore',
          'vocabularyScore',
          'structureScore',
          'overallScore',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as EvaluationResult;
  const clamp = (n: number) => Math.max(1, Math.min(10, Math.round(Number(n || 7) * 10) / 10));
  return {
    ...parsed,
    grammarScore: clamp(parsed.grammarScore),
    vocabularyScore: clamp(parsed.vocabularyScore),
    structureScore: clamp(parsed.structureScore),
    overallScore: clamp(parsed.overallScore),
  };
}

export interface ConversationTurnResult {
  reply: string;
  correction: string | null;
  hindiTip: string | null;
}

export async function generateConversationTurn(params: {
  topic: string;
  level: number;
  history: Array<{ role: 'ai' | 'user'; content: string }>;
  userMessage: string;
}): Promise<ConversationTurnResult> {
  const ai = getAiClient();
  const levelDef = getLevelDefinition(params.level);

  const historyText = params.history
    .slice(-12)
    .map((m) => `${m.role === 'ai' ? 'Teacher' : 'Learner'}: ${m.content}`)
    .join('\n');

  const prompt = `Topic: ${params.topic}
Learner Level: Level ${levelDef.level} (${levelDef.title}, ${levelDef.cefr})

Conversation so far:
${historyText || '(Start of conversation)'}
Learner just said: "${params.userMessage}"

Instructions:
1. Respond like a warm, curious real English-speaking conversation partner.
2. Reference what the learner just shared, ask ONE natural follow-up question that moves the conversation forward, and never repeat an already asked question.
3. Encourage the learner gently to elaborate in slightly longer sentences.
4. If the learner made a clear grammar mistake in their latest message, set "correction" to a polite corrected version of their sentence and "hindiTip" to a 1-sentence simple Hindi/Hinglish tip. If their sentence was natural and correct, set both "correction" and "hindiTip" to null.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction:
        'You are a friendly, attentive English conversation partner. Keep replies conversational, concise (2-3 sentences), and natural.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          correction: { type: Type.STRING, nullable: true },
          hindiTip: { type: Type.STRING, nullable: true },
        },
        required: ['reply', 'correction', 'hindiTip'],
      },
    },
  });

  return JSON.parse((response.text ?? '{}').trim()) as ConversationTurnResult;
}

export interface GeneratedVocabWord {
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  englishMeaning: string;
  hindiMeaning: string;
  exampleSentence: string;
}

export async function generateVocabularyBatch(params: {
  level: number;
  existingWords: string[];
}): Promise<GeneratedVocabWord[]> {
  const ai = getAiClient();
  const levelDef = getLevelDefinition(params.level);

  const prompt = `Generate 5 practical, high-value English vocabulary words for a learner at Level ${levelDef.level} (${levelDef.title}, ${levelDef.cefr}).
Do NOT repeat any of these words the learner already studied: ${params.existingWords.slice(-100).join(', ') || '(none)'}.

For each word provide:
- word: The English word or useful collocation
- partOfSpeech: noun, verb, adjective, adverb, or phrase
- pronunciation: Easy phonetic guide (e.g. "kuh-LEEG" or "/ˈkɒliːɡ/")
- englishMeaning: Clear, simple English definition
- hindiMeaning: Clear Hindi meaning (in Devanagari + simple Hinglish if helpful, e.g. "सहकर्मी (saath kaam karne wala)")
- exampleSentence: A natural, memorable everyday sentence using the word.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction: 'You are an expert English-Hindi vocabulary coach.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            pronunciation: { type: Type.STRING },
            englishMeaning: { type: Type.STRING },
            hindiMeaning: { type: Type.STRING },
            exampleSentence: { type: Type.STRING },
          },
          required: [
            'word',
            'partOfSpeech',
            'pronunciation',
            'englishMeaning',
            'hindiMeaning',
            'exampleSentence',
          ],
        },
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '[]').trim()) as GeneratedVocabWord[];
  return parsed.slice(0, 5);
}

export async function transcribeUserAudio(base64Audio: string, mimeType: string): Promise<string> {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-transcribe',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType || 'audio/webm',
            data: base64Audio,
          },
        },
        {
          text: 'Transcribe the spoken English accurately. Return only the transcribed text.',
        },
      ],
    },
  });
  return (response.text ?? '').trim();
}

export async function generateSpeechAudio(text: string): Promise<string | null> {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text,
            speechMetadata: {
              style: 'Warm, articulate, crystal-clear English teacher pronunciation',
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;
}
