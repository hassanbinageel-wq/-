import type { Settings } from '../db/schema';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as [number, number, number];
}
const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

export function mix(a: string, b: string, t: number) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const onColor = (hex: string) => (luminance(hex) > 0.45 ? '#0f1b24' : '#ffffff');

let media: MediaQueryList | null = null;

export function isDark(mode: Settings['themeMode']) {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(s: Pick<Settings, 'themeMode' | 'primaryColor'>, onSystemChange?: () => void) {
  const root = document.documentElement;
  const dark = isDark(s.themeMode);
  root.dataset.theme = dark ? 'dark' : 'light';
  const p = s.primaryColor || '#0f766e';
  const primary = dark && luminance(p) < 0.08 ? mix(p, '#ffffff', 0.25) : p;
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-strong', mix(primary, '#000000', 0.18));
  root.style.setProperty('--primary-soft', dark ? mix(primary, '#12181d', 0.78) : mix(primary, '#ffffff', 0.9));
  root.style.setProperty('--on-primary', onColor(primary));
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#151c22' : '#ffffff');
  if (!media && window.matchMedia) {
    media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener?.('change', () => onSystemChange?.());
  }
  return dark;
}

export const PRESET_COLORS = ['#0f766e', '#1d4ed8', '#7c3aed', '#be123c', '#b45309', '#15803d', '#0e7490', '#334155', '#9d174d', '#854d0e'];
