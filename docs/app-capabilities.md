# App capabilities: what an app may do, and what each page may name

In npm's world a script gets `fs`, the network and the shell as soon as it
runs. In sae's browser a page gets none of them: a page is untrusted code
from a URL, and the page veto (`src/sae_host.ae`) keeps the kernel out of
everything a page can call. An app (`sae --app`, or a packaged `.app`) sits
between: someone chose to install it, so it may be granted more, but only
what it says it needs, and as narrowly as it can say it.

Two layers, after Tauri v2's capabilities and Aether's `hide` /
`seal except` (`aether/docs/hide-and-seal.md`):

| Layer | Where | Enforced by | What it is |
|---|---|---|---|
| **Grants** | `app.json` `"capabilities"` | the kernel, on every call | the security boundary: what the app may do at all |
| **Seals** | a directive at the top of a page or a function | the lowerer, when the page loads | hygiene and an audit line: what this code may *name* |

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

## Seals: what a page or function may name

A page may start with a directive, the way a script says `"use strict"`:

```ts
"seal except ui, http, storage";   // this page names nothing else

function render(items) {
  "hide http";                       // and this function not even that
  ...
}
```

- `seal except a, b` at the top of a page: the page may use only those of
  the API objects (`ui`, `vg`, `http`, `fs`, `shell`, `storage`,
  `browserContext`). Naming another (`fs.read_text(...)`) is an error at load:
  `page.ts:12:5: fs is sealed out of this page`.
- `hide a, b` at the top of any function: those names are hidden in that
  function and every function nested in it, as `hide` propagates to nested
  blocks in Aether.
- Seals narrow, never widen: a seal cannot grant what `app.json` withholds.

Like Aether's `hide`, a seal is **not** a security boundary: it stops code
from naming a capability, not a function it calls from using it. What it
gives is the one-line audit Aether's `seal except` gives a request handler:
read the directive and you know what the page reaches for. The grants are
the boundary.

## Not yet

- Per-call user consent ("Allow Gitify to read Documents?"), as macOS and
  Android ask at run time. The manifest is where that would hang.
- `fs` on an actor for large files; file watching (macae's FSEvents).
- `notify` (desktop notifications) and `clipboard` as further capabilities.
