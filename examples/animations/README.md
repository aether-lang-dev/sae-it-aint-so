# Animations, on sae

Tsyne's spinner, fractal-tree and particles demos (MIT, Copyright (c) 2025
Paul Hammant; see [NOTICE.md](NOTICE.md)) as three views of one sae app.

```sh
target/build/bin/sae --app examples/animations
SAE_TEST_APP=examples/animations tests/run_spec.sh spec_animations
```

- **Spinner**: eight wedges whose alpha sweeps round, once a second.
- **Tree**: a five-level fractal tree that grows for three seconds, then sways.
- **Particles**: a fountain with gravity and air resistance, fading as they age
  (the circles are one `vg.items` data join); click to burst thirty more.

`Pause`/`Resume`, `Step` (half a second on) and `Restart` hold and move the
moment; the spec uses them to read pixels at known times. `lib/animations.ts`
runs headless in `lower/tests/mod/ex_animations.ts`.
