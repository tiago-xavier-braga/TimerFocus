// Bridge to the Electron main process (electron/preload.cjs).
// In a plain browser (npm run dev:web) it falls back to localStorage and no-ops.

export type Theme = "light" | "dark";

export interface Task {
  id: string;
  name: string;
  color: string;
  totalMs: number;
  done: boolean;
}

export interface AppState {
  tasks: Task[];
  theme: Theme | null; // null = follow the system
  pinned: boolean;
}

interface Bridge {
  loadState(): Promise<Partial<AppState>>;
  saveState(state: AppState): Promise<void>;
  saveStateSync(state: AppState): void;
  setAlwaysOnTop(on: boolean): void;
  setTheme(theme: Theme | null): void;
}

declare global {
  interface Window {
    timerFocus?: Bridge;
  }
}

const DEFAULTS: AppState = { tasks: [], theme: null, pinned: false };
const KEY = "timer-focus";
const bridge = window.timerFocus;

export async function loadState(): Promise<AppState> {
  const saved = bridge ? await bridge.loadState() : JSON.parse(localStorage.getItem(KEY) ?? "{}");
  return { ...DEFAULTS, ...saved };
}

export function saveState(state: AppState): void {
  if (bridge) void bridge.saveState(state);
  else localStorage.setItem(KEY, JSON.stringify(state));
}

// Blocking save, for when the window is closing.
export function saveStateSync(state: AppState): void {
  if (bridge) bridge.saveStateSync(state);
  else localStorage.setItem(KEY, JSON.stringify(state));
}

export function setAlwaysOnTop(on: boolean): void {
  bridge?.setAlwaysOnTop(on);
}

export function setNativeTheme(theme: Theme | null): void {
  bridge?.setTheme(theme);
}
