# Ask (aether): `hide` one member of an imported module

## Motivation

sae confines each effect a web page can ask for to one module
(docs/architecture.md). `services/shell` is the only module meant to name
`ui.open_url`, the system URL opener: it imports `ui (open_url)` and
nothing else from ui. But sae's kernel imports all of `ui` to build the
browser window, so the kernel can name `ui.open_url` too. Today sae holds
that line with a grep (`tests/check_layers.sh`).

## What is missing

`hide` and `seal except` work on whole names, and on a namespace as a
prefix (`hide ui` hides every `ui.*`). There is no way to keep a module's
import whole and deny one member of it:

```aether
import ui

build_chrome_() {
    hide ui.open_url        // wanted: every other ui.* stays visible
    ...
}
```

and no import form that excludes one name (`import ui hiding (open_url)`,
as Haskell has).

## What would serve

Either of:

1. `hide ui.open_url` (a qualified member) in a block or function, with the
   same semantics as `hide` on a bare name: E0304 on any use at any depth.
2. A file-level form, `import ui hiding (open_url)`, so a whole module is
   held to "all of ui but this".

The second fits sae best: the kernel would import `ui hiding (open_url)`,
and only `services/shell` imports `ui (open_url)`, so the rule becomes the
import graph, checked by the compiler, and the grep goes.

## Not blocking

sae works today with the grep. This is about making the rule a compiler
check.
