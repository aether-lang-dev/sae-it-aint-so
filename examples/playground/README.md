# Playground, on sae

Tsyne's bouncing-ball and interactive-shapes demos (MIT, Copyright (c) 2025
Paul Hammant; see [NOTICE.md](NOTICE.md)) as two views of one sae app: a canvas
that answers the pointer.

```sh
target/build/bin/sae --app examples/playground
SAE_TEST_APP=examples/playground tests/run_spec.sh spec_playground
```

- **Balls**: three balls under gravity that bounce off the floor, ceiling and
  walls; drag one and let go to flick it.
- **Shapes**: two circles and a rectangle; click to change colour, drag to
  move, hover a circle to light it.

`Pause`, `Step` (30 ticks) and `Reset` hold the physics. `lib/playground.ts`
is Tsyne's physics and runs headless in `lower/tests/mod/ex_playground.ts`.
