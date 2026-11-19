# Fractals, on sae

Tsyne's five fractal explorers (Mandelbrot, Julia set, Newton fractal,
Tricorn, Burning Ship; BSD-3-Clause, Copyright (c) 2025 Paul Hammant; see
[NOTICE.md](NOTICE.md)) as one sae app with a picker.

```sh
target/build/bin/sae --app examples/fractals
SAE_TEST_APP=examples/fractals tests/run_spec.sh spec_fractals
```

`Zoom In`, `Zoom Out`, `Left`, `Up`, `Down`, `Right`, `Reset`, a click to zoom
in on a point, the scroll wheel, `Next Palette` through eight palettes, and
`Next Preset` through the Julia set's six famous constants. The picture is a
`vg.raster` filled ten rows a frame on the frame clock, so a deep zoom draws
while the window stays alive, and a newer request drops an older one.
The status line and the output (`fractals: drew ...`) say what was drawn.
