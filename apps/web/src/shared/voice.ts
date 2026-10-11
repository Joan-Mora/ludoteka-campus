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

const isApple = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const isStandalone = typeof window !== 'undefined' && ((navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches);

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  // La app instalada en la pantalla de inicio de iPhone no expone el dictado de Safari.
  if (isApple && isStandalone) return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const voiceSupport = {
  get dictation() { return recognitionCtor() !== null; },
  get speech() { return typeof window !== 'undefined' && 'speechSynthesis' in window; },
};

/** Why dictation is off on this device, phrased for the user. */
export function dictationUnavailable() {
  if (isApple && isStandalone) return 'En la app instalada de iPhone o iPad no hay dictado. Ábrela en Safari para hablarle a tu compañero.';
  if (isApple) return 'Actualiza iOS o activa Siri y Dictado en Ajustes para usar la voz.';
  return 'Tu navegador no permite dictado por voz. Usa Chrome, Edge o Safari.';
}

/* ---------- Voices ---------- */

let voiceCache: SpeechSynthesisVoice[] = [];
const voiceListeners = new Set<() => void>();

function refreshVoices() {
  if (!voiceSupport.speech) return;
  voiceCache = window.speechSynthesis.getVoices();
  voiceListeners.forEach((fn) => fn());
}

if (voiceSupport.speech) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
  // Algunos Safari no disparan voiceschanged: reintentamos un par de veces.
  [250, 1000, 2500].forEach((ms) => window.setTimeout(() => { if (!voiceCache.length) refreshVoices(); }, ms));
}

export function getVoices() {
  return voiceCache;
}

export function useVoices() {
  const [voices, setVoices] = useState(voiceCache);
  useEffect(() => {
    const update = () => setVoices([...voiceCache]);
    voiceListeners.add(update);
    update();
    return () => { voiceListeners.delete(update); };
  }, []);
  return voices;
}

