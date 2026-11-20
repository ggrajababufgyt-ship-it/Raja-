import { GoogleGenAI, Type } from '@google/genai';

interface NetlifyEvent {
  httpMethod: string;
  path: string;
  body: string | null;
  headers: Record<string, string | undefined>;
}

interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDuplicate(candidate: string, existing: string[]): boolean {
  const norm = normalizeQuestion(candidate);
  if (!norm) return true;
  if (existing.includes(norm)) return true;

  const candSet = new Set(norm.split(' ').filter((w) => w.length > 2));
  for (const prev of existing) {
    const prevSet = new Set(prev.split(' ').filter((w) => w.length > 2));
    if (!prevSet.size) continue;
    let common = 0;
    for (const w of candSet) {
      if (prevSet.has(w)) common++;
    }
    const union = new Set([...candSet, ...prevSet]).size;
    if (union > 0 && common / union >= 0.65) return true;
  }
  return false;
}

export async function handler(event: NetlifyEvent): Promise<NetlifyResponse> {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured in Netlify environment variables.' }),
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });

  try {
    const payload = JSON.parse(event.body || '{}');
    const action = payload.action as string;

    if (action === 'generate-questions') {
      const level = Math.max(1, Math.min(10, Number(payload.level || 1)));
      const count = Math.max(1, Math.min(5, Number(payload.count || 5)));
      const previousQuestions: string[] = Array.isArray(payload.previousQuestions)
        ? payload.previousQuestions
        : [];
      const existingNormalized = previousQuestions.map(normalizeQuestion);
      const accepted: Array<{
        questionText: string;
        topic: string;
        hintText: string;
        exampleAnswer: string;
      }> = [];

      for (let attempt = 0; attempt < 3 && accepted.length < count; attempt++) {
        const prompt = `Generate ${count + 2} genuinely distinct English speaking questions for Level ${level} (1=Beginner to 10=Master).
Never repeat or slightly rephrase any of these previously asked questions:
${previousQuestions.slice(-80).concat(accepted.map((a) => a.questionText)).join('\n') || '(None yet)'}`;

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionText: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  hintText: { type: Type.STRING },
                  exampleAnswer: { type: Type.STRING },
                },
                required: ['questionText', 'topic', 'hintText', 'exampleAnswer'],
              },
            },
          },
        });

        const candidates = JSON.parse((response.text ?? '[]').trim());
        for (const c of candidates) {
          if (accepted.length >= count) break;
          if (c.questionText && !isDuplicate(c.questionText, existingNormalized)) {
            accepted.push(c);
            existingNormalized.push(normalizeQuestion(c.questionText));
          }
        }
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ questions: accepted.slice(0, count) }),
      };
    }

    if (action === 'evaluate-answer') {
      const { questionText, userAnswer, level } = payload;
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Evaluate this Level ${level || 1} English learner's answer fairly.
Question: "${questionText}"
Learner Answer: "${userAnswer}"
Do NOT penalize a grammatically correct answer for differing from a sample answer. Explain mistakes in simple Hindi (Hinglish).`,
        config: {
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
          },
        },
      });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: (response.text ?? '{}').trim(),
      };
    }

    if (action === 'conversation') {
      const { topic, level, history, userMessage } = payload;
      const historyText = Array.isArray(history)
        ? history.slice(-12).map((m: any) => `${m.role}: ${m.content}`).join('\n')
        : '';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Topic: ${topic}\nLevel: ${level}\nHistory:\n${historyText}\nUser: ${userMessage}\nRespond naturally, ask a relevant follow-up question, and politely note any grammar error with a brief Hindi tip.`,
        config: {
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

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: (response.text ?? '{}').trim(),
      };
    }

    if (action === 'vocabulary') {
      const { level, existingWords } = payload;
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Generate 5 new English vocabulary words for Level ${level || 1} excluding: ${(existingWords || []).join(', ')}. Include Hindi meanings and example sentences.`,
        config: {
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
            },
          },
        },
      });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ words: JSON.parse((response.text ?? '[]').trim()) }),
      };
    }

    if (action === 'transcribe') {
      const { audioBase64, mimeType } = payload;
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType || 'audio/webm', data: audioBase64 } },
            { text: 'Transcribe the spoken English accurately. Return only the transcribed text.' },
          ],
        },
      });
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ transcript: (response.text ?? '').trim() }),
      };
    }

    if (action === 'tts') {
      const { text } = payload;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [{ role: 'user', parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });
      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ audioBase64, mimeType: 'audio/wav' }),
      };
    }

    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: `Unsupported action: ${action}` }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message || 'Netlify AI function error' }),
    };
  }
}
