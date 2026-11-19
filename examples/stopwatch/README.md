# Stopwatch, on sae

A port of Tsyne's Stopwatch (MIT, Copyright (c) 2025 Paul Hammant; see
[NOTICE.md](NOTICE.md)): an analog dial with a sweeping red hand, `MM:SS.cc`
below, `Start`/`Stop`, `Lap` (only while running) and `Reset`, and the laps
listed newest first.

```sh
target/build/bin/sae --app examples/stopwatch
SAE_TEST_APP=examples/stopwatch SAE_TIME_SCALE=60 tests/run_spec.sh spec_stopwatch
```
