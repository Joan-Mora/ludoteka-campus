import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  ChevronRight,
  Compass,
  Lightbulb,
  ListTodo,
  Map as MapIcon,
  Mic,
  Palette,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@eduquest/contracts';
import { useAuth } from '@/shared/auth';
import { useCompanion } from '@/shared/companion';
import { useSpeech } from '@/shared/voice';
import { pendingSpeech } from '@/shared/voice-ui';
import { buildingForPath, campusFor, districtsOf, type Building, type BuildingKey } from '@/shared/buildings';
import { GUIDE_EVENT, startVoice, tourSeenKey, type GuideMode } from '@/shared/guide';
import { Luka, phaseNow, statusOf, tipsFor, useCampusData } from '@/features/campus';
import { useLayout } from './layout';

/** How each building works, step by step, when it differs by role. Falls back to the building's one-line "about". */
const HOW: Partial<Record<Role, Partial<Record<BuildingKey, string[]>>>> = {
  student: {
    aula: ['Entra a un curso para ver sus unidades, lecciones y tareas.', 'Las lecciones se completan en orden; al terminar ganas XP.', 'Las tareas muestran fecha límite y la nota cuando tu docente califica.'],
    ruta: ['Cada reto se elige según lo que ya dominas.', 'Si fallas, el siguiente reto es más sencillo; si aciertas, sube de nivel.'],
    cuaderno: ['Escribe apuntes por curso.', 'Las tarjetas de repaso vuelven justo antes de que las olvides.'],
    tutor: ['Escribe tu duda con tus palabras.', 'Te respondo con pistas y preguntas, no con la respuesta directa.', 'No compartas datos personales en el chat.'],
    envivo: ['Tu docente proyecta un código de 6 letras.', 'Escríbelo aquí y responde cada pregunta cuando aparezca.'],
    arena: ['Únete con el código o el QR de la sala.', 'Tu equipo suma puntos por respuestas correctas y rápidas.'],
  },
  teacher: {
    aula: ['Abre un curso para crear unidades, lecciones, tareas y evaluaciones.', 'En «Aula» del curso ves quién entregó y calificas.', 'Lo que publiques aparece al instante a tus estudiantes.'],
    envivo: ['Elige una evaluación publicada y pulsa «Abrir sala».', 'Proyecta el código grande: los estudiantes entran desde «Sala en vivo».', 'Pulsa «Siguiente» para lanzar cada pregunta y ver cuántos respondieron.', 'Al final verás los resultados de cada estudiante.'],
    planilla: ['Elige curso y periodo.', 'Las categorías y sus pesos calculan la definitiva sola.'],
    banco: ['Crea preguntas una vez y reutilízalas en quices, exámenes y salas en vivo.'],
    mensajes: ['En «Familias» hablas con acudientes sobre un estudiante.', 'En «Colegas» escribes a docentes y directivos; verás nombre y rol.'],
  },
  coordinator: {
    alertas: ['Las alertas llegan solas por notas bajas, faltas o reportes de convivencia.', 'Marca «En seguimiento», registra la bitácora y cierra cuando se resuelva.', 'Desde una alerta puedes citar al acudiente.'],
    asistencia: ['Revisa faltas por grupo y quiénes superan el umbral.'],
    citaciones: ['Programa la reunión, el acudiente confirma y luego registras el acta.'],
    grupos: ['Consulta cualquier curso del colegio en modo lectura.'],
  },
  rector: {
    tablero: ['Compara grupos e indicadores del periodo.', 'Publica comunicados oficiales para todo el colegio.'],
    firmas: ['Revisa y firma certificados y boletines pendientes.'],
    reportes: ['Genera reportes institucionales con número y código QR verificable.'],
  },
  guardian: {
    familia: ['Elige a tu hijo para ver notas, asistencia y alertas.', 'Confirma las citaciones del colegio desde aquí.'],
    mensajes: ['Escribe a los docentes de tu hijo; cada conversación muestra nombre y asignatura.'],
  },
  admin: {
    usuarios: ['Crea cuentas una a una o importa un archivo.', 'Cambia roles y atiende solicitudes de datos personales.'],
    institucion: ['Organiza grados, grupos y asignaturas.', 'Asigna la carga de cada docente.'],
  },
};

