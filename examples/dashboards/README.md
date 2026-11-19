# Dashboards, on sae

Tsyne's gauge-dashboard and dial-dashboard (MIT, Copyright (c) 2025 Paul
Hammant; see [NOTICE.md](NOTICE.md)) as two views of one sae app, drawn with
`vg` arcs and lines.

```sh
target/build/bin/sae --app examples/dashboards
SAE_TEST_APP=examples/dashboards tests/run_spec.sh spec_dashboards
```

- **Gauges**: CPU, memory, disk and network; five arc orientations (top, left,
  right, three quarters, full circle); four sizes. Values come from one time
  state, so `Pause` and `Restart` hold a known moment.
- **Dials**: twelve dials in four styles (classic, minimal, vintage, modern)
  and 270, 180 and 360 degree ranges. Click or drag a dial and it turns to
  where the pointer is; the footer shows volume, temperature, pan and speed.
  The "Bound" dial follows the clock.