/** iOS only lets speechSynthesis talk after a user gesture; a silent utterance on the first tap unlocks it. */
export function unlockSpeechOnFirstTap() {
  if (!voiceSupport.speech) return;
  const unlock = () => {
    try {
      const silent = new SpeechSynthesisUtterance(' ');
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
    } catch { /* sin voz */ }
    refreshVoices();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

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

/* ---------- Voz del compañero (Luka o Luna) ---------- */

export type VoiceGender = 'male' | 'female';

// Los navegadores no dicen el género de cada voz. Solo ofrecemos voces cuyo nombre está en esta tabla
// (Microsoft, Apple y Google); las demás quedan fuera para que Luka nunca hable con voz de mujer ni Luna con voz de hombre.
const VOICE_TABLE: Record<string, VoiceGender> = {
  gonzalo: 'male', jorge: 'male', raul: 'male', pablo: 'male', juan: 'male', diego: 'male', carlos: 'male', alvaro: 'male',
  tomas: 'male', lorenzo: 'male', emilio: 'male', gerardo: 'male', federico: 'male', alonso: 'male', andres: 'male',
  enrique: 'male', antonio: 'male', miguel: 'male', daniel: 'male', santiago: 'male', mateo: 'male', luciano: 'male',
  salome: 'female', dalia: 'female', sabina: 'female', helena: 'female', laura: 'female', elvira: 'female', elena: 'female',
  monica: 'female', paulina: 'female', marisol: 'female', angelica: 'female', isabela: 'female', catalina: 'female',
  ximena: 'female', paloma: 'female', camila: 'female', valentina: 'female', lucia: 'female', beatriz: 'female',
  irene: 'female', abril: 'female', soledad: 'female', marta: 'female', carmen: 'female',
};
const VOICE_KEY = 'lk_voice';
const SHOWN_PER_GENDER = 5;

const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function voiceGender(voice: SpeechSynthesisVoice): VoiceGender | null {
  const name = plain(voice.name);
  // "Google español" y "Google español de Estados Unidos" son voces femeninas.
  if (/^google espanol/.test(name)) return 'female';
  for (const word of name.split(/[^a-z]+/)) {
    const gender = VOICE_TABLE[word];
    if (gender) return gender;
  }
  return null;
}

function voiceScore(v: SpeechSynthesisVoice) {
  const name = plain(v.name);
  let score = 0;
  if (/natural|online|neural/.test(name)) score += 40;
  if (/premium|enhanced|mejorada/.test(name)) score += 30;
  if (/^google/.test(name)) score += 20;
  if (v.lang === LANG) score += 15;
  else if (/^es-(MX|US|419)/i.test(v.lang)) score += 10;
  else if (!/^es-ES/i.test(v.lang)) score += 5;
  if (v.localService) score += 2;
  return score;
}

export function spanishVoices(voices = voiceCache) {
  return voices.filter((v) => v.lang.toLowerCase().startsWith('es')).sort((a, b) => voiceScore(b) - voiceScore(a));
}

/** The best Spanish voices of one gender, one per name (Apple lists the same voice in several qualities). */
export function curatedVoices(gender: VoiceGender, voices = voiceCache) {
  const seen = new Set<string>();
  const list: SpeechSynthesisVoice[] = [];
  for (const v of spanishVoices(voices)) {
    if (voiceGender(v) !== gender) continue;
    const key = plain(v.name).replace(/\(.*\)|online|natural|premium|enhanced|mejorada|microsoft|google|-.*$/g, '').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(v);
    if (list.length === SHOWN_PER_GENDER) break;
  }
  return list;
}

let companionGender: VoiceGender = 'male';

/** The companion's gender decides which voice speaks; set from the user's choice in Ajustes. */
export function configureSpeech(gender: VoiceGender) {
  companionGender = gender;
}

export function savedVoiceURI() {
  try {
    return localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}

/** The chosen voice lives on this device only: the voice list differs between an iPhone and a Windows laptop. */
export function saveVoiceURI(uri: string | null) {
  try {
    if (uri) localStorage.setItem(VOICE_KEY, uri);
    else localStorage.removeItem(VOICE_KEY);
  } catch { /* almacenamiento bloqueado */ }
}

/** Voice and pitch for a gender: the saved voice if it fits the gender, else the best curated voice, else any Spanish voice with a shifted pitch. */
export function voiceFor(gender: VoiceGender, voices = voiceCache.length ? voiceCache : window.speechSynthesis.getVoices()) {
  const curated = curatedVoices(gender, voices);
  const saved = savedVoiceURI();
  const chosen = saved ? curated.find((v) => v.voiceURI === saved) : undefined;
  const voice = chosen ?? curated[0] ?? spanishVoices(voices)[0] ?? null;
  const actual = voice ? voiceGender(voice) : null;
  const pitch = chosen || actual === gender ? 1.05 : gender === 'female' ? 1.3 : 0.8;
  return { voice, pitch, matches: actual === gender };
}

function pickVoice() {
  return voiceFor(companionGender);
}

/** Plays a sample with a specific voice, for the "Probar" buttons in Ajustes. */
export function sayWith(voice: SpeechSynthesisVoice | null, pitch: number, text: string) {
  if (!voiceSupport.speech) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? LANG;
  utterance.pitch = pitch;
  if (voice) utterance.voice = voice;
  if (isApple) window.setTimeout(() => window.speechSynthesis.speak(utterance), 50);
  else window.speechSynthesis.speak(utterance);
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
    const { voice, pitch } = pickVoice();
    utterance.pitch = pitch;
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    // Safari descarta un speak() pegado a cancel(); un respiro corto lo evita.
    if (isApple) window.setTimeout(() => window.speechSynthesis.speak(utterance), 50);
    else window.speechSynthesis.speak(utterance);
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
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
      setError(dictationUnavailable());
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
    try {
      rec.start();
    } catch {
      setListening(false);
      setError(dictationUnavailable());
    }
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
  const said = normalize(spoken).replace(/^((oye|hola)\s+)?(luka|luna)\s*/, '');
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
