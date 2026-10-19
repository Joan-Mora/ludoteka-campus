import { useState } from 'react';
import { Loader2 } from 'lucide-react';

type Move = Record<string, unknown>;
type Play = Record<string, unknown>;

export function PlayBoard({ play, onMove }: { play: Play; onMove: (move: Move) => Promise<string> }) {
  const kind = String(play.kind ?? '');
  if (kind === 'balanza') return <Balanza play={play} onMove={onMove} />;
  if (kind === 'barras') return <Barras play={play} onMove={onMove} />;
  if (kind === 'fichas') return <Fichas play={play} onMove={onMove} />;
  if (kind === 'areas') return <Areas play={play} onMove={onMove} />;
  if (kind === 'proporcion') return <Proporcion play={play} onMove={onMove} />;
  if (kind === 'cruce') return <Cruce play={play} onMove={onMove} />;
  if (kind === 'gauss') return <Gauss play={play} onMove={onMove} />;
  if (kind === 'relato') return <Relato play={play} onMove={onMove} />;
  if (kind === 'encuesta') return <Encuesta play={play} onMove={onMove} />;
  return null;
}

function useNote(onMove: (move: Move) => Promise<string>) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function go(move: Move) {
    setBusy(true);
    try { setNote(await onMove(move)); } finally { setBusy(false); }
  }
  return { note, busy, go };
}

function Balanza({ play, onMove }: { play: Play; onMove: (move: Move) => Promise<string> }) {
  const { note, busy, go } = useNote(onMove);
  const [n, setN] = useState(1);
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p className="muted">Balanza {String(play.round)} de {String(play.rounds)}. Lo que hagas en un lado, hazlo en el otro.</p>
      <p className="display" style={{ fontSize: 36, textAlign: 'center' }}>{String(play.equation)}</p>
      <div className="row g-8 wrap">
        <label className="field" style={{ margin: 0, width: 120 }}>Número<input type="number" min={1} max={40} value={n} onChange={(e) => setN(Number(e.target.value))} /></label>
        <button className="btn" disabled={busy} onClick={() => go({ action: 'sub', n })}>Restar en los dos lados</button>
        <button className="btn ghost" disabled={busy} onClick={() => go({ action: 'add', n })}>Sumar en los dos lados</button>
        <button className="btn ghost" disabled={busy} onClick={() => go({ action: 'div', n })}>Dividir los dos lados</button>
      </div>
      {note && <p>{note}</p>}
    </div>
  );
}

function Barras({ play, onMove }: { play: Play; onMove: (move: Move) => Promise<string> }) {
  const { note, busy, go } = useNote(onMove);
  const pieces = Number(play.pieces ?? 0);
  const shaded = Number(play.shaded ?? 0);
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p>{String(play.prompt)}</p>
      <div className="row g-4" style={{ minHeight: 42 }}>
        {Array.from({ length: pieces }, (_, i) => (
          <button key={i} className="btn sm" style={{ background: i < shaded ? 'var(--violet)' : 'transparent', minWidth: 28 }} onClick={() => go({ action: 'shade', n: i + 1 })}>{i + 1}</button>
        ))}
      </div>
      <div className="row g-8 wrap">
        {[2, 3, 4, 6, 8, 12].map((n) => <button key={n} className="btn sm ghost" disabled={busy} onClick={() => go({ action: 'pieces', n })}>Partir en {n}</button>)}
        <button className="btn" disabled={busy || !pieces} onClick={() => go({ action: 'check' })}>Comprobar</button>
      </div>
      {note && <p>{note}</p>}
    </div>
  );
}

function Fichas({ play, onMove }: { play: Play; onMove: (move: Move) => Promise<string> }) {
  const { note, busy, go } = useNote(onMove);
  const [tile, setTile] = useState('x');
  const grid = (play.grid as string[]) ?? [];
  const cols = Number(play.cols ?? 1);
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p>{String(play.prompt)}</p>
      <div className="row g-8">
        {[['x2', 'x²'], ['x', 'x'], ['1', '1'], ['', 'borrar']].map(([id, label]) => (
          <button key={label} className={`btn sm ${tile === id ? '' : 'ghost'}`} onClick={() => setTile(id!)}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 46px)`, gap: 6 }}>
        {grid.map((cell, index) => (
          <button key={index} className="btn sm" style={{ height: 46 }} disabled={busy} onClick={() => go({ action: 'put', index, tile })}>{cell === 'x2' ? 'x²' : cell === 'x' ? 'x' : cell === '1' ? '1' : ''}</button>
        ))}
      </div>
      <button className="btn" disabled={busy} onClick={() => go({ action: 'check' })}>Comprobar el rectángulo</button>
      {note && <p>{note}</p>}
    </div>
  );
}

function Areas({ play, onMove }: { play: Play; onMove: (move: Move) => Promise<string> }) {
  const { note, busy, go } = useNote(onMove);
  const on = (play.on as boolean[]) ?? [];
  const cols = Number(play.cols ?? 8);
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p>Pinta un rectángulo de área {String(play.target)}. Llevas {String(play.painted)}.</p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 32px)`, gap: 4 }}>
        {on.map((cell, index) => (
          <button key={index} aria-label={`casilla ${index + 1}`} style={{ height: 32, borderRadius: 6, border: '1px solid var(--line)', background: cell ? 'var(--violet)' : 'transparent' }} disabled={busy} onClick={() => go({ action: 'paint', index })} />
        ))}
      </div>
      <button className="btn" disabled={busy} onClick={() => go({ action: 'check' })}>Comprobar</button>
      {note && <p>{note}</p>}
    </div>
  );
}

