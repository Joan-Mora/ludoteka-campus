import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BrainCircuit, Map as MapIcon, Volume2, VolumeX, X } from 'lucide-react';
import type { Role } from '@eduquest/contracts';
import { useAuth } from '@/shared/auth';
import { useCompanion } from '@/shared/companion';
import { useSpeech } from '@/shared/voice';
import { buildingForPath, campusFor, districtsOf, type Building, type BuildingKey } from '@/shared/buildings';
import { GUIDE_EVENT, tourSeenKey, type GuideMode } from '@/shared/guide';
import { Luka } from '@/features/campus';

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

interface Step { title: string; text: string; list?: Building[]; to?: string }

function tourOf(role: Role, buildings: Building[], name: string): Step[] {
  const steps: Step[] = [
    { title: `Hola, soy ${name}`, text: `${INTRO[role]} Te muestro cómo moverte; tarda un minuto.` },
    { title: 'El mapa', text: 'A la izquierda (o en «Más» en el celular) está el mapa de tu campus. El marcador morado te dice en qué edificio estás; toca cualquier edificio para entrar.' },
  ];
  for (const { label, items } of districtsOf(buildings)) steps.push({ title: label, text: 'Los edificios de esta zona:', list: items });
  steps.push({ title: 'Siempre estoy aquí', text: `Toca mi botón abajo a la derecha cuando quieras: te explico el edificio en el que estás y cómo usarlo.` });
  return steps;
}

export function Guide() {
  const { user } = useAuth();
  const companion = useCompanion();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const speech = useSpeech();
  const [mode, setMode] = useState<GuideMode | null>(null);
  const [step, setStep] = useState(0);
  const role = user?.role;
  const buildings = useMemo(() => campusFor(role, companion.name).buildings, [role, companion.name]);
  const here = useMemo(() => buildingForPath(pathname, buildings), [pathname, buildings]);
  const tour = useMemo(() => (role ? tourOf(role, buildings, companion.name) : []), [role, buildings, companion.name]);

  useEffect(() => {
    const open = (event: Event) => { setStep(0); setMode((event as CustomEvent<GuideMode>).detail ?? 'here'); };
    window.addEventListener(GUIDE_EVENT, open);
    return () => window.removeEventListener(GUIDE_EVENT, open);
  }, []);

  useEffect(() => {
    if (!user || pathname !== '/app' || navigator.webdriver) return;
    try {
      if (!localStorage.getItem(tourSeenKey(user.id))) { setStep(0); setMode('tour'); }
    } catch { /* storage blocked: the tour stays one tap away */ }
  }, [user, pathname]);

  useEffect(() => { if (mode === 'here') setStep(0); }, [pathname, mode]);

  if (!user || !role || /^\/app\/arena\/[^/]+$/.test(pathname)) return null;

  const close = () => {
    if (mode === 'tour') { try { localStorage.setItem(tourSeenKey(user.id), new Date().toISOString()); } catch { /* ignore */ } }
    speech.stop();
    setMode(null);
  };
  const go = (to: string) => { close(); navigate(to); };

  const current = tour[Math.min(step, tour.length - 1)];
  const how = here ? HOW[role]?.[here.key] : undefined;
  const spoken = mode === 'tour'
    ? `${current?.title}. ${current?.text}`
    : here ? `${here.name}. ${here.about} ${(how ?? []).join(' ')}` : INTRO[role];

  return (
    <>
      <button className={`guide-fab${mode ? ' on' : ''}`} onClick={() => (mode ? close() : setMode('here'))} aria-expanded={Boolean(mode)} aria-label={mode ? 'Cerrar la guía' : `Pedir ayuda a ${companion.name}`} title={`${companion.name}: tu guía`}>
        <Luka size={44} variant={companion.id} mood={speech.speaking ? 'talking' : 'idle'} />
      </button>
      <AnimatePresence>
        {mode && (
          <motion.aside
            key="guide"
            className="guide-pop"
            role="dialog"
            aria-label={`Guía de ${companion.name}`}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <header className="guide-head">
              <span className="guide-who">{companion.name} · tu guía</span>
              {speech.supported && (
                <button className="icon-btn sm" onClick={() => (speech.speaking ? speech.stop() : speech.speak(spoken))} aria-label="Leer en voz alta">
                  {speech.speaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
              )}
              <button className="icon-btn sm" onClick={close} aria-label="Cerrar"><X size={15} /></button>
            </header>

            {mode === 'tour' && current ? (
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
                  {step > 0 && <button className="btn sm ghost" onClick={() => setStep((s) => s - 1)} aria-label="Anterior"><ArrowLeft size={14} /></button>}
                  {step < tour.length - 1
                    ? <button className="btn sm" onClick={() => setStep((s) => s + 1)}>Siguiente <ArrowRight size={14} /></button>
                    : <button className="btn sm" onClick={close}>Entendido</button>}
                </div>
              </div>
            ) : (
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
                  <button className="btn sm ghost" onClick={() => { setStep(0); setMode('tour'); }}><MapIcon size={14} /> Recorrido del campus</button>
                  {role === 'student' && here?.key !== 'tutor' && <button className="btn sm" onClick={() => go('/app/tutor')}><BrainCircuit size={14} /> Preguntarme un tema</button>}
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
