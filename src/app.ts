/** Ο πυρήνας της εφαρμογής: ο πίνακας, τα βασικά στοιχεία της οθόνης και μικρά βοηθητικά που χρειάζονται όλοι. */

// η στρογγυλή γραμματοσειρά του Δημοτικού (με γ που κλείνει σε κυκλάκι, όπως το γράφουν τα παιδιά), μέσα στην εφαρμογή για χρήση χωρίς ίντερνετ
import '@fontsource/playpen-sans/greek-400.css';
import '@fontsource/playpen-sans/greek-600.css';
import '@fontsource/playpen-sans/greek-800.css';
import '@fontsource/playpen-sans/latin-400.css';
import '@fontsource/playpen-sans/latin-600.css';
import '@fontsource/playpen-sans/latin-800.css';
import './style.css';
import { Board, SizedTool } from './board';
import { Timer } from './timer';
import { closeOverlay, isNative, isOverlay, nativeSave } from './native';
import { Curtain, Spotlight } from './overlays';
import { mountUi } from './ui';

/** Βασικά χρώματα ανά φόντο· ίδια θέση = αντίστοιχο χρώμα στο άλλο φόντο. */
export const PALETTE = {
  light: ['#111111', '#e11d48', '#2563eb', '#16a34a'],
  dark: ['#ffffff', '#fb7185', '#7dd3fc', '#86efac'],
};
/** Χρώματα του υπογραμμιστικού (ίδια σε κάθε φόντο). */
export const HL_PALETTE = ['#fde047', '#86efac', '#f9a8d4', '#7dd3fc'];
export const MORE_COLORS = [
  '#111111', '#6b7280', '#d1d5db', '#ffffff', '#92400e', '#d6a36c',
  '#b91c1c', '#ef4444', '#fb7185', '#f472b6', '#be185d', '#a21caf',
  '#ea580c', '#f59e0b', '#fde047', '#a3e635', '#16a34a', '#166534',
  '#0f766e', '#2dd4bf', '#7dd3fc', '#2563eb', '#1e3a8a', '#7c3aed',
];
export const SIZES: Record<SizedTool, number[]> = {
  pen: [2, 4, 8, 16],
  highlighter: [2, 4, 8, 16],
  eraser: [8, 16, 32, 64],
};
export const SIZE_NAME = ['Λεπτό', 'Κανονικό', 'Παχύ', 'Πολύ παχύ'];
export const app = document.getElementById('app')!;
mountUi(app);

export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** Ξαναστήνει τη γραμμή εργαλείων και τη δεύτερη σειρά της. */
export let layoutBar = (): void => {};
export function setLayoutBar(f: () => void): void {
  layoutBar = f;
}
export const timer = new Timer(app);
export const curtainTop = new Curtain(app, 'top');
export const curtain = new Curtain(app, 'bottom');
export const spot = new Spotlight(app);
export const board = new Board($('base') as HTMLCanvasElement, $('live') as HTMLCanvasElement);
if (isOverlay) {
  board.transparent = true;
  document.documentElement.classList.add('overlay');
  $('overlayClose').classList.remove('hidden');
  $('overlayClose').onclick = () => void closeOverlay();
}

// ---------- helpers ----------

let toastTimer = 0;
/** Σύντομο μήνυμα πάνω στη μέση. `action`: κουμπί δίπλα στο μήνυμα (π.χ. «Αναίρεση»). */
export function toast(msg: string, ms = 3000, action?: { label: string; run: () => void }): void {
  const t = $('toast');
  t.textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = () => {
      t.classList.add('hidden');
      action.run();
    };
    t.append(b);
  }
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = window.setTimeout(() => t.classList.add('hidden'), ms);
}

export function download(blob: Blob, name: string): void {
  if (isNative) {
    nativeSave(blob, name)
      .then((ok) => ok && toast('Αποθηκεύτηκε'))
      .catch((err) => toast(`Αποτυχία αποθήκευσης: ${err}`, 6000));
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Όνομα κατάλληλο για αρχείο. */
export function fileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_').trim() || 'pinakas';
}

export function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
