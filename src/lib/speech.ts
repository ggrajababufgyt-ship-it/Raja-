import { apiFetch } from './api.ts';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstanceLike;

export function isWebSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createBrowserSpeechRecognizer(): SpeechRecognitionInstanceLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;
  return recognition;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result;
      if (typeof res !== 'string') {
        reject(new Error('Failed to encode audio.'));
        return;
      }
      const commaIdx = res.indexOf(',');
      resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
    };
    reader.onerror = () => reject(new Error('Failed to read audio recording.'));
    reader.readAsDataURL(blob);
  });
}

let activeAudio: HTMLAudioElement | null = null;

export async function speakEnglishText(text: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;

  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  try {
    const res = await apiFetch<{ audioBase64: string; mimeType: string }>('/api/speech/tts', {
      method: 'POST',
      body: JSON.stringify({ text: clean }),
    });
    if (res.audioBase64) {
      const audio = new Audio(`data:${res.mimeType || 'audio/wav'};base64,${res.audioBase64}`);
      activeAudio = audio;
      await audio.play();
      return;
    }
  } catch {
    // Fallback cleanly to browser SpeechSynthesis
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'en-US';
    utterance.rate = 0.94;
    window.speechSynthesis.speak(utterance);
  }
}
