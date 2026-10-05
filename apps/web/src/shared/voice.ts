import { useCallback, useEffect, useRef, useState } from 'react';

interface RecognitionResult { isFinal: boolean; 0: { transcript: string; confidence: number } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

const LANG = 'es-CO';

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const voiceSupport = {
  get dictation() { return recognitionCtor() !== null; },
  get speech() { return typeof window !== 'undefined' && 'speechSynthesis' in window; },
};

const errorCopy: Record<string, string> = {
  'not-allowed': 'Permite el micrófono en el navegador para dictar.',
  'service-not-allowed': 'El navegador bloqueó el reconocimiento de voz.',
  'no-speech': 'No escuché nada. Intenta de nuevo, más cerca del micrófono.',
  'audio-capture': 'No se encontró un micrófono.',
  network: 'El dictado necesita conexión a internet en este navegador.',
};

export function voiceErrorMessage(code: string) {
  return errorCopy[code] ?? 'No se pudo usar el micrófono.';
}

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === LANG) ??
    voices.find((v) => v.lang.startsWith('es-') && /latin|colomb|mex|us/i.test(`${v.name} ${v.lang}`)) ??
    voices.find((v) => v.lang.startsWith('es')) ??
    null
  );
}

/** Strips markdown and emoji so speech sounds natural. */
export function speakable(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_#>`~]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const supported = voiceSupport.speech;

  useEffect(() => {
    if (!supported) return;
    window.speechSynthesis.getVoices();
    return () => window.speechSynthesis.cancel();
  }, [supported]);

  const speak = useCallback((text: string, rate = 1) => {
    if (!supported) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speakable(text));
    utterance.lang = LANG;
    utterance.rate = rate;
    utterance.pitch = 1.05;
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    return true;
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { supported, speaking, speak, stop };
}

/**
 * Speech-to-text with the browser's Web Speech API. `onFinal` receives each
 * finished phrase; `interim` shows what is being heard right now.
 */
export function useDictation(onFinal: (text: string) => void, options: { continuous?: boolean } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onFinal);
  callback.current = onFinal;
  const supported = voiceSupport.dictation;

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError('Tu navegador no permite dictado por voz. Usa Chrome o Edge.');
      return;
    }
    recognition.current?.abort();
    const rec = new Ctor();
    rec.lang = LANG;
    rec.continuous = options.continuous ?? false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      let partial = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (result.isFinal) callback.current(result[0].transcript.trim());
        else partial += result[0].transcript;
      }
      setInterim(partial);
    };
    rec.onerror = (event) => {
      if (event.error !== 'aborted') setError(voiceErrorMessage(event.error));
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
    recognition.current = rec;
    setError(null);
    setListening(true);
    rec.start();
  }, [options.continuous]);

  useEffect(() => () => recognition.current?.abort(), []);

  return { supported, listening, interim, error, start, stop, toggle: () => (listening ? stop() : start()) };
}

/** Joins a dictated phrase onto existing text, capitalizing the start of each sentence. */
export function joinDictation(current: string, phrase: string) {
  const clean = phrase.trim();
  if (!clean) return current;
  const base = current.trimEnd();
  const startsSentence = !base || /[.!?¿¡:]$/.test(base);
  const piece = startsSentence ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean;
  return base ? `${base} ${piece}` : piece;
}

export function appendToField(id: string, phrase: string) {
  const field = document.getElementById(id) as HTMLTextAreaElement | HTMLInputElement | null;
  if (!field) return;
  field.value = joinDictation(field.value, phrase);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
  seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
};
const DENOMINATORS: Record<string, number> = {
  medio: 2, medios: 2, tercio: 3, tercios: 3, cuarto: 4, cuartos: 4, quinto: 5, quintos: 5, sexto: 6, sextos: 6,
  septimo: 7, septimos: 7, octavo: 8, octavos: 8, noveno: 9, novenos: 9, decimo: 10, decimos: 10,
};

/** Turns a dictated answer ("tres cuartos", "dos coma cinco", "18 sobre 24") into math notation. */
export function spokenAnswer(text: string) {
  const words = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.,/ -]/g, ' ').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let number: number | null = null;
  let thousands = 0;
  const flush = () => {
    if (number !== null || thousands) out.push(String(thousands + (number ?? 0)));
    number = null;
    thousands = 0;
  };
  for (const word of words) {
    if (word === 'y' && number !== null) continue;
    if (word in UNITS) number = (number ?? 0) + UNITS[word]!;
    else if (word === 'mil') [thousands, number] = [thousands + (number ?? 1) * 1000, null];
    else if (word in DENOMINATORS) {
      flush();
      out.push(`/${DENOMINATORS[word]}`);
    } else {
      flush();
      if (word === 'sobre' || word === 'entre') out.push('/');
      else if (word === 'coma') out.push(',');
      else if (word === 'punto') out.push('.');
      else if (word === 'menos') out.push('-');
      else if (/^[\d.,/-]+$/.test(word)) out.push(word);
    }
  }
  flush();
  return out.join('').replace(/\/+/g, '/');
}

export interface VoiceCommand { phrases: string[]; label: string; run: () => void }

function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Matches a spoken phrase against command phrases, ignoring accents and filler words. */
export function matchCommand(spoken: string, commands: VoiceCommand[]) {
  const said = normalize(spoken).replace(/^(luka|oye luka|hola luka)\s*/, '');
  let best: { command: VoiceCommand; score: number } | null = null;
  for (const command of commands) {
    for (const phrase of command.phrases) {
      const target = normalize(phrase);
      if (said === target || said.includes(target)) {
        const score = target.length;
        if (!best || score > best.score) best = { command, score };
      }
    }
  }
  return best?.command ?? null;
}
