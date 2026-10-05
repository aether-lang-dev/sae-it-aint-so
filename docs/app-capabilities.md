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
"seeks outgoing-http GET,PATCH https://api.github.com/notifications/**";
"seeks open-urls";
"seeks local-filesystem, reduced functionality without";

function render(items) {
  "hide http";        // this function may not name http, though the page may
  ...
}
```

A line is `seeks <privilege> [<methods> <pattern>][, reduced functionality without]`:

- **The privilege** unlocks one page-API object:

  | Privilege | Unlocks | A web page in the browser | An app |
  |---|---|---|---|
  | `local-filesystem` | `fs` | never | if `app.json` grants `fs` |
  | `outgoing-http` | `http` | yes, to the page's own origin | if `app.json` grants `http` |
  | `open-urls` | `shell.open` | never | if `app.json` grants `shell.open` |

  `ui`, `vg`, `storage` and `browserContext` every page has; they are not
  sought.
- **A scope** narrows it to what the page will actually do. Only
  `outgoing-http` takes one so far: a comma-separated list of methods and a
  URL pattern. Several lines give several scopes; a privilege is scoped on
  every line or on none. (Scopes for the other two are designed, below, and
  refused until sae enforces them: a page cannot claim a scope sae does not
  hold it to.)
- **`, reduced functionality without`** says the page works without it,
  with less. Where it cannot be granted the page still loads, and the object
  is simply absent (`typeof fs === "undefined"`), so the page falls back.
  Without the marker a seek is required: where it cannot be granted the page
  is refused at load. A privilege is required or optional, not both.

### URL patterns

`https://api.github.com/notifications/*` or `/api/*`. The scheme, host and
port are matched exactly (no `*` in them); the path is a glob where `*` is
any run of characters but `/` and `**` any run at all. The query and
fragment are not part of the match. A pattern starting with `/` means the
page's own origin; an app's pages have none, so they name the full URL.

### Checked three times

- **Naming needs seeking.** A page that names `fs`, `http` or `shell`
  without a line that unlocks it is refused when it is read, at the line:
  `page.ts:12:5: fs needs "seeks local-filesystem" at the top of the page`.
  A misspelt privilege, a method that is not one, a malformed pattern or
  two privileges on one line are refused the same way, at the line.
- **Seeking needs granting.** Before a page runs, the kernel compares what
  it seeks with what its context grants and refuses it with the reason if
  anything required is missing: `seeks local-filesystem, which a web page in
  the browser cannot have`; `seeks open-urls, which this app's app.json does
  not grant`. A scope must lie inside the grant: on the page's own origin in
  the browser (`seeks outgoing-http GET https://example.com/*, which is not
  its own origin`), within app.json's `http` prefixes in an app (`seeks
  outgoing-http GET http://host/old-home, beyond what this app's app.json
  grants`). None of the page runs; nothing fails halfway. An optional
  privilege that cannot be granted, or whose scope reaches past the grant,
  is left out instead.
- **Every request is held to the scopes.** A request the scopes do not
  cover is refused like one the grant does not: `res.ok === false`, with
  `this page's seeks do not cover PUT http://host/api/echo` in `res.error`.
  The grant is checked first and the scopes after, so a scope never widens
  anything.

**Redirects are followed by sae, one hop at a time**, and each hop is
checked against the grant and the scopes exactly as the first URL was (`res.
error`: `redirected to http://example.com/: a page may reach only its own
origin`). A 303, or a 301/302 after a POST, continues as a GET without its
body; credentials (`Authorization`, `Cookie`) are not carried to another
origin; https never redirects to http; five hops at most.

`hide a, b` at the top of any function hides those names in that function
and every function nested in it, as `hide` does in Aether.

A person reading a page's first lines sees what it reaches for, and how
far; a person reading `app.json` sees what the app may have.

## Why scopes, not reasons

A page could say *why* it wants something ("to save your settings"), but
that is the author's claim, and an author can understate it. A scope is a
claim sae enforces: `seeks outgoing-http GET https://api.github.com/user`
is not a description of what the page does with the network, it is all the
page can do with it. So the effort goes into making privileges narrow
enough to read as their own explanation, and the "reduced functionality
without" marker into something checkable: load the page with the grant
withheld and see that it works.

## Designed, not built yet

Agreed shape, in the order it is likely to land:

- **`local-filesystem` scopes**: verbs and a path glob, with no default
  verb, so "reads public keys" is something sae holds the page to:

  ```ts
  "seeks local-filesystem read ~/.ssh/*.pub, reduced functionality without";
  "seeks local-filesystem read,write ~/Documents/Pomatez/**";
  ```

  Verbs `read`, `write`, `list`, `delete`. `~` is the user's home. Globs as
  for URLs, matched on the path after it is made absolute and its symlinks
  resolved (as the files service already resolves them), so a link cannot
  lead out of a scope.
- **`open-urls` scopes**: a URL pattern, `"seeks open-urls https://github.com/*"`.
- **`app.json` in the same grammar.** An app (Tauri-style: installed, its
  capability file reviewed with it) keeps `app.json` as the fixed cap on
  every page it carries; its `capabilities` take the same verbs and
  patterns as a seek, so "this seek fits inside the grant" is one
  mechanical comparison. Today's `http` prefixes and `fs.read`/`fs.write`
  directories are the start of it.
- **Web pages granted by the person**, not only by the browser's fixed
  rules: a page asking for more than its own origin is shown its seeks, in
  their own words, and the person decides. Per-call consent ("Allow Gitify
  to read Documents?") hangs off the same lines.
- **Verifying the claims**, as an app store might: run the page with each
  optional grant withheld (saedriver) and check it loads and its core flows
  work; list where the page names each object (the lowerer knows every
  place) and what a recording service saw it touch, against its scopes.
- If a free-text reason ever appears in a consent prompt, it is shown as
  the app's own words ("Gitify says: ..."), never as sae's.

## Not yet

- `fs` on an actor for large files; file watching (macae's FSEvents).
- `notify` (desktop notifications) and `clipboard` as further capabilities.
