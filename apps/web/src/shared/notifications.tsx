import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Bell,
  CalendarClock,
  ChevronRight,
  Mail,
  Megaphone,
  MessagesSquare,
  PenLine,
  ShieldAlert,
  Trophy,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { api } from './api';

export interface Note {
  id: string;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  building: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NoteFeed {
  items: Note[];
  unread: number;
  kinds: { kind: string; total: number; unread: number }[];
}

export const NOTE_KINDS: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  aviso: { label: 'Avisos', icon: Bell, tone: 'violet' },
  cartelera: { label: 'Cartelera', icon: Megaphone, tone: 'coral' },
  foro: { label: 'Foros', icon: MessagesSquare, tone: 'sky' },
  logro: { label: 'Logros', icon: Trophy, tone: 'gold' },
  integridad: { label: 'Integridad', icon: ShieldAlert, tone: 'coral' },
  seguimiento: { label: 'Seguimiento', icon: UserCheck, tone: 'violet' },
  citacion: { label: 'Citaciones', icon: CalendarClock, tone: 'gold' },
  mensaje: { label: 'Mensajes', icon: Mail, tone: 'sky' },
  firma: { label: 'Firmas', icon: PenLine, tone: 'violet' },
  certificado: { label: 'Certificados', icon: BadgeCheck, tone: 'mint' },
};
export const kindOf = (kind: string) => NOTE_KINDS[kind] ?? NOTE_KINDS.aviso!;

export function ago(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'ayer' : `hace ${days} días`;
  return new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
}

export function useNotifications(filters: { unread?: boolean; kind?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.unread) params.set('estado', 'sin-leer');
  if (filters.kind) params.set('tipo', filters.kind);
  if (filters.limit) params.set('limite', String(filters.limit));
  const query = params.toString();
  return useQuery({
    queryKey: ['notifications', filters],
    queryFn: () => api<NoteFeed>(`/api/notifications${query ? `?${query}` : ''}`),
    refetchInterval: 60_000,
  });
}

/** Marks a note read and refreshes every list and the campus counters that depend on it. */
export function useNoteActions() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['notifications'] });
    client.invalidateQueries({ queryKey: ['campus'] });
  };
  return {
    async open(note: Note) {
      if (!note.read_at) await api(`/api/notifications/${note.id}/read`, { method: 'POST' }).catch(() => undefined);
      refresh();
      if (note.link) navigate(note.link);
    },
    async read(note: Note) {
      await api(`/api/notifications/${note.id}/read`, { method: 'POST' });
      refresh();
    },
    async readAll(kind?: string) {
      await api(`/api/notifications/read-all${kind ? `?tipo=${kind}` : ''}`, { method: 'POST' });
      refresh();
    },
  };
}

export function NoteRow({ note, onOpen }: { note: Note; onOpen: (note: Note) => void }) {
  const kind = kindOf(note.kind);
  return (
    <button className={`note-item${note.read_at ? '' : ' unread'}`} onClick={() => onOpen(note)} data-kind={note.kind}>
      <span className={`note-ico tile ${kind.tone}`}><kind.icon size={15} strokeWidth={2.4} /></span>
      <span className="note-text">
        <b>{note.title}</b>
        <span className="muted">{note.body}</span>
        <small>{kind.label} · {ago(note.created_at)}</small>
      </span>
      {note.link && <ChevronRight size={16} className="note-go" aria-label="Ir" />}
    </button>
  );
}