function Proporcion({ play, onMove }: { play: Play; onMove: (move: Move) => Promise<string> }) {
  const { note, busy, go } = useNote(onMove);
  const milk = Number(play.milk ?? 0);
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p>Pedido {String(play.round)} de {String(play.rounds)}. {String(play.prompt)}</p>
      <p className="display" style={{ fontSize: 32 }}>{milk} vasos</p>
      <div className="row g-8">
        <button className="btn ghost" disabled={busy} onClick={() => go({ action: 'milk', n: Math.max(0, milk - 1) })}>−</button>
        <button className="btn ghost" disabled={busy} onClick={() => go({ action: 'milk', n: milk + 1 })}>+</button>
        <button className="btn" disabled={busy} onClick={() => go({ action: 'check' })}>Servir</button>
      </div>
      {note && <p>{note}</p>}
    </div>
  );
}

function Cruce({ play, onMove }: { play: Play; onMove: (move: Move) => Promise<string> }) {
  const yours = (play.yours as { m1: number; b1: number; m2: number; b2: number }) ?? { m1: 1, b1: 0, m2: -1, b2: 0 };
  const { note, busy, go } = useNote(onMove);
  const [line, setLine] = useState(yours);
  const equations = (play.equations as string[]) ?? [];
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p>Acomoda las dos rectas para que sean estas:</p>
      {equations.map((eq) => <p key={eq} className="display" style={{ fontSize: 22 }}>{eq}</p>)}
      {(['m1', 'b1', 'm2', 'b2'] as const).map((key) => (
        <label key={key} className="field">{key === 'm1' ? 'Pendiente de la primera' : key === 'b1' ? 'Corte de la primera' : key === 'm2' ? 'Pendiente de la segunda' : 'Corte de la segunda'}
          <input type="number" value={line[key]} onChange={(e) => setLine({ ...line, [key]: Number(e.target.value) })} />
        </label>
      ))}
      <button className="btn" disabled={busy} onClick={() => go({ action: 'set', n: line.m1, b1: line.b1, m2: line.m2, b2: line.b2 })}>{busy ? <Loader2 className="spin" size={16} /> : null} Poner las rectas</button>
      {note && <p>{note}</p>}
    </div>
  );
}

function Gauss({ play, onMove }: { play: Play; onMove: (move: Move) => Promise<string> }) {
  const { note, busy, go } = useNote(onMove);
  const cells = (play.cells as string[][]) ?? [];
  const steps = (play.steps as string[]) ?? [];
  const [i, setI] = useState(0);
  const [j, setJ] = useState(1);
  const [k, setK] = useState(1);
  const [custom, setCustom] = useState('2, 1, 5\n1, -1, 1');
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p>Opera las filas hasta dejar unos en la diagonal y ceros en el resto. La última columna es el resultado.</p>
      <table>
        <tbody>
          {cells.map((row, index) => <tr key={index}>{row.map((cell, col) => <td key={col} style={{ padding: 6, fontWeight: 700 }}>{cell}</td>)}</tr>)}
        </tbody>
      </table>
      <div className="row g-8 wrap">
        <label className="field" style={{ margin: 0 }}>Fila<input type="number" min={1} value={i + 1} onChange={(e) => setI(Number(e.target.value) - 1)} /></label>
        <label className="field" style={{ margin: 0 }}>Otra fila<input type="number" min={1} value={j + 1} onChange={(e) => setJ(Number(e.target.value) - 1)} /></label>
        <label className="field" style={{ margin: 0 }}>Número<input type="number" value={k} onChange={(e) => setK(Number(e.target.value))} /></label>
      </div>
      <div className="row g-8 wrap">
        <button className="btn sm ghost" disabled={busy} onClick={() => go({ action: 'swap', n: i, index: j })}>Intercambiar</button>
        <button className="btn sm ghost" disabled={busy} onClick={() => go({ action: 'scale', index: i, n: k })}>Multiplicar la fila</button>
        <button className="btn sm ghost" disabled={busy} onClick={() => go({ action: 'add', index: i, from: j, n: k })}>Sumar el múltiplo</button>
        <button className="btn sm" disabled={busy} onClick={() => go({ action: 'check' })}>Comprobar</button>
        <button className="btn sm ghost" disabled={busy} onClick={() => go({ action: 'explain' })}>Explícame esta</button>
      </div>
      <label className="field">O escribe tu propia matriz, una fila por línea
        <textarea value={custom} onChange={(e) => setCustom(e.target.value)} rows={3} />
      </label>
      <button className="btn ghost" disabled={busy} onClick={() => go({ action: 'libre', matrix: custom.split('\n').map((line) => line.split(/[,;\s]+/).filter(Boolean)) })}>Explicar mi matriz</button>
      {steps.map((step) => <p key={step} className="muted">{step}</p>)}
      {note && <p>{note}</p>}
    </div>
  );
}

