import { Fragment, type ReactNode } from 'react';
import { BookOpen } from 'lucide-react';

export interface Citation {
  n: number;
  itemId: string;
  title: string;
  page: number | null;
  excerpt: string;
  url: string;
}

/** The prompts forbid LaTeX, but the model still slips some in; it is shown as plain school notation instead. */
function plainMath(text: string) {
  return text
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\\[()[\]]/g, '')
    .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\(div|times|cdot)\b/g, (_, op) => (op === 'div' ? '÷' : '×'))
    .replace(/\\(left|right)\b/g, '')
    .replace(/\\[,;!]/g, ' ');
}

function inline(text: string, citations: Citation[] | undefined, keyBase: string): ReactNode[] {
  const parts = plainMath(text).split(/(\*\*[^*]+\*\*|\[\d+\])/g);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <b key={key}>{part.slice(2, -2)}</b>;
    const cite = /^\[(\d+)\]$/.exec(part);
    if (cite) {
      const source = citations?.find((c) => c.n === Number(cite[1]));
      if (!source) return <Fragment key={key}>{part}</Fragment>;
      return (
        <a key={key} className="cite" href={source.url} target="_blank" rel="noreferrer" title={`${source.title}${source.page ? `, pág. ${source.page}` : ''}`}>
          {source.n}
        </a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

/** Renders the small Markdown subset the AI returns: paragraphs, bullet and numbered lists, bold and [n] citations. */
export function RichText({ text, citations }: { text: string; citations?: Citation[] }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    const index = blocks.length;
    blocks.push(<Tag key={`l${index}`} className="rt-list">{list.items.map((item, i) => <li key={i}>{inline(item, citations, `l${index}-${i}`)}</li>)}</Tag>);
    list = null;
  };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    const bullet = /^[*-]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]!);
      return;
    }
    flush();
    if (line) blocks.push(<p key={`p${i}`} className="rt-p">{inline(line.replace(/^#+\s*/, ''), citations, `p${i}`)}</p>);
  });
  flush();
  return <div className="rich-text">{blocks}</div>;
}

export function Sources({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <div className="sources">
      {citations.map((c) => (
        <a key={c.n} href={c.url} target="_blank" rel="noreferrer" className="source">
          <span className="cite">{c.n}</span>
          <BookOpen size={13} />
          <span className="source-title">{c.title}</span>
          {c.page && <span className="muted">pág. {c.page}</span>}
        </a>
      ))}
    </div>
  );
}
