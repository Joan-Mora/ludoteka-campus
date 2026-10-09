import { useSyncExternalStore } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'lk_theme';
const listeners = new Set<() => void>();
const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

function read(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && systemDark());
  if (dark) document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e0b22' : '#140f2e');
}

let current: ThemeChoice = typeof window === 'undefined' ? 'system' : read();

if (typeof window !== 'undefined') {
  apply(current);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (current === 'system') {
      apply(current);
      listeners.forEach((fn) => fn());
    }
  });
}

export function setTheme(choice: ThemeChoice) {
  current = choice;
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch { /* almacenamiento bloqueado */ }
  apply(choice);
  listeners.forEach((fn) => fn());
}

/** Whether this device already has its own choice; the account's theme only fills in when it does not. */
export function hasDeviceTheme() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function isDark() {
  return document.documentElement.dataset.theme === 'dark';
}

export function toggleTheme() {
  setTheme(isDark() ? 'light' : 'dark');
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function useTheme() {
  const choice = useSyncExternalStore(subscribe, () => current, () => 'system' as ThemeChoice);
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  return { choice, dark, setTheme, toggleTheme };
}