const INTRO: Record<Role, string> = {
  student: 'Este es tu campus. Cada edificio es un lugar para estudiar, practicar o jugar.',
  teacher: 'Este es tu campus docente. Aquí preparas clases, calificas, abres salas en vivo y hablas con familias y colegas.',
  coordinator: 'Este es el campus de coordinación: alertas, asistencia, citaciones y el consolidado académico.',
  rector: 'Este es el campus de rectoría: indicadores, firmas, reportes y comunicados oficiales.',
  guardian: 'Este es tu campus de familia: el avance de tus hijos y la comunicación con el colegio.',
  admin: 'Este es el campus de administración: cuentas, roles y la estructura del colegio.',
};

interface Step { title: string; text: string; list?: Building[] }

function tourOf(role: Role, buildings: Building[], name: string): Step[] {
  const steps: Step[] = [
    { title: `Hola, soy ${name}`, text: `${INTRO[role]} Te muestro cómo moverte; tarda un minuto.` },
    { title: 'El mapa', text: 'A la izquierda (o en «Más» en el celular) está el mapa de tu campus. El marcador morado te dice en qué edificio estás; toca cualquier edificio para entrar.' },
  ];
  for (const { label, items } of districtsOf(buildings)) steps.push({ title: label, text: 'Los edificios de esta zona:', list: items });
  steps.push({ title: 'Siempre estoy aquí', text: 'Tócame en la esquina cuando quieras: te digo qué tienes pendiente, te explico el edificio en el que estás o te llevo a donde necesites.' });
  return steps;
}

type Panel = GuideMode | 'menu' | 'pending';
interface Option { key: string; icon: LucideIcon; label: string; hint?: string; run: () => void }

const QUIET_KEY = 'eq.companion.quiet';
const IDLE_MS = 45_000;

function readFlag(storage: 'local' | 'session', key: string) {
  try { return (storage === 'local' ? localStorage : sessionStorage).getItem(key) !== null; } catch { return false; }
}
function writeFlag(storage: 'local' | 'session', key: string, on: boolean) {
  try {
    const store = storage === 'local' ? localStorage : sessionStorage;
    if (on) store.setItem(key, '1'); else store.removeItem(key);
  } catch { /* storage blocked */ }
}

const pageText = () => (document.querySelector('.reader') ?? document.querySelector('.content, .m-content'))?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 1500) ?? '';

