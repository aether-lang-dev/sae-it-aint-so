"seal except ui, vg, storage";   // all this app names (docs/app-capabilities.md)
// Pomatez, as a sae app. Ported from zidoro/pomatez (MIT; see NOTICE.md):
// "Stay Focused. Take a Break." A Pomodoro timer, its task list and its
// settings, with Pomatez's rules: focus for 25 minutes, a 5-minute short
// break, and after the session's 4th round a 15-minute long break.
//
// One page with three views (Timer, Tasks, Config) shown one at a time, the
// way Pomatez's single-page app keeps its timer running while you look at
// your tasks. Config and tasks persist in sae's app storage.
const { vstack, hstack, text, btn, divider, textfield, get_text, set_text,
        slider, toggle, set_toggle, set_slider, timer, styles, add_class,
        style_id, set_visible, clear, into, progressbar, set_progress } = ui;

type Period = "STAY_FOCUS" | "SHORT_BREAK" | "LONG_BREAK";
interface Config {
  stayFocus: number; shortBreak: number; longBreak: number;
  sessionRounds: number; autoStartWork: boolean;
}
interface Task { text: string; done: boolean }

// --- Pomatez's defaults and palette (store/config, styles/themes.ts) ---

// A fresh object each time: Pomatez freezes its defaults, and a shared one
// here would be edited by the sliders and then "restored" as edited.
const defaultConfig = (): Config => ({
  stayFocus: 25, shortBreak: 5, longBreak: 15, sessionRounds: 4, autoStartWork: false,
});
const COLOUR: { [p: string]: string } = {
  STAY_FOCUS: "#007bc7", SHORT_BREAK: "#00855f", LONG_BREAK: "#a66703",
};
const LABEL: { [p: string]: string } = {
  STAY_FOCUS: "Stay Focused", SHORT_BREAK: "Short Break", LONG_BREAK: "Long Break",
};

// --- persistence: sae's app storage, JSON strings ---

const loadConfig = (): Config => {
  const s = storage.get("config");
  if (s === null) return defaultConfig();
  try {
    const c = JSON.parse(s);
    return {
      stayFocus: c.stayFocus || 25, shortBreak: c.shortBreak || 5,
      longBreak: c.longBreak || 15, sessionRounds: c.sessionRounds || 4,
      autoStartWork: c.autoStartWork === true,
    };
  } catch (e) {
    return defaultConfig();
  }
};
const loadTasks = (): Task[] => {
  const s = storage.get("tasks");
  if (s === null) return [{ text: "Port Pomatez to sae", done: false }];
  try { return JSON.parse(s); } catch (e) { return []; }
};

let config: Config = loadConfig();
let tasks: Task[] = loadTasks();
const saveConfig = (): void => storage.set("config", JSON.stringify(config));
const saveTasks = (): void => storage.set("tasks", JSON.stringify(tasks));

// --- the timer (Pomatez's CounterContext) ---

let period: Period = "STAY_FOCUS";
let round = 1;
let playing = false;
let duration = config.stayFocus * 60;   // seconds
let count = duration;                   // seconds left, fractional
let last = Date.now();

const minutesFor = (p: Period): number =>
  p === "STAY_FOCUS" ? config.stayFocus : p === "SHORT_BREAK" ? config.shortBreak : config.longBreak;

const pad2 = (n: number): string => (n < 10 ? "0" : "") + n;
const clock = (secs: number): string => {
  const s = Math.max(0, Math.ceil(secs));
  return pad2(Math.floor(s / 60)) + ":" + pad2(s % 60);
};

styles({
  root: { font_family: "sans-serif" },
  "#clock": { font_size: 44, font_weight: "bold", color: COLOUR.STAY_FOCUS },
  "#period": { font_size: 15, color: COLOUR.STAY_FOCUS },
  "#notice": { color: "#db3352" },
  "heading.label": { font_size: 16, font_weight: "bold", color: "#212121" },
  "muted.label": { color: "#666666" },
  button: { color: "#007bc7" },
});

