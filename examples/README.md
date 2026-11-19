# Examples

Apps that run on sae (`target/build/bin/sae --app examples/<name>`, or
`tools/saepack.sh examples/<name>`). Each has a `NOTICE.md` naming where it
came from and the licence and copyright it carries, and an `app.json` with
its `license` (an SPDX identifier) and `author`. sae does not read those two
fields yet; they are for the gallery and for `saepack` once it requires them
(docs/roadmap.md, 8.4).

The ports from Tsyne (`tsyne/tsyne` at ae3b8d44, Paul Hammant's TypeScript UI
toolkit) are the apps only; none of Tsyne's framework code is used.

| App | What | From | Licence |
|---|---|---|---|
| `pomatez` | Pomodoro timer with tasks | Pomatez (Electron/Tauri) | MIT |
| `gitify` | GitHub notifications | Gitify (Electron) | MIT |
| `calcudoku` | KenKen arithmetic puzzle | Tsyne `ported-apps/calcudoku` | MIT, Paul Hammant |
