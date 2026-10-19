import { confirm, editPrompt } from "./modal";
import { loadState, saveState, saveStateSync, setAlwaysOnTop, setNativeTheme, type AppState, type Task, type Theme } from "./native";
import { Ring } from "./ring";
import { MS_PER_HOUR, Stopwatch, formatClock, formatHours, toHours } from "./stopwatch";

const PALETTE = ["#e0883a", "#e5584f", "#d4a72c", "#4caf7a", "#4a90d9", "#9b6bd6"];
const TICK_MS = 250;
const AUTOSAVE_MS = 15_000;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const timeEl = $("time");
const activeEl = $("active-task");
const playBtn = $("play");
const listEl = $<HTMLUListElement>("tasks");
const addForm = $<HTMLFormElement>("add-form");
const addName = $<HTMLInputElement>("add-name");
const addColor = $("add-color");
const pinBtn = $("pin");

const sw = new Stopwatch();
const ring = new Ring(
  document.getElementById("ring-spin") as unknown as SVGGElement,
  document.getElementById("ring-arc") as unknown as SVGCircleElement,
);

let state: AppState;
let activeId: string | null = null;
let credited = 0; // part of the current session already added to the active task
let ticker = 0;
let lastSave = 0;
let addColorIndex = 0;
const hoursEls = new Map<string, HTMLElement>();

const activeTask = (): Task | undefined => state.tasks.find((t) => t.id === activeId);

// Moves time counted since the last credit into the active task.
function credit(): void {
  const elapsed = sw.elapsed();
  const task = activeTask();
  if (task) task.totalMs += elapsed - credited;
  credited = elapsed;
}

function save(): void {
  lastSave = Date.now();
  saveState(state);
}

// ---------- Timer ----------

function tick(): void {
  credit();
  timeEl.textContent = formatClock(sw.elapsed());
  const task = activeTask();
  if (task) hoursEls.get(task.id)!.textContent = formatHours(task.totalMs);
  if (Date.now() - lastSave > AUTOSAVE_MS) save();
}

function play(): void {
  sw.start();
  ring.play();
  document.body.classList.add("running");
  playBtn.title = "Pause";
  ticker = window.setInterval(tick, TICK_MS);
}

function pause(): void {
  sw.pause();
  tick();
  save();
  ring.pause();
  document.body.classList.remove("running");
  playBtn.title = "Play";
  clearInterval(ticker);
}

// Zeroes the display; time already counted stays on the task.
function zero(): void {
  credit();
  sw.zero();
  credited = 0;
  timeEl.textContent = formatClock(0);
}

function reset(): void {
  if (sw.running) pause();
  if (sw.elapsed() === 0) return;
  zero();
  save();
  ring.rewind();
}

playBtn.addEventListener("click", () => (sw.running ? pause() : play()));
$("reset").addEventListener("click", reset);

// ---------- Tasks ----------

// Changes the active task. While running, asks first; on confirm the time stays on the
// previous task and the timer goes back to 00:00:00.
async function selectTask(id: string | null, title = "Switch task?"): Promise<boolean> {
  if (id === activeId) return true;
  const elapsed = sw.elapsed();
  if (sw.running && elapsed > 0) {
    const from = activeTask();
    const text = from
      ? `${formatClock(elapsed)} will be saved to "${from.name}" and the timer goes back to 00:00:00.`
      : `The current time (${formatClock(elapsed)}) is not linked to any task and the timer goes back to 00:00:00.`;
    if (!(await confirm(title, text))) return false;
  }
  zero();
  activeId = id;
  save();
  render();
  if (elapsed > 0) ring.rewind(sw.running ? () => ring.play() : undefined);
  return true;
}

async function toggleDone(task: Task): Promise<void> {
  if (task.id === activeId && !(await selectTask(null, "Complete active task?"))) return;
  task.done = !task.done;
  save();
  render();
}

async function removeTask(task: Task): Promise<void> {
  if (task.id === activeId) {
    if (!(await selectTask(null, "Remove active task?"))) return;
  } else if (task.totalMs > 0 && !(await confirm("Remove task?", `"${task.name}" has ${formatHours(task.totalMs)} tracked.`))) {
    return;
  }
  state.tasks = state.tasks.filter((t) => t.id !== task.id);
  save();
  render();
}

function cycleColor(task: Task): void {
  task.color = PALETTE[(PALETTE.indexOf(task.color) + 1) % PALETTE.length];
  save();
  render();
}

