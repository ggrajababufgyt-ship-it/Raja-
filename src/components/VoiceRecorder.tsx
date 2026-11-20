import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import {
  blobToBase64,
  createBrowserSpeechRecognizer,
  isWebSpeechSupported,
} from '../lib/speech.ts';

interface VoiceRecorderProps {
  currentText: string;
  onTranscriptUpdate: (nextText: string, usedVoice: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  currentText,
  onTranscriptUpdate,
  disabled = false,
  compact = false,
}) => {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [useAiFallback, setUseAiFallback] = useState<boolean>(() => !isWebSpeechSupported());

  const recognitionRef = useRef<ReturnType<typeof createBrowserSpeechRecognizer>>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const baseTextRef = useRef<string>('');
  const finalSpeechRef = useRef<string>('');

  useEffect(() => {
    return () => {
      stopAllStreams();
    };
  }, []);

  const stopAllStreams = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore stop errors
    }
    recognitionRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    if (disabled || transcribing) return;
    setErrorMsg(null);
    baseTextRef.current = currentText.trim();
    finalSpeechRef.current = '';

    // Verify microphone permission first
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Microphone recording is not supported in this browser. Please type your answer below.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone permission was denied. Allow microphone access in your browser or type your answer.');
      } else {
        setErrorMsg('Could not access microphone. Please check your device settings or type your answer.');
      }
      return;
    }

    if (!useAiFallback && isWebSpeechSupported()) {
      const recognition = createBrowserSpeechRecognizer();
      if (recognition) {
        recognitionRef.current = recognition;
        setRecording(true);
        setStatusLabel('Listening... Speak clearly in English');

        recognition.onresult = (event) => {
          let interim = '';
          let finalChunk = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const txt = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              finalChunk += txt + ' ';
            } else {
              interim += txt;
            }
          }
          if (finalChunk) {
            finalSpeechRef.current = `${finalSpeechRef.current} ${finalChunk}`.trim();
          }
          const combined = [baseTextRef.current, finalSpeechRef.current, interim.trim()]
            .filter(Boolean)
            .join(' ');
          onTranscriptUpdate(combined, true);
        };

        recognition.onerror = (event) => {
          if (event.error === 'not-allowed') {
            setErrorMsg('Microphone permission denied. Please enable microphone access.');
            stopRecording();
          } else if (event.error === 'no-speech') {
            setStatusLabel('No speech detected yet. Keep speaking or tap Stop.');
          } else {
            // Switch smoothly to AI Audio recording fallback for next capture
            setUseAiFallback(true);
            setErrorMsg('Browser speech recognition paused. Switched to AI Audio Capture—tap microphone to record.');
            stopRecording();
          }
        };

        recognition.onend = () => {
          setRecording(false);
          setStatusLabel('');
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
        };

        try {
          recognition.start();
          return;
        } catch {
          setUseAiFallback(true);
        }
      }
    }

    // Compatible AI Audio Recording + Server Transcription Fallback
    try {
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        setRecording(false);
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        if (blob.size < 400) {
          setStatusLabel('');
          return;
        }

        setTranscribing(true);
        setStatusLabel('Transcribing your English speech...');
        try {
          const base64 = await blobToBase64(blob);
          const result = await apiFetch<{ transcript: string }>('/api/speech/transcribe', {
            method: 'POST',
            body: JSON.stringify({ audioBase64: base64, mimeType }),
          });
          if (result.transcript) {
            const combined = [baseTextRef.current, result.transcript].filter(Boolean).join(' ');
            onTranscriptUpdate(combined, true);
          } else {
            setErrorMsg('Could not hear any words. Please try speaking closer to the microphone.');
          }
        } catch (err: any) {
          setErrorMsg(err.message || 'Voice transcription failed. Please type or try again.');
        } finally {
          setTranscribing(false);
          setStatusLabel('');
        }
      };

      recorder.start();
      setRecording(true);
      setStatusLabel('Recording audio... Tap Stop when finished');
    } catch {
      stopAllStreams();
      setErrorMsg('Audio recording failed to start on this device. Please type your answer.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (streamRef.current && !mediaRecorderRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setRecording(false);
    if (!transcribing) {
      setStatusLabel('');
    }
  };

  if (compact) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={disabled || transcribing}
            aria-label={recording ? 'Stop voice recording' : 'Start voice recording'}
            className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              recording
                ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
            } disabled:opacity-50`}
          >
            {transcribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : recording ? (
              <Square className="w-4 h-4 fill-current" />
            ) : (
              <Mic className="w-4 h-4 text-blue-600" />
            )}
            <span className="ml-2 hidden sm:inline">
              {transcribing ? 'Transcribing' : recording ? 'Stop' : 'Speak'}
            </span>
          </button>
          {statusLabel && (
            <span className="text-xs font-medium text-blue-700 truncate max-w-[200px]">
              {statusLabel}
            </span>
          )}
        </div>
        {errorMsg && (
          <p className="text-xs text-rose-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={disabled || transcribing}
            className={`min-h-[48px] inline-flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              recording
                ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/20'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-600/20'
            } disabled:opacity-50`}
          >
            {transcribing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Transcribing Audio...</span>
              </>
            ) : recording ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Recording</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Speak Your Answer</span>
              </>
            )}
          </button>

          {isWebSpeechSupported() && !recording && !transcribing && (
            <button
              type="button"
              onClick={() => setUseAiFallback((prev) => !prev)}
              className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {useAiFallback ? 'Mode: AI Audio Capture' : 'Mode: Live Browser Speech'}
            </button>
          )}
        </div>

        {statusLabel && (
          <div className="flex items-center gap-2 text-xs font-medium text-blue-700">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>{statusLabel}</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
