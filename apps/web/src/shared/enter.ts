const SVG_NS = 'http://www.w3.org/2000/svg';

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> } };

/** Copy of the clicked drawing at its place on screen; it carries the transition name so the browser can grow it into the facade. */
function ghostOf(source: SVGGraphicsElement) {
  const rect = source.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const box = source.getBBox();
  const ghost = document.createElementNS(SVG_NS, 'svg');
  ghost.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('class', 'enter-ghost');
  Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  const copy = source.cloneNode(true) as SVGGraphicsElement;
  copy.removeAttribute('data-mini');
  ghost.appendChild(copy);
  // Outside <body>, which carries the TV zoom, so client coordinates apply as they are.
  document.documentElement.appendChild(ghost);
  return ghost;
}

/** Resolves when the destination's header is on screen, or after `timeout` (lazy pages may still be loading). */
function arrived(path: string, timeout: number) {
  const start = performance.now();
  return new Promise<void>((resolve) => {
    const check = () => {
      if (document.querySelector(`[data-at="${CSS.escape(path)}"]`) || performance.now() - start > timeout) resolve();
      else window.setTimeout(check, 16);
    };
    check();
  });
}

/**
 * «Entrar al edificio»: the building drawing grows into the page facade while the old page steps back.
 * Without the View Transitions API, or with reduced motion, it is a plain navigation.
 */
export function enterBuilding(navigate: (to: string) => void, to: string, source?: Element | null) {
  const doc = document as ViewTransitionDocument;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduced || to === window.location.pathname) {
    navigate(to);
    return;
  }
  const ghost = source instanceof SVGGraphicsElement ? ghostOf(source) : null;
  // Two elements with the same transition name cancel the animation; the clicked drawing wins over the current facade.
  const current = ghost ? Array.from(document.querySelectorAll<SVGElement>('.facade-art')) : [];
  current.forEach((el) => { el.style.viewTransitionName = 'none'; });
  const root = document.documentElement;
  root.classList.add('entering');
  const done = () => {
    root.classList.remove('entering');
    current.forEach((el) => { el.style.viewTransitionName = ''; });
  };
  try {
    doc
      .startViewTransition(async () => {
        ghost?.remove();
        navigate(to);
        await arrived(to, 900);
      })
      .finished.catch(() => undefined)
      .finally(done);
  } catch {
    ghost?.remove();
    done();
    navigate(to);
  }
}
