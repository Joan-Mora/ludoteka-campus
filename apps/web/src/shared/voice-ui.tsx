import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle, Mic, MicOff, Volume2, VolumeX, X } from 'lucide-react';
import { api } from './api';
import { useAuth } from './auth';
import { useCompanion } from './companion';
import { setTheme } from './theme';
import { VOICE_EVENT } from './guide';
import { dictationUnavailable, matchCommand, matchSlot, useDictation, useSpeech, voiceSupport, type SlotCommand, type VoiceCommand } from './voice';

/** Appends dictated phrases through `onText`. Hidden-but-explained when the browser lacks speech recognition. */
export function MicButton({ onText, size = 'sm', label, continuous = false }: { onText: (text: string) => void; size?: 'sm' | 'md'; label?: string; continuous?: boolean }) {
  const mic = useDictation(onText, { continuous });
  if (!mic.supported) {
    return (
      <button type="button" className={`btn ${size === 'sm' ? 'sm' : ''} ghost`} disabled title={dictationUnavailable()}>
        <MicOff size={15} />
      </button>
    );
  }
  return (
    <span className="mic-wrap">
      <button
        type="button"
        className={`btn ${size === 'sm' ? 'sm' : ''} ${mic.listening ? 'mic-on' : 'ghost'}`}
        onClick={mic.toggle}
        title={mic.listening ? 'Detener dictado' : 'Dictar por voz'}
        aria-pressed={mic.listening}
      >
        {mic.listening ? <span className="mic-dot" /> : <Mic size={15} />}
        {label && <span>{mic.listening ? 'Escuchando…' : label}</span>}
      </button>
      <AnimatePresence>
        {(mic.listening && mic.interim) || mic.error ? (
          <motion.span className={`mic-hint${mic.error ? ' err' : ''}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {mic.error ?? mic.interim}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

export function SpeakButton({ text, label, size = 'sm' }: { text: string; label?: string; size?: 'sm' | 'md' }) {
  const speech = useSpeech();
  if (!speech.supported) return null;
  return (
    <button type="button" className={`btn ${size === 'sm' ? 'sm' : ''} ghost`} onClick={() => (speech.speaking ? speech.stop() : speech.speak(text))} title={speech.speaking ? 'Detener lectura' : 'Leer en voz alta'}>
      {speech.speaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
      {label && <span>{speech.speaking ? 'Detener' : label}</span>}
    </button>
  );
}

interface Destination { label: string; to: string; phrases: string[]; roles?: string[] }

const destinations: Destination[] = [
  { label: 'Inicio', to: '/app', phrases: ['inicio', 'campus', 'casa', 'mapa'] },
  { label: 'Mis cursos', to: '/app/cursos', phrases: ['cursos', 'mis cursos', 'aula', 'clases'] },
  { label: 'Biblioteca', to: '/app/biblioteca', phrases: ['biblioteca', 'libros', 'recursos'] },
  { label: 'Tutor IA', to: '/app/tutor', phrases: ['tutor', 'laboratorio', 'luka', 'luna', 'inteligencia artificial'] },
  { label: 'Arena', to: '/app/arena', phrases: ['arena', 'competencia', 'equipos'] },
  { label: 'Cartelera', to: '/app/novedades', phrases: ['cartelera', 'novedades', 'noticias', 'avisos', 'foros'] },
  { label: 'Cuaderno', to: '/app/cuaderno', phrases: ['cuaderno', 'apuntes', 'flashcards', 'tarjetas'], roles: ['student'] },
  { label: 'Mi ruta', to: '/app/ruta', phrases: ['mi ruta', 'ruta', 'retos', 'practicar'], roles: ['student'] },
  { label: 'Mi espacio', to: '/app/aprender', phrases: ['mi espacio', 'como aprendo', 'aprender', 'cuestionario', 'descubre como aprendes'], roles: ['student'] },
  { label: 'Logros', to: '/app/logros', phrases: ['logros', 'trofeos', 'insignias'], roles: ['student'] },
  { label: 'Arcade', to: '/app/jugar', phrases: ['arcade', 'juegos', 'minijuegos'], roles: ['student'] },
  { label: 'Sala en vivo', to: '/app/en-vivo', phrases: ['sala en vivo', 'en vivo', 'quiz en vivo'] },
  { label: 'Acceso facial', to: '/app/rostro', phrases: ['acceso facial', 'rostro', 'mi cara'] },
  { label: 'Calificaciones', to: '/app/calificaciones', phrases: ['calificaciones', 'notas', 'rubricas', 'libro de notas'], roles: ['teacher', 'admin', 'coordinator', 'rector'] },
  { label: 'Banco de preguntas', to: '/app/banco', phrases: ['banco', 'preguntas'], roles: ['teacher', 'admin'] },
  { label: 'Observatorio', to: '/app/consultas', phrases: ['observatorio', 'consultas', 'datos'], roles: ['teacher', 'admin', 'coordinator', 'rector'] },
  { label: 'Coordinación', to: '/app/coordinacion', phrases: ['coordinacion', 'seguimiento de alertas', 'alertas', 'citaciones', 'asistencia'], roles: ['admin', 'coordinator'] },
  { label: 'Rectoría', to: '/app/rectoria', phrases: ['rectoria', 'tablero', 'indicadores', 'firmas', 'por firmar'], roles: ['admin', 'rector'] },
  { label: 'Mensajes', to: '/app/mensajes', phrases: ['mensajes', 'chat', 'escribir al docente', 'escribir al acudiente'], roles: ['teacher', 'guardian'] },
  { label: 'Familia', to: '/app/acudiente', phrases: ['familia', 'seguimiento', 'mis hijos', 'acudidos'], roles: ['guardian'] },
];

export type CampusSnapshot = { buildings: Record<string, number>; pending: Record<string, { title: string; meta: string; link: string }[]> };

const PLACES: Record<string, string> = {
  aula: 'el Aula',
  cartelera: 'la Cartelera',
  biblioteca: 'la Biblioteca',
  arena: 'la Arena',
  trofeos: 'la Sala de trofeos',
  ruta: 'Mi ruta',
  lab: 'el Laboratorio',
};

function placeOf(key: string, role: string | undefined) {
  if (key === 'cuaderno') return role === 'coordinator' ? 'Coordinación' : role === 'rector' ? 'Rectoría' : role === 'student' ? 'el Cuaderno' : 'el Taller docente';
  return PLACES[key] ?? key;
}

/** What the campus counts, said out loud: totals per building and the first two concrete items. */
export function pendingSpeech(data: CampusSnapshot, role: string | undefined) {
  const parts = Object.entries(data.buildings).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (!parts.length) return { text: 'No tienes nada pendiente. Todo al día.', link: null as string | null };
  const total = parts.reduce((sum, [, n]) => sum + n, 0);
  const list = parts.map(([key, n]) => `${n} en ${placeOf(key, role)}`);
  const items = Object.values(data.pending).flat().slice(0, 2);
  const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} y ${list.at(-1)}` : list[0];
  const firsts = items.length ? ` Lo primero: ${items.map((i) => `${i.title}${i.meta ? `, ${i.meta.charAt(0).toLowerCase()}${i.meta.slice(1)}` : ''}`).join('. Luego: ')}.` : '';
  return { text: `Tienes ${total} ${total === 1 ? 'pendiente' : 'pendientes'}: ${joined}.${firsts}`, link: items[0]?.link ?? null };
}

const lessonText = () => {
  const reader = document.querySelector('.reader');
  const title = document.querySelector('.content h1, .m-content h1')?.textContent ?? '';
  return reader ? `${title}. ${reader.textContent ?? ''}`.slice(0, 4000) : null;
};

interface HelpGroup { title: string; examples: { say: string; hint?: string }[] }

/** Global spoken commands: navigation, «qué tengo pendiente», reading, library search, arcade and the companion. */
export function VoiceNav({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const speech = useSpeech();
  const client = useQueryClient();
  const companion = useCompanion();
  const [toast, setToast] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const student = user?.role === 'student';

  const tell = useCallback((text: string) => { setToast(text); speech.speak(text); }, [speech]);

  const readLesson = useCallback(async () => {
    const now = lessonText();
    if (now) { setToast('Leyendo la lección…'); speech.speak(now); return; }
    const campus = await client.fetchQuery({ queryKey: ['campus'], queryFn: () => api<CampusSnapshot>('/api/campus'), staleTime: 30_000 }).catch(() => null);
    const next = Object.values(campus?.pending ?? {}).flat().find((i) => i.link.startsWith('/app/lecciones/'));
    if (!next) { tell('Abre una lección y vuelve a pedírmelo: te la leo completa.'); return; }
    setToast(`Abriendo ${next.title}…`);
    navigate(next.link);
    for (let i = 0; i < 20; i += 1) {
      await new Promise((r) => window.setTimeout(r, 400));
      const text = lessonText();
      if (text) { speech.speak(text); return; }
    }
    tell('La lección tardó en abrir. Dime «léeme la lección» cuando la veas.');
  }, [client, navigate, speech, tell]);

  const commands = useMemo<(VoiceCommand & { say?: string })[]>(() => [
    ...destinations
      .filter((d) => !d.roles || (user && d.roles.includes(user.role)))
      .map((d) => ({ label: d.label, say: `Abriendo ${d.label}`, phrases: d.phrases, run: () => navigate(d.to) })),
    { label: 'Notificaciones', say: 'Abriendo tus notificaciones', phrases: ['notificaciones', 'campana', 'mis avisos'], run: () => navigate('/app/notificaciones') },
    {
      label: 'Qué tengo pendiente',
      phrases: ['que tengo pendiente', 'que tengo para hoy', 'que me falta', 'mis pendientes', 'que hay pendiente', 'que tengo que hacer'],
      run: () => void client
        .fetchQuery({ queryKey: ['campus'], queryFn: () => api<CampusSnapshot>('/api/campus'), staleTime: 30_000 })
        .then((data) => tell(pendingSpeech(data, user?.role).text))
        .catch(() => tell('No pude revisar tus pendientes ahora. Intenta de nuevo en un momento.')),
    },
    ...(student ? [{ label: 'Léeme la lección', phrases: ['leeme la leccion', 'lee la leccion', 'leer la leccion', 'leeme la clase'], run: () => void readLesson() }] : []),
    { label: 'Qué puedo decir', phrases: ['que puedo decir', 'ayuda', 'comandos', 'que sabes hacer', 'que puedes hacer'], run: () => setHelp(true) },
    { label: 'Modo oscuro', say: 'Modo oscuro activado', phrases: ['modo oscuro', 'tema oscuro', 'apaga la luz'], run: () => setTheme('dark') },
    { label: 'Modo claro', say: 'Modo claro activado', phrases: ['modo claro', 'tema claro', 'prende la luz'], run: () => setTheme('light') },
    { label: 'Volver', phrases: ['volver', 'atras', 'regresar'], run: () => navigate(-1) },
    { label: 'Leer página', phrases: ['lee la pagina', 'leer pagina', 'lee esto', 'leer en voz alta'], run: () => speech.speak(document.querySelector('.content, .m-content')?.textContent?.slice(0, 1200) ?? '') },
    { label: 'Silencio', phrases: ['silencio', 'callate', 'para de leer', 'detente'], run: () => speech.stop() },
  ], [user, student, navigate, speech, client, tell, readLesson]);

  const slots = useMemo<SlotCommand[]>(() => [
    {
      label: 'Buscar en la biblioteca',
      prefixes: ['busca en la biblioteca', 'buscar en la biblioteca', 'busca en biblioteca', 'busca el libro', 'busca libros de', 'busca libros sobre', 'busca'],
      run: (q) => navigate(`/app/biblioteca?q=${encodeURIComponent(q)}`),
    },
    {
      label: `Preguntarle a ${companion.name}`,
      prefixes: [`preguntale a ${companion.name}`, 'preguntale a luka', 'preguntale a luna', 'preguntale al tutor', 'pregunta al tutor', `${companion.name} pregunta`],
      run: (q) => navigate(`/app/tutor?q=${encodeURIComponent(q)}&enviar=1`),
    },
    ...(student
      ? [{
          label: 'Empezar un reto',
          prefixes: ['empieza un reto de', 'empieza un reto sobre', 'empezar un reto de', 'quiero un reto de', 'juguemos a', 'jugar a', 'reto de', 'empieza un juego de', 'juego de'],
          run: (q: string) => navigate(`/app/jugar?buscar=${encodeURIComponent(q)}`),
        }]
      : []),
  ], [navigate, companion.name, student]);

  const groups = useMemo<HelpGroup[]>(() => [
    { title: 'Moverte por el campus', examples: [{ say: 'abre la biblioteca' }, { say: 'ir a mis cursos' }, { say: student ? 'abre mi ruta' : 'abre la cartelera' }, { say: 'abre las notificaciones' }, { say: 'volver' }] },
    {
      title: 'Lo tuyo',
      examples: [
        { say: 'qué tengo pendiente', hint: 'te lo dice en voz alta' },
        ...(student ? [{ say: 'léeme la lección', hint: 'la que tienes abierta o la siguiente pendiente' }] : []),
        { say: 'lee la página' },
        { say: 'silencio' },
      ],
    },
    {
      title: 'Buscar y preguntar',
      examples: [
        { say: 'busca en la biblioteca fotosíntesis' },
        { say: `pregúntale a ${companion.name} cómo sumo fracciones` },
        ...(student ? [{ say: 'empieza un reto de fracciones', hint: 'abre el juego del Arcade de ese tema' }] : []),
      ],
    },
    { title: 'Apariencia', examples: [{ say: 'modo oscuro' }, { say: 'modo claro' }] },
  ], [student, companion.name]);

  const handle = useCallback((text: string) => {
    const slot = matchSlot(text, slots);
    const command = slot ? null : (matchCommand(text, commands) as (typeof commands)[number] | null);
    if (slot) {
      setToast(`«${text}» → ${slot.command.label}`);
      slot.command.run(slot.arg);
    } else if (command) {
      setToast(`«${text}» → ${command.label}`);
      if (command.say) speech.speak(command.say);
      command.run();
    } else {
      setToast(`«${text}»: no encontré ese comando.`);
      setHelp(true);
    }
  }, [slots, commands, speech]);

  const mic = useDictation(handle);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (mic.error) setToast(mic.error);
  }, [mic.error]);

  useEffect(() => {
    if (!help) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !floatingRef.current?.contains(target)) setHelp(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setHelp(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [help]);

  const toggle = () => {
    if (!voiceSupport.dictation) { setHelp((open) => !open); return; }
    if (!mic.listening && !localStorage.getItem('eq_voice_help_seen')) {
      localStorage.setItem('eq_voice_help_seen', '1');
      setHelp(true);
    }
    mic.toggle();
  };

  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  useEffect(() => {
    const listen = () => toggleRef.current();
    window.addEventListener(VOICE_EVENT, listen);
    return () => window.removeEventListener(VOICE_EVENT, listen);
  }, []);

  const layers = (
    <AnimatePresence>
      {!help && (mic.listening || toast) && (
        <motion.div className={`voice-toast${compact ? ' floating' : ''}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
          <span>{mic.listening ? mic.interim || 'Te escucho… di «qué tengo pendiente» o «abre la biblioteca».' : toast}</span>
          <button type="button" className="voice-help-link" onClick={() => setHelp(true)}><HelpCircle size={14} /> Qué puedo decir</button>
        </motion.div>
      )}
      {help && (
        <motion.div className={`voice-help${compact ? ' floating' : ''}`} role="dialog" aria-label="Qué puedo decir" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
          <div className="voice-help-head">
            <span className="tile violet"><Mic size={16} /></span>
            <div>
              <b>Qué puedo decir</b>
              <small>{mic.listening ? (mic.interim || 'Te escucho…') : 'Toca el micrófono y habla, o toca una frase para probarla.'}</small>
            </div>
            <button type="button" className="icon-btn sm" aria-label="Cerrar" onClick={() => setHelp(false)}><X size={16} /></button>
          </div>
          {groups.map((group) => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.examples.map((example) => (
                  <li key={example.say}>
                    <button type="button" onClick={() => { setHelp(false); handle(example.say); }}>
                      «{example.say}»
                      {example.hint && <small>{example.hint}</small>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!voiceSupport.dictation && <p className="voice-help-note">{dictationUnavailable()} Puedes tocar las frases igual.</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      <button
        className={`${compact ? 'm-icon' : 'icon-btn'}${mic.listening ? ' mic-on' : ''}`}
        title={voiceSupport.dictation ? 'Comandos de voz: di «qué puedo decir»' : dictationUnavailable()}
        aria-label="Comandos de voz"
        onClick={toggle}
        onContextMenu={(event) => { event.preventDefault(); setHelp(true); }}
        aria-pressed={mic.listening}
      >
        {mic.listening ? <span className="mic-dot" /> : <Mic size={compact ? 21 : 18} />}
      </button>
      {compact ? createPortal(<div ref={floatingRef}>{layers}</div>, document.body) : layers}
    </div>
  );
}