// Hours are only written back when changed, so a rename doesn't round away counted time.
async function editTask(task: Task): Promise<void> {
  const hours = toHours(task.totalMs);
  const edit = await editPrompt(task.name, hours);
  if (!edit) return;
  if (edit.name) task.name = edit.name;
  if (edit.hours !== hours) task.totalMs = Math.round(edit.hours * MS_PER_HOUR);
  save();
  render();
}

const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>';
const EDIT_SVG = '<svg viewBox="0 0 24 24"><path d="M16.8 3.8a2.4 2.4 0 0 1 3.4 3.4L8.7 18.7 3.5 20.5l1.8-5.2z"/><path d="M14.8 5.8l3.4 3.4"/></svg>';
const DEL_SVG = '<svg viewBox="0 0 24 24"><path d="M4 6.5h16M9.5 6.5v-2h5v2M6.2 6.5l.9 12.6a1.6 1.6 0 0 0 1.6 1.4h6.6a1.6 1.6 0 0 0 1.6-1.4l.9-12.6M10 10.5v6M14 10.5v6"/></svg>';

function render(): void {
  hoursEls.clear();
  listEl.replaceChildren(
    ...state.tasks.map((task) => {
      const li = document.createElement("li");
      li.className = "task";
      li.classList.toggle("active", task.id === activeId);
      li.classList.toggle("done", task.done);

      const check = document.createElement("button");
      check.className = "check";
      check.title = task.done ? "Reopen" : "Complete";
      check.innerHTML = CHECK_SVG;
      check.onclick = (e) => { e.stopPropagation(); void toggleDone(task); };

      const dot = document.createElement("button");
      dot.className = "dot";
      dot.title = "Change color";
      dot.style.background = task.color;
      dot.onclick = (e) => { e.stopPropagation(); cycleColor(task); };

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = task.name;

      const hours = document.createElement("span");
      hours.className = "hours";
      hours.textContent = formatHours(task.totalMs);
      hoursEls.set(task.id, hours);

      const edit = document.createElement("button");
      edit.className = "edit";
      edit.title = "Edit";
      edit.innerHTML = EDIT_SVG;
      edit.onclick = (e) => { e.stopPropagation(); void editTask(task); };

      const del = document.createElement("button");
      del.className = "del";
      del.title = "Remove";
      del.innerHTML = DEL_SVG;
      del.onclick = (e) => { e.stopPropagation(); void removeTask(task); };

      li.append(check, dot, name, hours, edit, del);
      li.onclick = () => {
        if (task.done) return;
        void selectTask(task.id === activeId ? null : task.id);
      };
      return li;
    }),
  );

  const task = activeTask();
  activeEl.replaceChildren();
  if (task) {
    const dot = document.createElement("i");
    dot.style.background = task.color;
    const label = document.createElement("span");
    label.textContent = task.name;
    activeEl.append(dot, label);
  }
}

function setAddColor(index: number): void {
  addColorIndex = index % PALETTE.length;
  addColor.style.background = PALETTE[addColorIndex];
}

addColor.addEventListener("click", () => setAddColor(addColorIndex + 1));

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = addName.value.trim();
  if (!name) return;
  state.tasks.push({ id: crypto.randomUUID(), name, color: PALETTE[addColorIndex], totalMs: 0, done: false });
  addName.value = "";
  setAddColor(addColorIndex + 1);
  save();
  render();
  listEl.scrollTop = listEl.scrollHeight;
});

// ---------- Theme & always on top ----------

const systemDark = matchMedia("(prefers-color-scheme: dark)");

function applyTheme(): void {
  const theme: Theme = state.theme ?? (systemDark.matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  setNativeTheme(state.theme);
}

systemDark.addEventListener("change", applyTheme);

$("theme").addEventListener("click", () => {
  state.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme();
  save();
});

function applyPin(): void {
  pinBtn.setAttribute("aria-pressed", String(state.pinned));
  setAlwaysOnTop(state.pinned);
}

pinBtn.addEventListener("click", () => {
  state.pinned = !state.pinned;
  applyPin();
  save();
});

// ---------- Startup ----------

async function init(): Promise<void> {
  state = await loadState();
  applyTheme();
  applyPin();
  setAddColor(0);
  render();
}

// Flush counted time before the window goes away.
window.addEventListener("beforeunload", () => {
  if (!state) return;
  credit();
  saveStateSync(state);
});

void init();
