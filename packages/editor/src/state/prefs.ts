import { signal } from '@preact/signals';
import { TOOLS, type ToolId } from '../tools/registry';

/** Programm-Einstellungen (nicht projektbezogen), in localStorage `rgm.prefs`. */
export interface Prefs {
  /** Oberflächen-Zoom 1–2. */
  uiScale: number;
  hintsEnabled: boolean;
  hintsHiddenFor: ToolId[];
}

const KEY = 'rgm.prefs';
const DEFAULTS: Prefs = { uiScale: 1, hintsEnabled: true, hintsHiddenFor: [] };
const TOOL_IDS = new Set<string>(TOOLS.map((tool) => tool.id));

export function loadPrefs(): Prefs {
  try {
    const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return { ...DEFAULTS, hintsHiddenFor: [] };
    const r = raw as Record<string, unknown>;
    const scale = typeof r.uiScale === 'number' && Number.isFinite(r.uiScale) ? r.uiScale : 1;
    return {
      uiScale: Math.min(2, Math.max(1, scale)),
      hintsEnabled: r.hintsEnabled !== false,
      hintsHiddenFor: Array.isArray(r.hintsHiddenFor)
        ? [...new Set(r.hintsHiddenFor.filter((x): x is ToolId => typeof x === 'string' && TOOL_IDS.has(x)))]
        : [],
    };
  } catch {
    return { ...DEFAULTS, hintsHiddenFor: [] };
  }
}

/** Speichert; ohne localStorage (privater Modus, voll) bleibt es still bei der laufenden Sitzung. */
export function savePrefs(p: Prefs): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(p));
  } catch {
    /* nicht speicherbar – gilt dann nur bis zum Neuladen */
  }
}

/** Aktuelle Einstellungen für die Oberfläche. */
export const prefs = signal<Prefs>(loadPrefs());

export function updatePrefs(patch: Partial<Prefs>): void {
  prefs.value = { ...prefs.value, ...patch };
  savePrefs(prefs.value);
}
