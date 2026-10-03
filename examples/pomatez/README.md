# Pomatez, on sae

A port of [Pomatez](https://github.com/zidoro/pomatez) ("Stay Focused. Take a
Break.", MIT; see [NOTICE.md](NOTICE.md)) from Electron/Tauri to a sae app:
one TypeScript page, packaged as a 7.6 MB macOS app.

```sh
target/build/bin/sae --app examples/pomatez     # run it
tools/saepack.sh examples/pomatez               # -> target/apps/Pomatez.app
```

## What is ported

- **The timer and its rules**, from Pomatez's `CounterContext`: focus for 25
  minutes, a 5-minute short break, a 15-minute long break after the
  session's 4th round, round counting, "auto start work time", Start/Pause,
  Reset and Skip, and Pomatez's notices word for word ("Focus time
  finished. Enjoy your 5 minutes short break.").
- **The ring**, as 60 ticks drawn with `vg`, lit for the time left and
  coloured per period in Pomatez's palette (focus `#007bc7`, short break
  `#00855f`, long break `#a66703`).
- **Tasks**: add, tick off, delete; the timer shows the next open one, as
  Pomatez's priority card does.
- **Config**: the four sliders (focus, short break, long break, session
  rounds), auto start, and Restore defaults.
- **Persistence**: config and tasks in sae's app storage, so they survive
  a restart, as Pomatez keeps them in `localStorage`.

Like Pomatez's single-page app, the three views are one page shown one at a
time (`ui.set_visible`), so the timer keeps running while you look at your
tasks.

## Not yet

| Pomatez feature | What sae needs first |
|---|---|
| Desktop notifications and sounds | A notification capability behind the page veto (macae has the macOS half); notices show in the window and on the console for now |
| Special breaks at a time of day | `Date` objects with `getHours` (mquickjs-ae's `Date` has only `Date.now`) |
| Tray icon, always-on-top, compact mode, fullscreen breaks | Window and tray capabilities for apps |
| Task details with Markdown, task lists, drag to reorder | Rich text and drag in the page API |
| Themes (dark mode), languages, keyboard shortcuts | Small; not done yet |

## Tests

```sh
SAE_TEST_APP=examples/pomatez SAE_TIME_SCALE=60 \
  SAE_STORAGE_DIR=$PWD/target/spec-storage tests/run_spec.sh spec_pomatez
```

`SAE_TIME_SCALE=60` makes a minute a second, so the spec watches a focus
period run out into a short break and the break end, checks the ring
changes colour (canvas pixels), pause/reset/skip, the task list, what
landed in storage, and Restore defaults: 10 specs.
