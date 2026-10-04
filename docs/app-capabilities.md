# App capabilities: what an app may do, and what each page may name

In npm's world a script gets `fs`, the network and the shell as soon as it
runs. In sae's browser a page gets none of them: a page is untrusted code
from a URL, and the page veto (`src/sae_host.ae`) keeps the kernel out of
everything a page can call. An app (`sae --app`, or a packaged `.app`) sits
between: someone chose to install it, so it may be granted more, but only
what it says it needs, and as narrowly as it can say it.

Two sides, after Tauri v2's capabilities, Android's `uses-permission` and
Aether's `hide` (`aether/docs/hide-and-seal.md`):

| Side | Where | Enforced by | What it is |
|---|---|---|---|
| **Grants** | `app.json` `"capabilities"` (an app), or the browser's fixed rules (a web page) | the kernel: at load, and on every call | the security boundary: what the code may do at all |
| **Seeks** | `"seeks <privilege>"` lines at the top of a page | the lowerer (naming) and the kernel (at load) | what the page asks for, in words a person can read; the page fails to load, saying why, if it is not granted |

## Grants: `app.json`

```json
{
  "name": "Gitify",
  "capabilities": {
    "http":  ["https://api.github.com/"],
    "shell": { "open": ["https://github.com/"] },
    "fs":    { "read": ["$APPDATA/", "$DOCUMENTS/notes/"], "write": ["$APPDATA/"] }
  }
}
```

- **Default deny.** An app with no `"capabilities"` gets what a browser page
  gets, minus the origin its pages came from: `ui`, `vg`, `storage`,
  `browserContext`, timers. Nothing in the file system, no network, no shell.
- **`http`**: URL prefixes. A request to anything else is refused, the
  refusal delivered as `res.ok === false` with the reason in `res.error`.
- **`shell.open`**: URL prefixes the app may hand to the system (the default
  browser for `https:`, Mail for `mailto:`).
- **`fs.read` / `fs.write`**: directory prefixes, with `$APPDATA` (the app's
  own folder, created on first use), `$HOME`, `$DOCUMENTS`, `$DOWNLOADS`,
  `$DESKTOP` and `$TEMP` expanded. Every path is made absolute, its `.` and
  `..` taken out, and the longest part of it that exists resolved (symlinks
  followed) before it is checked, so a path cannot climb out of its root,
  not even through directories that do not exist yet (`fs.mkdir(
  "$APPDATA/../x/y")` is refused). `write` covers create, overwrite, remove and mkdir.
- **Refusal is an exception** for synchronous calls (`fs`), naming the
  capability and the path: `fs.read_text: outside this app's fs.read
  grant: /etc/passwd`.
- **The browser never has `fs` or `shell`**, whatever a page asks: the
  objects throw "not available to a web page". In the browser `http`
  reaches the page's own origin and nothing else.

The grants are fixed when the app starts. A page cannot widen them; nothing a
page does at run time can.

## The `fs` page API

Synchronous, in-process, for the small files an app keeps (settings,
documents, caches). Node names where they fit, so porting reads naturally:

| Call | Returns |
|---|---|
| `fs.read_text(path)` | the file's text (throws if missing) |
| `fs.write_text(path, text)` | writes it atomically |
| `fs.exists(path)` | true / false |
| `fs.list(dir)` | the names in a directory |
| `fs.mkdir(dir)` | creates it and its parents |
| `fs.remove(path)` | removes a file or an empty directory |
| `fs.readFileSync(path, "utf8")`, `fs.writeFileSync(path, text)` | aliases, for code ported from Node |

Large or slow work (a directory walk, a big read) belongs on an actor, as
http does; that is a later addition.

## Seeks: what a page asks for

A page says at its top which privileges it seeks, one per line, the way a
script says `"use strict"`:

```ts
"seeks outgoing-http";
"seeks open-urls";

function render(items) {
  "hide http";        // this function may not name http, though the page may
  ...
}
```

| Privilege | Unlocks | A web page in the browser | An app |
|---|---|---|---|
| `local-filesystem` | `fs` | never | if `app.json` grants `fs` |
| `outgoing-http` | `http` | yes, to the page's own origin | if `app.json` grants `http` |
| `open-urls` | `shell.open` | never | if `app.json` grants `shell.open` |

`ui`, `vg`, `storage` and `browserContext` every page has; they are not
sought.

- **Naming needs seeking.** A page that names `fs`, `http` or `shell`
  without the line that unlocks it is refused when it is read, at the
  line: `page.ts:12:5: fs needs "seeks local-filesystem" at the top of the
  page`. A misspelt privilege is refused the same way.
- **Seeking needs granting.** Before a page runs, the kernel compares what
  it seeks with what its context grants, and refuses it with the reason if
  anything is missing: `seeks local-filesystem, which a web page in the
  browser cannot have`, or `seeks open-urls, which this app's app.json does
  not grant`. None of the page runs; nothing fails halfway.
- **Seeking never widens.** A page cannot grant itself anything; the grants
  stay the boundary, checked again on every call.
- `hide a, b` at the top of any function hides those names in that
  function and every function nested in it, as `hide` does in Aether.

A person reading a page's first lines sees what it reaches for; a person
reading `app.json` sees what it may have.

## Not yet

- An optional seek (`"seeks local-filesystem if granted"`): the page
  loads either way, with `fs` absent when not granted, for pages that
  feature-detect (`typeof fs`) and fall back. Today seeking is required: a
  page that seeks what it cannot have is refused at load.

- Per-call user consent ("Allow Gitify to read Documents?"), as macOS and
  Android ask at run time. The manifest is where that would hang.
- `fs` on an actor for large files; file watching (macae's FSEvents).
- `notify` (desktop notifications) and `clipboard` as further capabilities.