// --- navigation: three views, one shown ---

let views: number[] = [];
const show = (i: number): void => {
  views.forEach((v: number, j: number) => set_visible(v, j === i));
};

hstack(4, () => {
  btn("Timer", () => show(0));
  btn("Tasks", () => show(1));
  btn("Config", () => show(2));
});
divider();

// --- the Timer view ---

const TICKS = 60;
let ticks: number[] = [];
let clockText = 0, periodText = 0, roundText = 0, noticeText = 0, playBtn = 0, focusText = 0;

views.push(vstack(6, () => {
  periodText = text(LABEL.STAY_FOCUS);
  style_id(periodText, "period");
  // The ring: sixty ticks round a clock face, lit for the time left. (Pomatez
  // draws an SVG arc; sae's vg has lines and per-shape opacity.)
  vg.scene("0 0 200 200", 220, 220, () => {
    for (let i = 0; i < TICKS; i++) {
      const a = (i / TICKS) * 2 * Math.PI;
      const sx = Math.sin(a), cy = -Math.cos(a);
      ticks.push(vg.line(100 + 78 * sx, 100 + 78 * cy, 100 + 94 * sx, 100 + 94 * cy, () => {
        vg.stroke(COLOUR.STAY_FOCUS, 4);
      }));
    }
  });
  clockText = text(clock(count));
  style_id(clockText, "clock");
  roundText = text("");
  hstack(6, () => {
    playBtn = btn("Start", () => (playing ? pause() : play()));
    btn("Reset", () => resetPeriod());
    btn("Skip", () => finish(false));
  });
  noticeText = text("");
  style_id(noticeText, "notice");
  focusText = text("");
  add_class(focusText, "muted");
}));

let litTicks = TICKS;
let ringColour = COLOUR.STAY_FOCUS;
const renderRing = (): void => {
  const colour = COLOUR[period];
  if (colour !== ringColour) {
    ringColour = colour;
    ticks.forEach((t: number) => vg.set_stroke(t, colour, 4));
  }
  const lit = duration > 0 ? Math.ceil((count / duration) * TICKS) : 0;
  if (lit === litTicks) return;
  for (let i = 0; i < TICKS; i++) {
    const on = i < lit;
    const was = i < litTicks;
    if (on !== was) vg.set_opacity(ticks[i], on ? 1.0 : 0.15);
  }
  litTicks = lit;
};

const render = (): void => {
  set_text(clockText, clock(count));
  set_text(periodText, LABEL[period]);
  set_text(roundText, `Round ${round} of ${config.sessionRounds}`);
  set_text(playBtn, playing ? "Pause" : "Start");
  const next = tasks.filter((t: Task) => !t.done);
  set_text(focusText, next.length > 0 ? `Working on: ${next[0].text}` : "No tasks: add one in Tasks");
  renderRing();
};

const notify = (title: string, body: string): void => {
  set_text(noticeText, `${title} ${body}`);
  print(`notify: ${title} ${body}`);
};

const startPeriod = (p: Period): void => {
  period = p;
  duration = minutesFor(p) * 60;
  count = duration;
  last = Date.now();
};

const plural = (n: number): string => (n === 1 ? "minute" : "minutes");

// A period ends (or is skipped): Pomatez's transitions, with its notices.
const finish = (natural: boolean): void => {
  if (period === "STAY_FOCUS") {
    if (round < config.sessionRounds) {
      if (natural) notify("Focus time finished.", `Enjoy your ${config.shortBreak} ${plural(config.shortBreak)} short break.`);
      startPeriod("SHORT_BREAK");
    } else {
      if (natural) notify("Session rounds completed.", `Enjoy your ${config.longBreak} ${plural(config.longBreak)} long break.`);
      startPeriod("LONG_BREAK");
    }
  } else {
    if (natural) notify("Break time finished.", `Stay focused as much as possible for ${config.stayFocus} ${plural(config.stayFocus)}.`);
    round = period === "SHORT_BREAK" ? round + 1 : 1;
    startPeriod("STAY_FOCUS");
    if (!config.autoStartWork) playing = false;
  }
  render();
};