function Relato({ play, onMove }: { play: Play; onMove: (move: Move) => Promise<string> }) {
  const puzzle = (play.puzzle as Play) ?? {};
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card">
        <p className="eyebrow">{String(play.title)} · {String(play.scene)}/{String(play.scenes)}</p>
        <p>{String(play.text)}</p>
      </div>
      <Fichas play={puzzle} onMove={onMove} />
    </div>
  );
}

function Encuesta({ play, onMove }: { play: Play; onMove: (move: Move) => Promise<string> }) {
  const { note, busy, go } = useNote(onMove);
  const values = (play.values as number[]) ?? [];
  const bars = (play.bars as number[]) ?? [0, 0, 0, 0, 0];
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p className="muted">Encuesta {String(play.round)} de {String(play.rounds)}. Sube cada barra hasta contar cuántas veces sale ese número.</p>
      <p className="row g-8 wrap">{values.map((value, i) => <span key={i} className="chip">{value}</span>)}</p>
      <div className="row g-8 wrap" style={{ alignItems: 'flex-end' }}>
        {bars.map((height, i) => (
          <div key={i} className="stack g-8" style={{ alignItems: 'center' }}>
            <div style={{ width: 36, height: Math.max(8, height * 18), background: 'var(--violet)', borderRadius: 8 }} />
            <b>{height}</b>
            <span>{i + 1}</span>
            <button className="btn sm" disabled={busy} onClick={() => go({ action: 'bar', index: i, n: 1 })}>+</button>
            <button className="btn sm ghost" disabled={busy} onClick={() => go({ action: 'bar', index: i, n: -1 })}>−</button>
          </div>
        ))}
      </div>
      <button className="btn" disabled={busy} onClick={() => go({ action: 'check' })}>Comprobar gráfica</button>
      {note && <p>{note}</p>}
    </div>
  );
}

export function CoopBoard({ play, onMove }: { play: { equation?: string; turn?: string; yours?: boolean; role?: string; round?: number; rounds?: number; waiting?: boolean; log?: string[] }; onMove: (move: Move) => Promise<string> }) {
  const { note, busy, go } = useNote(onMove);
  const [n, setN] = useState(1);
  if (play.waiting) return <p className="card">Tu mesa está abierta. Cuando alguien se siente, la ecuación aparece para los dos.</p>;
  const fire = play.turn === 'fire';
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p className="muted">Compuerta {play.round} de {play.rounds}. {play.role}</p>
      <p className="display" style={{ fontSize: 34, textAlign: 'center' }}>{play.equation}</p>
      <p>{play.yours ? 'Te toca.' : 'Le toca a tu pareja.'}</p>
      {play.yours && (
        <div className="row g-8 wrap">
          <input type="number" min={1} value={n} onChange={(e) => setN(Number(e.target.value))} style={{ width: 80 }} />
          {fire ? (
            <>
              <button className="btn" disabled={busy} onClick={() => go({ action: 'sub', n })}>Restar</button>
              <button className="btn ghost" disabled={busy} onClick={() => go({ action: 'add', n })}>Sumar</button>
            </>
          ) : <button className="btn" disabled={busy} onClick={() => go({ action: 'div', n })}>Dividir</button>}
        </div>
      )}
      {(play.log ?? []).map((line) => <p key={line} className="muted">{line}</p>)}
      {note && <p>{note}</p>}
    </div>
  );
}
