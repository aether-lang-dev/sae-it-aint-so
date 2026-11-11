# std.ipc: a bounded write (wait_writable, or a write that does not wait)

**From:** sae (the control channel and an app's backend, 2026-11-11).
**Aether:** 0.908.0. **Status:** open; not filed upstream (aether is PR-only,
through Paul).

## Motivation

sae writes frames to two pipes it does not control the reader of: the
control channel's answers to the program that started sae (sae's stdout),
and its calls to an app's backend (the backend's stdin). It reads both
without ever waiting (`ipc.wait_readable(fd, 0)`, then `read`), so a peer
cannot stall sae's UI thread by sending. Writing has no such bound: once a
peer stops reading, the pipe fills (64 KB or so) and `ipc.write_frame`
waits in `write()` until the peer reads, exits or is killed. On the UI
thread that is a frozen window.

std.ipc 0.908.0 has `wait_readable` but no `wait_writable`, and every write
(`write`, `write_frame`) writes all of its bytes, waiting as long as it
takes. std.io's `fd_write` is the same. Nothing in std sets a pipe
`O_NONBLOCK`.

## What sae does meanwhile

`services/frames`' Writer: the frames go to a thread of their own
(`std.worker.run_detached`, one a batch), the UI tick watches a
`std.sync` counter of frames written, and a frame not taken within 5 s
drops the peer. No C, no new primitive. Its costs:

- a thread may stay blocked in `write()` after the peer is dropped, for as
  long as the peer neither reads nor exits. For a backend sae kills the
  process, which ends the write at once (EPIPE); for the control channel
  the parent is not sae's to kill, so the thread waits until it reads or
  exits (a headless sae exits regardless; a windowed one keeps the thread);
- the descriptor is the blocked thread's to close, so no close races a
  write on it (a reused descriptor number written to);
- one thread start a batch.

## What would replace it

Either of:

1. `ipc.wait_writable(fd, timeout_ms) -> (ready, err)`: `poll(POLLOUT)` on
   POSIX; on Windows an anonymous pipe has no writable test (no
   `PeekNamedPipe` for the write end), so it would need the pipe in
   `PIPE_NOWAIT` mode, or a writer thread inside std.ipc.
2. `ipc.write_some(fd, bytes) -> (written, err)` on a descriptor made
   non-blocking (`ipc.set_nonblocking(fd, 1)`: `O_NONBLOCK` on POSIX,
   `SetNamedPipeHandleState(PIPE_NOWAIT)` on a Windows pipe), with a
   frame writer that keeps its place (`write_frame_some(ch, data, offset)`
   or a small FrameWriter handle) so a partly written frame resumes on the
   next tick.

With either, the Writer becomes a queue drained a tick at a time on the UI
thread, no thread is ever left blocked, and a dropped channel's descriptor
closes at once.