const play = (): void => { playing = true; last = Date.now(); set_text(noticeText, ""); render(); };
const pause = (): void => { playing = false; render(); };
const resetPeriod = (): void => { startPeriod(period); render(); };

timer(250, () => {
  if (!playing) return;
  const now = Date.now();
  count -= (now - last) / 1000;
  last = now;
  if (count <= 0) { finish(true); return; }
  set_text(clockText, clock(count));
  renderRing();
});

// --- the Tasks view ---

let taskList = 0, taskCount = 0;
const renderTasks = (): void => {
  clear(taskList);
  into(taskList, () => {
    tasks.forEach((t: Task, i: number) => {
      hstack(4, () => {
        const box = toggle(t.text, (on: number) => {
          tasks[i].done = on === 1;
          saveTasks(); renderTasks(); render();
        });
        if (t.done) set_toggle(box, 1);
        btn("Delete", () => { tasks.splice(i, 1); saveTasks(); renderTasks(); render(); });
      });
    });
  });
  const left = tasks.filter((t: Task) => !t.done).length;
  set_text(taskCount, `${left} to do, ${tasks.length - left} done`);
};

views.push(vstack(6, () => {
  add_class(text("Tasks"), "heading");
  const field = textfield("Add a task", (s: string) => {});
  btn("Add task", () => {
    const t = get_text(field);
    if (t !== "") { tasks.push({ text: t, done: false }); set_text(field, ""); saveTasks(); renderTasks(); render(); }
  });
  taskCount = text("");
  add_class(taskCount, "muted");
  taskList = vstack(2, () => {});
}));

// --- the Config view (Pomatez's Config route: four sliders and a switch) ---

// The rules, as data: each one a slider over one field of config. The view
// and Restore defaults are both built from this table.
interface Rule { label: string; key: string; min: number; max: number; unit: string }
const RULES: Rule[] = [
  { label: "Stay focus",     key: "stayFocus",     min: 1, max: 120, unit: "min" },
  { label: "Short break",    key: "shortBreak",    min: 1, max: 60,  unit: "min" },
  { label: "Long break",     key: "longBreak",     min: 1, max: 60,  unit: "min" },
  { label: "Session rounds", key: "sessionRounds", min: 1, max: 10,  unit: "rounds" },
];
const ruleValue = (r: Rule): number => (config as any)[r.key];
const ruleText = (r: Rule): string => `${r.label}: ${ruleValue(r)} ${r.unit}`;

const configChanged = (): void => {
  saveConfig();
  if (!playing) resetPeriod();
  render();
};

let ruleRows: { value: number; slider: number }[] = [];
let autoToggle = 0;
views.push(vstack(6, () => {
  add_class(text("Rules"), "heading");
  RULES.forEach((r: Rule) => {
    const value = text(ruleText(r));
    const s = slider(r.min, r.max, ruleValue(r), (v: number) => {
      (config as any)[r.key] = Math.round(v);
      set_text(value, ruleText(r));
      configChanged();
    });
    ruleRows.push({ value: value, slider: s });
  });
  autoToggle = toggle("Auto start work time", (on: number) => {
    config.autoStartWork = on === 1;
    saveConfig();
  });
  if (config.autoStartWork) set_toggle(autoToggle, 1);
  btn("Restore defaults", () => {
    config = defaultConfig();
    RULES.forEach((r: Rule, i: number) => {
      set_slider(ruleRows[i].slider, ruleValue(r));
      set_text(ruleRows[i].value, ruleText(r));
    });
    set_toggle(autoToggle, 0);
    configChanged();
  });
}));

startPeriod("STAY_FOCUS");
renderTasks();
render();
show(0);
