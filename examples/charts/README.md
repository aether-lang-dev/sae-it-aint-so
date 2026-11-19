# Charts, on sae

Three of Tsyne's data-visualisation demos (bar-chart, line-chart-demo,
heatmap-demo; MIT, Copyright (c) 2025 Paul Hammant; see
[NOTICE.md](NOTICE.md)) as three views of one sae app, built from `vg` shapes.

```sh
target/build/bin/sae --app examples/charts
SAE_TEST_APP=examples/charts tests/run_spec.sh spec_charts
```

- **Bars**: six bars oscillating, their values above them; `Randomize`
  re-phases them.
- **Lines**: Tsyne's series, in `linear`, `step`, `catmull-rom` and `monotone`
  interpolation, `Show multiple series`, wheel and drag to zoom and pan (with
  `Zoom In`, `Zoom Out` and `Reset Zoom`). The axes use `sae:scales`.
- **Heatmap**: an 8 by 8 sine field on the purple, green, yellow ramp.

`Pause`/`Resume` and `Restart` hold and rewind the animation, which is one
time state advanced in fixed steps; the spec holds t=0 and reads values and
pixels. `lib/charts.ts` is the arithmetic, run headless by
`lower/tests/mod/ex_charts.ts`.
