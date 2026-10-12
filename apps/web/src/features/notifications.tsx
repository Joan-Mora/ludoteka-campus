import { useMemo, useState } from 'react';
import { Bell, Check, CheckCheck, ChevronRight } from 'lucide-react';
import { ago, kindOf, useNoteActions, useNotifications, type Note } from '@/shared/notifications';
import { Empty, PageHeader, Reveal } from '@/ui';

const dayKey = (value: string) => new Date(value).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

function groupLabel(key: string) {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return 'Hoy';
  if (key === yesterday) return 'Ayer';
  const date = new Date(`${key}T12:00:00-05:00`);
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days < 7) return date.toLocaleDateString('es-CO', { weekday: 'long', timeZone: 'America/Bogota' }).replace(/^./, (c) => c.toUpperCase());
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
}

export function NotificationsPage() {
  const [unread, setUnread] = useState(false);
  const [kind, setKind] = useState<string>('');
  const feed = useNotifications({ unread, kind: kind || undefined, limit: 100 });
  const counts = useNotifications({ limit: 1 });
  const actions = useNoteActions();
  const kinds = counts.data?.kinds ?? [];
  const total = counts.data?.unread ?? 0;

  const groups = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const note of feed.data?.items ?? []) {
      const key = dayKey(note.created_at);
      map.set(key, [...(map.get(key) ?? []), note]);
    }
    return [...map.entries()];
  }, [feed.data]);

  const kindUnread = kind ? kinds.find((k) => k.kind === kind)?.unread ?? 0 : total;

  return (
    <div className="notes-page">
      <PageHeader
        eyebrow="Campana"
        title="Notificaciones"
        subtitle="Todo lo que pasó en el campus y te concierne. Cada aviso te lleva a donde ocurrió."
        actions={kindUnread > 0 ? <button className="btn ghost" onClick={() => void actions.readAll(kind || undefined)}><CheckCheck size={16} /> Marcar {kind ? kindOf(kind).label.toLowerCase() : 'todo'} como leído</button> : undefined}
      />

      <div className="notes-filters">
        <div className="seg-tabs" role="tablist" aria-label="Estado">
          <button role="tab" aria-selected={!unread} className={!unread ? 'on' : ''} onClick={() => setUnread(false)}>Todas</button>
          <button role="tab" aria-selected={unread} className={unread ? 'on' : ''} onClick={() => setUnread(true)}>
            Sin leer {total > 0 && <span className="seg-badge">{total}</span>}
          </button>
        </div>
        <div className="row g-8 wrap" role="group" aria-label="Tipo">
          <button className={`chip ${!kind ? 'violet' : ''}`} onClick={() => setKind('')}>Todos los tipos</button>
          {kinds
            .slice()
            .sort((a, b) => b.total - a.total)
            .map((k) => {
              const look = kindOf(k.kind);
              return (
                <button key={k.kind} className={`chip ${kind === k.kind ? look.tone : ''}`} onClick={() => setKind(kind === k.kind ? '' : k.kind)} aria-pressed={kind === k.kind}>
                  <look.icon size={13} /> {look.label} {k.unread > 0 && <b>· {k.unread}</b>}
                </button>
              );
            })}
        </div>
      </div>

      {groups.map(([key, notes]) => (
        <section key={key} className="notes-day">
          <h2>{groupLabel(key)}</h2>
          <div className="card notes-card">
            {notes.map((note, i) => {
              const look = kindOf(note.kind);
              return (
                <Reveal key={note.id} delay={Math.min(i, 6) * 0.02}>
                  <article className={`notes-item${note.read_at ? '' : ' unread'}`} data-kind={note.kind}>
                    <span className={`tile ${look.tone}`}><look.icon size={18} strokeWidth={2.3} /></span>
                    <div className="notes-text">
                      <div className="row g-8 wrap">
                        <b>{note.title}</b>
                        {!note.read_at && <span className="chip coral">Nueva</span>}
                      </div>
                      <p>{note.body}</p>
                      <small>{look.label} · {ago(note.created_at)}</small>
                    </div>
                    <div className="notes-actions">
                      {note.link && <button className="btn sm" onClick={() => void actions.open(note)}>Ir <ChevronRight size={14} /></button>}
                      {!note.read_at && <button className="btn sm ghost" onClick={() => void actions.read(note)} aria-label="Marcar como leída"><Check size={15} /></button>}
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </section>
      ))}

      {!feed.isLoading && !groups.length && (
        <Empty icon={Bell} title={unread ? 'Nada sin leer' : 'Sin notificaciones'} body={unread ? 'Estás al día. Las nuevas aparecerán aquí.' : 'Cuando algo pase en tus cursos, la cartelera o tus logros, te avisamos aquí.'} />
      )}
    </div>
  );
}
