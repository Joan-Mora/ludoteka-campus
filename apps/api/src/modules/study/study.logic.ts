/** SM-2 (SuperMemo 2). grade: 0-5; por debajo de 3 la tarjeta vuelve a empezar. */
export function sm2(card: { ease: number; intervalDays: number; repetitions: number }, grade: number) {
  const q = Math.max(0, Math.min(5, Math.round(grade)));
  let { repetitions, intervalDays } = card;
  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(intervalDays * card.ease);
  }
  const ease = Math.max(1.3, Math.min(5, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));
  return { ease: Math.round(ease * 100) / 100, intervalDays: Math.min(3650, intervalDays), repetitions };
}

export { redact } from '../../core/common/redact';

export interface StudySummary {
  summary: string;
  ideas: string[];
  cards: { front: string; back: string }[];
}

function sentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

/** Resumen sin IA: primeras oraciones, viñetas como ideas y líneas «término: definición» como tarjetas. */
export function localSummary(body: string): StudySummary {
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bullets = lines.filter((line) => /^[-*•·]\s+/.test(line)).map((line) => line.replace(/^[-*•·]\s+/, ''));
  const cards: { front: string; back: string }[] = [];
  for (const line of lines) {
    const match = /^[-*•·]?\s*([^:=]{2,80}?)\s*[:=]\s*(.{3,400})$/.exec(line);
    if (match && !/^https?$/i.test(match[1]!)) cards.push({ front: `¿Qué es ${match[1]!.trim()}?`, back: match[2]!.trim() });
    if (cards.length >= 6) break;
  }
  const prose = sentences(body);
  return {
    summary: prose.slice(0, 3).join(' ').slice(0, 900) || lines.slice(0, 3).join(' ').slice(0, 900),
    ideas: (bullets.length ? bullets : prose.slice(0, 5)).slice(0, 6).map((idea) => idea.slice(0, 200)),
    cards,
  };
}

/** Normaliza lo que devuelve el modelo y descarta lo que no cumple el formato. */
export function cleanSummary(raw: { resumen?: unknown; ideas?: unknown; tarjetas?: unknown } | null): StudySummary | null {
  if (!raw || typeof raw.resumen !== 'string' || raw.resumen.trim().length < 20) return null;
  const ideas = Array.isArray(raw.ideas) ? raw.ideas.filter((idea): idea is string => typeof idea === 'string' && idea.trim().length > 3).map((idea) => idea.trim().slice(0, 200)).slice(0, 6) : [];
  const cards = Array.isArray(raw.tarjetas)
    ? raw.tarjetas
        .map((card) => card as { frente?: unknown; reverso?: unknown })
        .filter((card) => typeof card.frente === 'string' && typeof card.reverso === 'string' && card.frente.trim() && card.reverso.trim())
        .map((card) => ({ front: String(card.frente).trim().slice(0, 300), back: String(card.reverso).trim().slice(0, 600) }))
        .slice(0, 6)
    : [];
  return { summary: raw.resumen.trim().slice(0, 4000), ideas, cards };
}
