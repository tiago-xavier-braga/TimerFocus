import type { AppState } from "./native";
import { formatDuration, formatHours } from "./stopwatch";

// Local calendar date, e.g. "2026-10-19".
export function dayKey(time = Date.now()): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Adds counted time to today's log; the "" key is time counted with no task selected.
export function logTime(state: AppState, taskId: string, ms: number): void {
  const date = dayKey();
  if (state.today.date !== date) state.today = { date, ms: {} };
  state.today.ms[taskId] = (state.today.ms[taskId] ?? 0) + ms;
}

interface Row {
  name: string;
  color: string;
  ms: number;
  totalMs?: number; // all-time hours; missing for "No task" and "Removed tasks"
  isNew: boolean;
  done: boolean;
}

// Tasks created today or with time counted today, longest first.
function todayRows(state: AppState): Row[] {
  const today = dayKey();
  const log = state.today.date === today ? state.today.ms : {};
  const rows: Row[] = state.tasks
    .map((t) => ({ name: t.name, color: t.color, ms: log[t.id] ?? 0, totalMs: t.totalMs, isNew: !!t.createdAt && dayKey(t.createdAt) === today, done: t.done }))
    .filter((r) => r.ms > 0 || r.isNew);

  const known = new Set(state.tasks.map((t) => t.id));
  const removed = Object.entries(log).reduce((sum, [id, ms]) => (id && !known.has(id) ? sum + ms : sum), 0);
  if (removed) rows.push({ name: "Removed tasks", color: "var(--track)", ms: removed, isNew: false, done: false });
  if (log[""]) rows.push({ name: "No task", color: "var(--muted)", ms: log[""], isNew: false, done: false });
  return rows.sort((a, b) => b.ms - a.ms);
}

function el(tag: string, className: string, text = ""): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

export function renderReport(container: HTMLElement, state: AppState): void {
  const rows = todayRows(state);
  const total = rows.reduce((sum, r) => sum + r.ms, 0);
  const longest = Math.max(1, ...rows.map((r) => r.ms));
  const created = rows.filter((r) => r.isNew).length;

  const head = el("div", "report-head");
  const date = new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  head.append(el("span", "report-title", `Today · ${date}`), el("span", "report-total", formatDuration(total)));
  const summary = el("p", "report-summary", rows.length ? `${rows.length} in the report · ${created} created today` : "");

  const list = el("ul", "report-list");
  list.append(
    ...rows.map((r) => {
      const li = el("li", "report-row");
      li.classList.toggle("done", r.done);
      const dot = el("i", "");
      dot.style.background = r.color;
      li.append(dot, el("span", "name", r.name));
      if (r.isNew) li.append(el("span", "tag", "new"));
      const times = el("span", "times");
      times.append(el("span", "today", `${formatDuration(r.ms)} today`));
      if (r.totalMs !== undefined) times.append(el("span", "total", `${formatHours(r.totalMs)} total`));
      li.append(times);
      const bar = el("span", "bar");
      bar.style.width = `${(r.ms / longest) * 100}%`;
      li.append(bar);
      return li;
    }),
  );
  container.replaceChildren(head, summary, list);
}
