# Timer, on sae

A port of Tsyne's Timer (MIT, Copyright (c) 2025 Paul Hammant; see
[NOTICE.md](NOTICE.md)): a countdown with `+1m`, `+5m` and `+10m`, `Start`,
`Stop` and `Reset`. At zero it says `Time is up!` and writes
`notify: Timer: Time is up!` to the output, where Tsyne sent a notification.

```sh
target/build/bin/sae --app examples/timer
SAE_TEST_APP=examples/timer SAE_TIME_SCALE=60 tests/run_spec.sh spec_timer
```
