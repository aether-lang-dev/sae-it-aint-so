# Clock, on sae

A port of Tsyne's Clock (MIT, Copyright (c) 2025 Paul Hammant; see
[NOTICE.md](NOTICE.md)) to a sae app: an analog dial with hour, minute and
second hands, the time in digits, the date and the timezone.

```sh
target/build/bin/sae --app examples/clock
```

The hands are `vg` lines whose transforms are bound to one state, seconds
since midnight, which a timer advances. Tsyne's app reads a clock service it
can mock in tests; the "Set time" row is that here: type `3:00` or `09:15:30`
and the clock holds that time and ticks on; `Live` follows the system again.

```sh
SAE_TEST_APP=examples/clock tests/run_spec.sh spec_clock
```

The spec sets 3:00 and 9:15 and checks the pixels along each hand.
