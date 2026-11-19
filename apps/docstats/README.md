# Docstats: a backend that reads the file you pick, and no other

The person picks a file. A backend that may open no file at all reads it
and answers with what is in it: bytes, lines, words, its SHA-256, and for a
CSV a summary of each column, with progress as it reads.

What it shows:

- **A file crosses as an open descriptor, not as a path.** The page calls
  `backend.invoke("stats", d.name, d)` with the handle `documents` gave it.
  sae opens that file, read only, and hands the backend the open file on
  its socket (`ipc.send_fd`); the backend reads it with
  `saebackend.handed(sb)` and `io.fd_read_n`. The page never sees a path,
  and neither does the backend.
- **Containment, twice.** `app.json` starts the backend on a socket with
  `"sandbox": {}`: no grants. On Linux sae starts it with
  `sandbox.spawn_socket`, so the kernel (Landlock and seccomp) and the
  sandbox preload hold it; and the backend locks itself down as well, its
  whole loop inside `sandbox.enforce` with no grants. The page's "Try it"
  asks the backend to open a path by name, and it is refused, the file it
  has just read included.
- **Progress pushed from the backend** with `saebackend.emit`, heard with
  `backend.on("progress", ...)`.

## Run it

Build the backend once (it needs no toolchain at run time):

```sh
cd apps/docstats
AETHER_LIB_DIR=../../sdk ae build backend/main.ae -o backend/main
cd ../..
target/build/bin/sae --app apps/docstats
```

On Linux with Landlock the backend runs contained. On macOS, FreeBSD and
anywhere else Aether cannot contain a child, sae does not start it and says
why; start the app with `--uncontained-backend` to run it there with no
process sandbox (its own lockdown still holds it). Not on Windows: a
document crosses only a socket, and std.ipc has none there.

## Files

| File | What |
|---|---|
| `app.json` | `documents`, and the backend: `"channel": "socket"`, `"sandbox": {}` |
| `index.ts` | the page: pick, show, the containment check |
| `backend/main.ae` | the backend: `stats` (the handed file) and `try_path` |
| `../../tests/spec_app_docstats.ae` | the spec: a CSV and a 200 KB text read through the descriptor, the counts, the SHA-256 and the columns checked, and the same path refused |

`docs/design/ipc-backends.md` is the design; `docs/app-backend.md` the
backend channel it runs on.
