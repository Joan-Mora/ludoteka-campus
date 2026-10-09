import { useSyncExternalStore } from 'react';

export type Layout = 'mobile' | 'desktop';

// Escritorio: pantallas anchas, o ventanas medianas con mouse. Móvil: teléfonos, tabletas en vertical y ventanas angostas.
const DESKTOP_QUERY = '(min-width: 901px), (pointer: fine) and (min-width: 641px)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  if (media.addEventListener) {
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }
  media.addListener(onChange);
  return () => media.removeListener(onChange);
}

const snapshot = (): Layout => (window.matchMedia(DESKTOP_QUERY).matches ? 'desktop' : 'mobile');

export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, snapshot, () => 'desktop');
}