/** The companion: always in the corner, watches the pointer, greets on tap and offers what it can do here. */
export function Guide() {
  const { user } = useAuth();
  const companion = useCompanion();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const speech = useSpeech();
  const layout = useLayout();
  const campus = useCampusData();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [step, setStep] = useState(0);
  const [tip, setTip] = useState(0);
  const [quiet, setQuiet] = useState(() => readFlag('local', QUIET_KEY));
  const [peekClosed, setPeekClosed] = useState(true);
  const [nudge, setNudge] = useState(false);
  const role = user?.role;
  const firstName = user?.fullName.split(' ')[0] ?? '';
  const buildings = useMemo(() => campusFor(role, companion.name).buildings, [role, companion.name]);
  const here = useMemo(() => buildingForPath(pathname, buildings), [pathname, buildings]);
  const tour = useMemo(() => (role ? tourOf(role, buildings, companion.name) : []), [role, buildings, companion.name]);
  const counts = useMemo(() => campus.data?.buildings ?? {}, [campus.data]);
  const tips = useMemo(() => tipsFor(role, counts, buildings, firstName, phaseNow(), companion), [role, counts, buildings, firstName, companion]);
  const busy = buildings.filter((b) => (counts[b.key] ?? 0) > 0);
  const total = busy.reduce((sum, b) => sum + (counts[b.key] ?? 0), 0);
  const currentTip = tips[tip % tips.length]!;
  const peekKey = user ? `eq.peek.${user.id}` : '';
  const home = pathname === '/app';

  const say = (text: string) => { if (!quiet && text) speech.speak(text); };

  useEffect(() => {
    const open = (event: Event) => { setStep(0); setPanel((event as CustomEvent<GuideMode>).detail ?? 'here'); };
    window.addEventListener(GUIDE_EVENT, open);
    return () => window.removeEventListener(GUIDE_EVENT, open);
  }, []);

  useEffect(() => {
    if (!user || !home || navigator.webdriver) return;
    try {
      if (!localStorage.getItem(tourSeenKey(user.id))) { setStep(0); setPanel('tour'); }
    } catch { /* storage blocked: the tour stays one tap away */ }
  }, [user, home]);

  useEffect(() => { setPeekClosed(peekKey ? readFlag('session', peekKey) : true); }, [peekKey]);
  useEffect(() => { if (panel === 'here' || panel === 'pending') setPanel('menu'); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeRef = useRef<() => void>(() => setPanel(null));
  useEffect(() => {
    if (!panel) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [panel]);

  // Pendiente del usuario: saluda con la mano cuando llega algo nuevo o tras un rato sin actividad.
  const lastTotal = useRef(total);
  useEffect(() => {
    if (total > lastTotal.current) setNudge(true);
    lastTotal.current = total;
  }, [total]);
  useEffect(() => {
    if (panel) return;
    let timer = window.setTimeout(() => setNudge(true), IDLE_MS);
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setNudge(true), IDLE_MS); };
    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    events.forEach((name) => window.addEventListener(name, reset, { passive: true, capture: true }));
    return () => { window.clearTimeout(timer); events.forEach((name) => window.removeEventListener(name, reset, { capture: true })); };
  }, [panel]);
  useEffect(() => {
    if (!nudge) return;
    const id = window.setTimeout(() => setNudge(false), 2400);
    return () => window.clearTimeout(id);
  }, [nudge]);

  if (!user || !role || /^\/app\/arena\/[^/]+$/.test(pathname)) return null;

  const close = () => {
    if (panel === 'tour') { try { localStorage.setItem(tourSeenKey(user.id), new Date().toISOString()); } catch { /* ignore */ } }
    speech.stop();
    setPanel(null);
  };
  closeRef.current = close;
  const go = (to: string) => { close(); navigate(to); };
  const closePeek = () => { setPeekClosed(true); writeFlag('session', peekKey, true); };

  const greeting = `¡Hola, ${firstName}! ${total ? `Tienes ${total} ${total === 1 ? 'cosa' : 'cosas'} por revisar. ` : ''}¿En qué te ayudo?`;
  const hereText = here ? `${here.name}. ${here.about} ${(HOW[role]?.[here.key] ?? []).join(' ')}` : INTRO[role];
  const pendingText = campus.data ? pendingSpeech(campus.data, role).text : 'Estoy revisando tu campus…';

  const show = (next: Panel) => {
    setStep(0);
    setPanel(next);
    if (next === 'menu') say(greeting);
    if (next === 'here') say(hereText);
    if (next === 'pending') say(pendingText);
    if (next === 'tour') say(`${tour[0]?.title}. ${tour[0]?.text}`);
  };
  const toStep = (index: number) => {
    setStep(index);
    const s = tour[index];
    if (s) say(`${s.title}. ${s.text}${s.list ? ` ${s.list.map((b) => b.name).join(', ')}.` : ''}`);
  };
  const toggleQuiet = () => {
    const next = !quiet;
    setQuiet(next);
    writeFlag('local', QUIET_KEY, next);
    if (next) speech.stop();
  };
  const nextTip = () => { setTip((t) => t + 1); const n = tips[(tip + 1) % tips.length]; if (n && panel) say(n.text); };

  const observatory = buildings.find((b) => b.key === 'observatorio');
  const options: Option[] = [
    { key: 'pending', icon: ListTodo, label: 'Qué tengo pendiente', hint: total ? `${total} por revisar` : 'Estás al día', run: () => show('pending') },
    { key: 'here', icon: Compass, label: here ? `Cómo funciona ${here.name}` : 'Cómo funciona el campus', run: () => show('here') },
    { key: 'tour', icon: MapIcon, label: 'Recorrido del campus', hint: 'Un minuto', run: () => show('tour') },
    ...(role === 'student'
      ? [{ key: 'tutor', icon: BrainCircuit, label: 'Preguntarme un tema', hint: 'Laboratorio IA', run: () => go('/app/tutor') }]
      : observatory ? [{ key: 'obs', icon: BrainCircuit, label: 'Consultar el Observatorio', hint: 'Preguntas sobre tus datos', run: () => go(observatory.to) }] : []),
    { key: 'voice', icon: Mic, label: 'Darme una orden por voz', hint: '«abre la biblioteca»', run: () => { close(); startVoice(); } },
    ...(speech.supported ? [{ key: 'read', icon: BookOpen, label: 'Léeme esta página', run: () => { const text = pageText(); if (text) speech.speak(text); } }] : []),
    { key: 'me', icon: Palette, label: `Elegir entre Luka y Luna`, hint: 'Nombre y voz', run: () => go('/app/ajustes?seccion=companero') },
  ];

  const mobile = layout === 'mobile';
  const showPeek = home && !panel && !peekClosed && Boolean(campus.data);
  const back = <button className="icon-btn sm" onClick={() => show('menu')} aria-label="Volver a las opciones"><ArrowLeft size={15} /></button>;

  let body: ReactNode = null;
  if (panel === 'tour') {
    const current = tour[Math.min(step, tour.length - 1)];
    body = current && (
      <div className="guide-body">
        <div className="guide-step">Paso {step + 1} de {tour.length}</div>
        <h3>{current.title}</h3>
        <p>{current.text}</p>
        {current.list && (
          <ul className="guide-list">
            {current.list.map((b) => (
              <li key={b.key}>
                <span className="guide-ico" style={{ background: b.color }}><b.icon size={14} strokeWidth={2.6} /></span>
                <span><b>{b.name}</b><small>{b.about}</small></span>
              </li>
            ))}
          </ul>
        )}
        <div className="guide-actions">
          <button className="btn sm ghost" onClick={close}>Saltar</button>
          <span style={{ flex: 1 }} />
          {step > 0 && <button className="btn sm ghost" onClick={() => toStep(step - 1)} aria-label="Anterior"><ArrowLeft size={14} /></button>}
          {step < tour.length - 1
            ? <button className="btn sm" onClick={() => toStep(step + 1)}>Siguiente <ArrowRight size={14} /></button>
            : <button className="btn sm" onClick={close}>Entendido</button>}
        </div>
      </div>
    );
  } else if (panel === 'here') {
    const how = here ? HOW[role]?.[here.key] : undefined;
    body = (
      <div className="guide-body">
        {here ? (
          <>
            <div className="guide-step"><span className="guide-ico" style={{ background: here.color }}><here.icon size={13} strokeWidth={2.6} /></span> Estás en {here.name}</div>
            <p>{here.about}</p>
            {how && <ol className="guide-how">{how.map((line) => <li key={line}>{line}</li>)}</ol>}
          </>
        ) : (
          <>
            <div className="guide-step">Estás en la plaza</div>
            <p>{INTRO[role]}</p>
          </>
        )}
        <div className="guide-actions">
          <button className="btn sm ghost" onClick={() => show('tour')}><MapIcon size={14} /> Recorrido del campus</button>
        </div>
      </div>
    );
  } else if (panel === 'pending') {
    const firsts = Object.values(campus.data?.pending ?? {}).flat().slice(0, 3);
    body = (
      <div className="guide-body">
        {!campus.data ? <p>Estoy revisando tu campus…</p> : busy.length === 0 ? (
          <p>No tienes nada pendiente. ¡Todo al día!</p>
        ) : (
          <>
            {firsts.length > 0 && (
              <>
                <div className="guide-step">Lo primero</div>
                <ul className="guide-menu">
                  {firsts.map((item) => (
                    <li key={item.link + item.title}>
                      <button onClick={() => go(item.link)}>
                        <span className="guide-ico violet"><ListTodo size={14} strokeWidth={2.6} /></span>
                        <span><b>{item.title}</b>{item.meta && <small>{item.meta}</small>}</span>
                        <ChevronRight size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="guide-step">Por edificio</div>
            <ul className="guide-menu">
              {busy.map((b) => (
                <li key={b.key}>
                  <button onClick={() => go(b.to)}>
                    <span className="guide-ico" style={{ background: b.color }}><b.icon size={14} strokeWidth={2.6} /></span>
                    <span><b>{b.name}</b><small>{statusOf(b, counts[b.key])}</small></span>
                    <span className="guide-count">{counts[b.key]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  } else if (panel === 'menu') {
    body = (
      <div className="guide-body">
        <div className="guide-tip">
          <Lightbulb size={16} />
          <div>
            <p>{currentTip.text}</p>
            <div className="guide-actions">
              {currentTip.to && <button className="btn sm" onClick={() => go(currentTip.to!)}>Ir ahora</button>}
              <button className="btn sm ghost" onClick={nextTip}>Otro consejo</button>
            </div>
          </div>
        </div>
        <div className="guide-step">¿En qué te ayudo?</div>
        <ul className="guide-grid">
          {options.map((o) => (
            <li key={o.key}>
              <button onClick={o.run}>
                <span className="guide-ico violet"><o.icon size={15} strokeWidth={2.6} /></span>
                <b>{o.label}</b>
                {o.hint && <small>{o.hint}</small>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <>
      <button
        className={`guide-fab${panel ? ' on' : ''}${nudge ? ' nudge' : ''}`}
        onClick={() => { closePeek(); if (panel) close(); else show('menu'); }}
        aria-expanded={Boolean(panel)}
        aria-label={panel ? `Cerrar a ${companion.name}` : `Hablar con ${companion.name}${total ? `: ${total} por revisar` : ''}`}
        title={`${companion.name}: tócame y te ayudo`}
      >
        <Luka size={mobile ? 66 : 92} variant={companion.id} mood={speech.speaking ? 'talking' : 'idle'} watch />
        {total > 0 && !panel && <span className="guide-badge">{total > 99 ? '99+' : total}</span>}
      </button>

      <AnimatePresence>
        {showPeek && (
          <motion.aside
            key="peek"
            className="guide-peek"
            aria-live="polite"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, delay: 0.4 }}
          >
            <button className="icon-btn sm guide-peek-x" onClick={closePeek} aria-label="Ocultar consejo"><X size={14} /></button>
            <span className="guide-who">{companion.name}</span>
            <p>{currentTip.text}</p>
            <div className="guide-actions">
              {currentTip.to && <button className="btn sm" onClick={() => { closePeek(); navigate(currentTip.to!); }}>Ir ahora</button>}
              <button className="btn sm ghost" onClick={nextTip}>Otro consejo</button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panel && (
          <motion.aside
            key="guide"
            className="guide-pop"
            role="dialog"
            aria-label={`${companion.name}, tu ${companion.noun}`}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <header className="guide-head">
              {panel !== 'menu' && panel !== 'tour' && back}
              <span className="guide-who">{companion.name} · tu {companion.noun}</span>
              {speech.supported && (
                <button className="icon-btn sm" onClick={toggleQuiet} aria-pressed={!quiet} aria-label={quiet ? `Activar la voz de ${companion.name}` : `Silenciar a ${companion.name}`} title={quiet ? 'Activar la voz' : 'Silenciar'}>
                  {quiet ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
              )}
              <button className="icon-btn sm" onClick={close} aria-label="Cerrar"><X size={15} /></button>
            </header>
            {body}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
