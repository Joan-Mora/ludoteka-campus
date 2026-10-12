import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from './auth';
import { setTheme } from './theme';
import { dictationUnavailable, matchCommand, useDictation, useSpeech, voiceSupport, type VoiceCommand } from './voice';

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

/** Global spoken navigation, e.g. «abre la biblioteca», «ir a mis cursos», «modo oscuro». */
export function VoiceNav() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const speech = useSpeech();
  const [toast, setToast] = useState<string | null>(null);

  const commands = useMemo<(VoiceCommand & { say?: string })[]>(() => [
    ...destinations
      .filter((d) => !d.roles || (user && d.roles.includes(user.role)))
      .map((d) => ({ label: d.label, say: `Abriendo ${d.label}`, phrases: d.phrases, run: () => navigate(d.to) })),
    { label: 'Modo oscuro', say: 'Modo oscuro activado', phrases: ['modo oscuro', 'tema oscuro', 'apaga la luz'], run: () => setTheme('dark') },
    { label: 'Modo claro', say: 'Modo claro activado', phrases: ['modo claro', 'tema claro', 'prende la luz'], run: () => setTheme('light') },
    { label: 'Volver', phrases: ['volver', 'atras', 'regresar'], run: () => navigate(-1) },
    { label: 'Leer página', phrases: ['lee la pagina', 'leer pagina', 'lee esto', 'leer en voz alta'], run: () => speech.speak(document.querySelector('.content')?.textContent?.slice(0, 1200) ?? '') },
    { label: 'Silencio', phrases: ['silencio', 'callate', 'para de leer', 'detente'], run: () => speech.stop() },
  ], [user, navigate, speech]);

  const mic = useDictation((text) => {
    const command = matchCommand(text, commands) as ((typeof commands)[number] | null);
    if (command) {
      setToast(`«${text}» → ${command.label}`);
      if (command.say) speech.speak(command.say);
      command.run();
    } else {
      setToast(`«${text}»: no encontré ese comando. Prueba «abre la biblioteca».`);
    }
  });

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (mic.error) setToast(mic.error);
  }, [mic.error]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className={`icon-btn${mic.listening ? ' mic-on' : ''}`}
        title={voiceSupport.dictation ? 'Comandos de voz: di «abre la biblioteca»' : dictationUnavailable()}
        disabled={!voiceSupport.dictation}
        onClick={mic.toggle}
        aria-pressed={mic.listening}
      >
        {mic.listening ? <span className="mic-dot" /> : <Mic size={18} />}
      </button>
      <AnimatePresence>
        {(mic.listening || toast) && (
          <motion.div className="voice-toast" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {mic.listening ? mic.interim || 'Te escucho… di «abre la biblioteca» o «modo oscuro».' : toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
